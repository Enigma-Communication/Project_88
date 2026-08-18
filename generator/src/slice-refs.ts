import sharp from "sharp";
import path from "node:path";
import fs from "node:fs";
import { REFERENCE_DIR } from "p88-core/config";

/**
 * Split the AD's contact sheet into four separate style references.
 * These are passed as few-shot style inputs for the v3_reffirst variant.
 *
 * NB: extract -> trim -> flatten must be separate sharp passes; chaining them
 * in one pipeline makes sharp compute a bad extract area on later iterations.
 */
const src = path.join(REFERENCE_DIR, "illustrations.png");
const outDir = path.join(REFERENCE_DIR, "style");
fs.mkdirSync(outDir, { recursive: true });

const meta = await sharp(src).metadata();
const hw = Math.floor(meta.width! / 2);
const hh = Math.floor(meta.height! / 2);

const quads = [
  { name: "ref1-running-fend",   left: 0,  top: 0  },
  { name: "ref2-airborne",       left: hw, top: 0  },
  { name: "ref3-diving-facedown", left: 0,  top: hh },
  { name: "ref4-running-front",  left: hw, top: hh },
];

for (const q of quads) {
  const raw = await sharp(src).extract({ left: q.left, top: q.top, width: hw, height: hh }).png().toBuffer();
  const trimmed = await sharp(raw).trim({ threshold: 12 }).png().toBuffer();
  const out = path.join(outDir, `${q.name}.png`);
  await sharp(trimmed)
    .flatten({ background: "#F5F0E8" })
    .extend({ top: 24, bottom: 24, left: 24, right: 24, background: "#F5F0E8" })
    .png()
    .toFile(out);
  const m = await sharp(out).metadata();
  console.log(`  ${q.name.padEnd(24)} ${m.width}x${m.height}`);
}
console.log(`\n-> ${outDir}`);
