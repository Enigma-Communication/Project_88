import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { REFERENCE_DIR, OUT_DIR } from "p88-core/config";
import { matteToInk, onBackground } from "p88-core/matte";

/**
 * Proves the matte pipeline with zero API calls: take a reference illustration,
 * flatten it to pure white (simulating what the model will return), then key it
 * back to a true ink separation on alpha.
 */
const outDir = path.join(OUT_DIR, "matte-test");
fs.mkdirSync(outDir, { recursive: true });

const src = path.join(REFERENCE_DIR, "style", "ref3-diving-facedown.png");

// simulate a model return: flat white ground
const simulated = await sharp(src).flatten({ background: "#FFFFFF" }).jpeg({ quality: 94 }).toBuffer();
fs.writeFileSync(path.join(outDir, "00-simulated-model-output.jpg"), simulated);

const inked = await matteToInk(simulated);
fs.writeFileSync(path.join(outDir, "10-alpha.png"), inked);

for (const [name, bg] of [["white", "#FFFFFF"], ["grey", "#8A8A8A"], ["black", "#111111"], ["navy", "#001A5C"]] as const) {
  fs.writeFileSync(path.join(outDir, `20-on-${name}.png`), await onBackground(inked, bg));
}

// alpha histogram — how clean is the separation?
const { data, info } = await sharp(inked).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
let opaque = 0, clear = 0, partial = 0;
for (let i = 3; i < data.length; i += info.channels) {
  const a = data[i];
  if (a > 245) opaque++; else if (a < 10) clear++; else partial++;
}
const total = opaque + clear + partial;
const m = await sharp(inked).metadata();
console.log(`alpha PNG: ${m.width}x${m.height}`);
console.log(`  fully opaque (ink)   ${(opaque / total * 100).toFixed(1)}%`);
console.log(`  fully clear  (paper) ${(clear / total * 100).toFixed(1)}%`);
console.log(`  partial (soft edge)  ${(partial / total * 100).toFixed(1)}%`);
console.log(`-> ${outDir}`);
