#!/usr/bin/env -S npx tsx
/**
 * Project 88 — photo to screenprint illustration.
 *
 *   cd "/path/to/photos"
 *   p88 DSC02294.jpg
 *
 * Writes <name>_illustration.png (transparent, one-colour ink) beside the source.
 */
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { IMAGE_MODELS, DEFAULT_IMAGE_MODEL, INK_HEX, REFERENCE_DIR, type ImageModelKey } from "p88-core/config";
import { triage } from "p88-core/gemini";
import { cropToSubject } from "p88-core/crop";
import { buildPrompt } from "p88-core/prompt";
import { matteToInk, detectGround, onBackground, stripBorderFrame, stencilInvert } from "p88-core/matte";
import { generateImage } from "p88-core/gemini";
import { readTriage, writeTriage, fallbackTriage } from "./cache";
import { judge } from "p88-core/verdict";

const C = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
};

const args = process.argv.slice(2);
if (args.includes("-h") || args.includes("--help")) {
  console.log(`
${C.bold("p88")} — photo to screenprint illustration

  ${C.cyan("p88 <image>")}              generate from one photo
  ${C.cyan("p88")}                      pick the first image in the current folder

Options
  --model=<nb31|nb25|pro3>   image model      (default ${DEFAULT_IMAGE_MODEL})
  --keep                     also keep the raw model output and preview comps
  --out=<file>               output path      (default <name>_illustration.png)
  --no-triage                skip the vision pass (no auto-crop, saves quota)
  --fresh                    ignore the cached triage for this photo
  --clean                    delete everything this tool generated here
  --force                    generate even if preflight says NOT SUITABLE
  --stencil                  also write a stencil-inverted PNG for dark backgrounds
  --outline=<px>             stencil contour thickness (default scales with size)

${C.dim("Triage results are cached per photo — re-running costs no vision quota.")}
`);
  process.exit(0);
}

const flag = (name: string, fallback: string) =>
  args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;

// --clean: remove everything this tool has generated in the current folder,
// so a test starts from just the source photos.
if (args.includes("--clean")) {
  const generated = /(_illustration|_v[0-9][a-z_]*|_crop|_raw|_on-(white|black|navy|grey))\.(png|jpe?g)$/i;
  const hits = fs.readdirSync(process.cwd()).filter((f) => generated.test(f));
  if (!hits.length) console.log(C.dim("nothing to clean"));
  for (const f of hits) { fs.unlinkSync(path.join(process.cwd(), f)); console.log(C.dim(`removed ${f}`)); }
  console.log(C.green(`\ncleaned ${hits.length} file(s)`));
  process.exit(0);
}

const model = flag("model", DEFAULT_IMAGE_MODEL) as ImageModelKey;

const keep = args.includes("--keep");

// resolve the input image
let input = args.find((a) => !a.startsWith("--"));
if (!input) {
  const here = fs.readdirSync(process.cwd()).filter((f) => /\.(jpe?g|png|heic|webp)$/i.test(f)).sort();
  if (!here.length) {
    console.error(C.red("no image given and no image found in this folder"));
    process.exit(1);
  }
  input = here[0];
  console.log(C.dim(`no image given — using ${input}`));
}
const src = path.resolve(process.cwd(), input);
if (!fs.existsSync(src)) { console.error(C.red(`not found: ${src}`)); process.exit(1); }

const stem = path.basename(src).replace(/\.[^.]+$/, "");
const out = path.resolve(process.cwd(), flag("out", `${stem}_illustration.png`));

const t0 = Date.now();
const step = (n: number, label: string) => process.stdout.write(`${C.dim(`[${n}/5]`)} ${label.padEnd(34)}`);
const done = (msg: string) => console.log(C.green("✓") + " " + C.dim(msg));

console.log(`\n${C.bold("Project 88")} ${C.dim("· photo → screenprint illustration")}`);
console.log(C.dim(`source  ${src}`));
console.log(C.dim(`model   ${IMAGE_MODELS[model]}   ink ${INK_HEX}\n`));

