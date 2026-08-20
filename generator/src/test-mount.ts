/**
 * Sweep the white mount against one photo.
 *
 * The mount is the only dial we have on detail-vs-boldness that does not ask
 * the operator to crop differently, and the right setting is a judgement call
 * rather than a measurement — so this runs one photo at several widths and
 * lays the results out for the AD to pick from.
 *
 *   npm run mount -- DSC04351.jpg              # 0, 0.15, 0.3, 0.5
 *   npm run mount -- DSC04351.jpg 0.1 0.2 0.3  # your own set
 *
 * ⚠ One image generation per width. That is billed quota, not free tier.
 */
import sharp from "sharp";
import path from "node:path";
import fs from "node:fs";
import { PHOTOS_DIR, OUT_DIR, DEFAULT_IMAGE_MODEL } from "p88-core/config";
import { triage, generateImage } from "p88-core/gemini";
import { cropToSubject } from "p88-core/crop";
import { buildPrompt } from "p88-core/prompt";
import { matteToInk, stripBorderFrame, onBackground } from "p88-core/matte";

const file = process.argv[2] ?? "DSC04351.jpg";
const mounts = process.argv.slice(3).map(Number).filter((n) => Number.isFinite(n) && n >= 0);
const widths = mounts.length ? mounts : [0, 0.15, 0.3, 0.5];

const src = path.join(PHOTOS_DIR, file);
if (!fs.existsSync(src)) {
  console.error(`no such photo: ${src}`);
  process.exit(1);
}

const outDir = path.join(OUT_DIR, "mount", path.parse(file).name);
fs.mkdirSync(outDir, { recursive: true });

// One vision pass shared by every width — the triage is about the photo, not
// the mount, and re-running it would burn the daily vision quota for nothing.
const small = await sharp(src).rotate().resize(1024, 1024, { fit: "inside" }).jpeg({ quality: 88 }).toBuffer();
const t = await triage(small.toString("base64"));
const prompt = buildPrompt(t);

console.log(`${file} — ${widths.length} generations at mount ${widths.join(", ")}`);
console.log(`subject: ${t.subject}\n`);

for (const mount of widths) {
  const label = mount.toFixed(2).replace(".", "p");
  const crop = await cropToSubject(src, t, { mount });

  // what the model is handed, kept alongside the result — half of reading a
  // sweep is seeing the input that produced each one
  fs.writeFileSync(path.join(outDir, `mount-${label}_input.jpg`), crop.buffer);

  const raw = await generateImage(DEFAULT_IMAGE_MODEL, prompt, [
    { b64: crop.buffer.toString("base64"), mime: "image/jpeg" },
  ]);
  if (!raw) {
    console.log(`  mount ${mount.toFixed(2)} — model returned no image, skipped`);
    continue;
  }

  const inked = await stripBorderFrame(await matteToInk(raw));
  fs.writeFileSync(path.join(outDir, `mount-${label}.png`), inked);
  // on white as well: transparent PNGs are unreadable in a Finder grid, which
  // is where these actually get compared
  fs.writeFileSync(path.join(outDir, `mount-${label}_on-white.png`), await onBackground(inked, "#FFFFFF"));

  const m = await sharp(inked).metadata();
  console.log(
    `  mount ${mount.toFixed(2)} — subject ${crop.subjectPxAfter}px of model input, output ${m.width}x${m.height}`,
  );
}

console.log(`\n-> ${outDir}`);
console.log(`   open "${outDir}"`);
