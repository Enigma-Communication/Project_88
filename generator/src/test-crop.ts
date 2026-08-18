import sharp from "sharp";
import path from "node:path";
import fs from "node:fs";
import { PHOTOS_DIR, OUT_DIR } from "p88-core/config";
import { triage } from "p88-core/gemini";
import { cropToSubject } from "p88-core/crop";

const file = process.argv[2] ?? "DSC04262.jpg";
const src = path.join(PHOTOS_DIR, file);
const small = await sharp(src).rotate().resize(1024, 1024, { fit: "inside" }).jpeg({ quality: 88 }).toBuffer();
const t = await triage(small.toString("base64"));
const crop = await cropToSubject(src, t);

fs.mkdirSync(path.join(OUT_DIR, "crops"), { recursive: true });
const out = path.join(OUT_DIR, "crops", file.replace(".jpg", "_crop.jpg"));
fs.writeFileSync(out, crop.buffer);

const m = await sharp(crop.buffer).metadata();
console.log(`${file}`);
console.log(`  source subject height : ${crop.subjectPx}px`);
console.log(`  crop box              : ${crop.box.width}x${crop.box.height} at (${crop.box.left},${crop.box.top})`);
console.log(`  model input           : ${m.width}x${m.height}`);
console.log(`  subject in model input: ${crop.subjectPxAfter}px  (vs ~${Math.round(crop.subjectPx / (await sharp(src).metadata()).height! * 1024)}px if sent uncropped)`);
console.log(`  -> ${out}`);
