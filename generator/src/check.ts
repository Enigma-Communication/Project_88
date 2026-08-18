import sharp from "sharp";
import path from "node:path";
import { PHOTOS_DIR } from "p88-core/config";
import { triage } from "p88-core/gemini";

const file = process.argv[2] ?? "DSC04262.jpg";
const buf = await sharp(path.join(PHOTOS_DIR, file))
  .rotate().resize(1024, 1024, { fit: "inside" }).jpeg({ quality: 88 }).toBuffer();

const t = await triage(buf.toString("base64"));
console.log(`\n=== ${file} ===`);
console.log(`people: ${t.people.length}  face: ${t.faceVisibility}  motion: ${t.motion}`);
console.log(`poseReadable: ${t.poseReadable}  cutOff: ${t.figureCutOff}`);
const d = t.people.find((p) => p.role === "dominant");
if (d) {
  const h = ((d.box.ymax - d.box.ymin) / 10).toFixed(1);
  const w = ((d.box.xmax - d.box.xmin) / 10).toFixed(1);
  console.log(`dominant box: ${h}% of frame height, ${w}% width`);
  console.log(`overlapping others: ${t.people.filter(p => p.overlapsDominant).length}`);
}
console.log(`subject: ${t.subject}`);
console.log(`notes: ${t.notes}`);