try {
  // 1 — preflight
  step(1, "preflight");
  const meta = await sharp(src).rotate().metadata();
  if ((meta.width ?? 0) < 1200 && (meta.height ?? 0) < 1200)
    console.log(C.yellow(`\n  warning: source is only ${meta.width}x${meta.height} — expect soft output`));

  let tri;
  let triSource = "";
  if (args.includes("--no-triage")) {
    tri = fallbackTriage();
    triSource = "skipped";
  } else {
    const cached = args.includes("--fresh") ? null : readTriage(src);
    if (cached) { tri = cached; triSource = "cached"; }
    else {
      const small = await sharp(src).rotate().resize(1024, 1024, { fit: "inside" }).jpeg({ quality: 88 }).toBuffer();
      tri = await triage(small.toString("base64"));
      writeTriage(src, tri);
      triSource = "fresh";
    }
  }
  const overlaps = tri.people.filter((p) => p.overlapsDominant).length;
  done(`${tri.people.length} in frame · face ${tri.faceVisibility} · ${tri.motion}${overlaps ? ` · ${overlaps} overlapping` : ""} ${C.dim(`(${triSource})`)}`);
  console.log(C.dim(`      subject: ${tri.subject}`));

  // 2 — crop
  step(2, triSource === "skipped" ? "crop (skipped)" : "crop to subject");
  const crop = await cropToSubject(src, tri);
  done(`${crop.subjectPx}px → ${crop.subjectPxAfter}px in model input`);

  // preflight verdict — needs subjectPx, so it lands after the crop
  if (triSource !== "skipped") {
    const { verdict, reasons } = judge(tri, crop.subjectPx);
    const badge =
      verdict === "READY" ? C.green("  READY       ")
      : verdict === "NEEDS CROP" ? C.yellow("  NEEDS CROP  ")
      : C.red("  NOT SUITABLE");
    console.log(`${badge} ${reasons.length ? C.dim(reasons.join(" · ")) : C.dim("nothing flagged")}`);
    if (verdict === "NOT SUITABLE" && !args.includes("--force")) {
      console.log(C.dim("\n  refusing to spend a generation on this photo. --force to override.\n"));
      process.exit(2);
    }
  }
  if (keep) fs.writeFileSync(out.replace(/\.png$/, "_crop.jpg"), crop.buffer);

  // 3 — generate
  step(3, `generate (${IMAGE_MODELS[model]})`);
  const prompt = buildPrompt(tri);
  const raw = await generateImage(model, prompt, [{ b64: crop.buffer.toString("base64"), mime: "image/jpeg" }]);
  if (!raw) throw new Error("model returned no image");
  done(`${(raw.length / 1024).toFixed(0)}kb`);
  if (keep) fs.writeFileSync(out.replace(/\.png$/, "_raw.png"), raw);

  // 4 — ink separation
  step(4, "ink separation");
  const ground = await detectGround(raw);
  const matted = await matteToInk(raw);
  const before = await sharp(matted).metadata();
  const inked = await stripBorderFrame(matted);
  const m = await sharp(inked).metadata();
  const framed = m.width !== before.width || m.height !== before.height;
  done(`ground lum ${ground.lum} (${(ground.confidence * 100).toFixed(0)}% of frame) → ${m.width}x${m.height}${framed ? C.yellow(" · border frame removed") : ""}`);

  // 5 — write
  step(5, "write png");
  fs.writeFileSync(out, inked);
  done(`${(inked.length / 1024).toFixed(0)}kb`);

  // stencil inversion — for dark backgrounds, ink and carved areas swap
  const wantStencil = args.includes("--stencil") || keep;
  let stencil: Buffer | null = null;
  if (wantStencil) {
    const outlinePx = flag("outline", "");
    stencil = await stencilInvert(inked, outlinePx ? { outline: Number(outlinePx) } : {});
    fs.writeFileSync(out.replace(/\.png$/, "_stencil.png"), stencil);
  }

  if (keep) {
    for (const [name, bg] of [["white", "#FFFFFF"], ["black", "#111111"], ["navy", "#001A5C"]] as const) {
      fs.writeFileSync(out.replace(/\.png$/, `_on-${name}.png`), await onBackground(inked, bg));
    }
    if (stencil) {
      for (const [name, bg] of [["black", "#111111"], ["navy", "#001A5C"]] as const) {
        fs.writeFileSync(out.replace(/\.png$/, `_stencil-on-${name}.png`), await onBackground(stencil, bg));
      }
    }
  }

  console.log(`\n${C.green("done")} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`${C.bold(out)}\n`);
} catch (e: any) {
  const msg = String(e?.message ?? e);
  console.log(C.red("✗"));
  if (msg.includes("limit: 0")) {
    console.error(`\n${C.red("Image generation is not enabled on this API key's project.")}
${C.dim("The free tier allows 0 image requests — this is not a rate limit you can wait out.")}

  ${C.bold("Fix:")} enable billing on the Google Cloud project that owns this key.
  If the account already has billing, the key was likely created in a
  different project. Generate a new key inside the billed project.
  ${C.dim("https://aistudio.google.com/apikey")}\n`);
  } else if (msg.includes("RESOURCE_EXHAUSTED") || msg.includes("429")) {
    console.error(`\n${C.yellow("Rate limited.")} ${C.dim("Wait and retry.")}\n${C.dim(msg.slice(0, 300))}\n`);
  } else {
    console.error(`\n${C.red(msg.slice(0, 500))}\n`);
  }
  process.exit(1);
}
