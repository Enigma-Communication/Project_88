import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { ROOT } from "p88-core/config";
import type { Triage } from "p88-core/gemini";

/**
 * Triage results are cached per source file. The free tier allows only 20
 * vision calls a day, so re-running the CLI on the same photo must not spend
 * one. Keyed on path + size + mtime, so editing the photo invalidates it.
 */
const DIR = path.join(ROOT, ".cache");

function keyFor(src: string): string {
  const st = fs.statSync(src);
  const h = crypto.createHash("sha1").update(`${src}:${st.size}:${st.mtimeMs}`).digest("hex").slice(0, 16);
  return path.join(DIR, `${path.basename(src).replace(/\.[^.]+$/, "")}-${h}.json`);
}

export function readTriage(src: string): Triage | null {
  try {
    const f = keyFor(src);
    if (!fs.existsSync(f)) return null;
    return JSON.parse(fs.readFileSync(f, "utf8")) as Triage;
  } catch { return null; }
}

export function writeTriage(src: string, t: Triage): void {
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(keyFor(src), JSON.stringify(t, null, 2));
  } catch { /* cache is best-effort */ }
}

/**
 * Fallback when the vision pass is unavailable (quota) or explicitly skipped.
 * Assumes a single centred subject filling most of the frame, and gives the
 * prompt a neutral description. Deliberately conservative: it says nothing
 * about the face, so prompt.ts takes the "keep it as it is" branch.
 */
export function fallbackTriage(): Triage {
  return {
    people: [{ box: { ymin: 0, xmin: 0, ymax: 1000, xmax: 1000 }, role: "dominant", overlapsDominant: false }],
    faceVisibility: "partial",
    poseReadable: true,
    figureCutOff: false,
    motion: "dynamic",
    subject: "the athlete shown in the photograph, in their exact pose and body position",
    notes: "vision pass skipped — no automatic crop applied",
  };
}
