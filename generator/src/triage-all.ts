import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { PHOTOS_DIR, OUT_DIR } from "./config.js";
import { triage, type Triage } from "./gemini.js";

const TAGS: Record<string, string> = {
  DSC01649: "Red", DSC02466: "Red",
  DSC01782: "Orange", DSC04105: "Orange", DSC04262: "Orange",
  DSC04923: "Orange", DSC07264: "Orange", DSC08347: "Orange",
  DSC01740: "Green", DSC01965: "Green", DSC02294: "Green",
  DSC04351: "Green", DSC04576: "Green",
};

type Row = { file: string; tag: string; t: Triage; srcH: number; subjPx: number; verdict: string; reasons: string[] };

function judge(t: Triage, subjPx: number): { verdict: string; reasons: string[] } {
  const reasons: string[] = [];
  const dom = t.people.find((p) => p.role === "dominant");
  const overlaps = t.people.filter((p) => p.overlapsDominant).length;

  if (!dom) { reasons.push("no dominant subject"); return { verdict: "NOT SUITABLE", reasons }; }
  if (!t.poseReadable) reasons.push("pose not readable");
  if (t.figureCutOff) reasons.push("figure cut off by frame");
  if (subjPx < 700) reasons.push(`subject only ${subjPx}px tall after crop`);
  if (overlaps > 0) reasons.push(`${overlaps} player(s) overlapping subject`);
  if (t.motion === "static") reasons.push("static pose (style wants motion)");

  const fatal = !t.poseReadable || subjPx < 700;
  if (fatal) return { verdict: "NOT SUITABLE", reasons };
  if (reasons.length) return { verdict: "NEEDS CROP", reasons };
  return { verdict: "READY", reasons: [] };
}

const files = Object.keys(TAGS).sort();
const rows: Row[] = [];

for (const stem of files) {
  const file = `${stem}.jpg`;
  const src = path.join(PHOTOS_DIR, file);
  const meta = await sharp(src).rotate().metadata();
  const buf = await sharp(src).rotate().resize(1024, 1024, { fit: "inside" }).jpeg({ quality: 88 }).toBuffer();
  try {
    const t = await triage(buf.toString("base64"));
    const dom = t.people.find((p) => p.role === "dominant");
    const srcH = meta.height ?? 0;
    const fracH = dom ? (dom.box.ymax - dom.box.ymin) / 1000 : 0;
    const subjPx = Math.round(fracH * srcH);
    const { verdict, reasons } = judge(t, subjPx);
    rows.push({ file, tag: TAGS[stem], t, srcH, subjPx, verdict, reasons });
    console.log(`${file}  ${TAGS[stem].padEnd(6)} ${verdict.padEnd(13)} subj=${(fracH*100).toFixed(0)}% (${subjPx}px)  face=${t.faceVisibility} motion=${t.motion} ppl=${t.people.length}`);
  } catch (e: any) {
    console.log(`${file}  ${TAGS[stem].padEnd(6)} ERROR ${e?.message?.slice(0,80)}`);
  }
  await new Promise((r) => setTimeout(r, 2000));
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, "triage.json"), JSON.stringify(rows, null, 2));
console.log(`\nwrote ${rows.length} rows -> output/triage.json`);
