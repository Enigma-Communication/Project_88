import type { Triage } from "./gemini";

export type Verdict = "READY" | "NEEDS CROP" | "NOT SUITABLE";

/**
 * Preflight triage. Not a bouncer — it says what's wrong so the operator can
 * fix it, rather than just refusing the photo.
 *
 * Face visibility is deliberately NOT a gate. Half the AD's reference
 * illustrations have obscured faces; pose and silhouette carry the style.
 */
export function judge(t: Triage, subjectPx: number): { verdict: Verdict; reasons: string[] } {
  const reasons: string[] = [];
  const dom = t.people.find((p) => p.role === "dominant");
  if (!dom) return { verdict: "NOT SUITABLE", reasons: ["no dominant subject in frame"] };

  const overlaps = t.people.filter((p) => p.overlapsDominant).length;
  const others = t.people.length - 1;

  if (!t.poseReadable) reasons.push("pose not clearly readable");
  if (t.figureCutOff) reasons.push("figure cut off by the frame edge");
  if (subjectPx > 0 && subjectPx < 700) reasons.push(`subject only ${subjectPx}px tall — will upscale soft`);
  if (overlaps > 0) reasons.push(`${overlaps} other player${overlaps > 1 ? "s" : ""} overlapping the subject`);
  else if (others >= 3) reasons.push(`busy frame — ${others} other people present`);
  else if (others > 0) reasons.push(`${others} other person${others > 1 ? "s" : ""} in frame`);
  if (t.motion === "static") reasons.push("static pose — this style wants motion");
  if (t.faceVisibility === "obscured") reasons.push("face obscured — likeness will come from pose, not features");

  const fatal = !t.poseReadable || (subjectPx > 0 && subjectPx < 500);
  if (fatal) return { verdict: "NOT SUITABLE", reasons };

  const blocking = reasons.some((r) => /overlapping|busy frame|cut off|upscale soft/.test(r));
  return { verdict: blocking ? "NEEDS CROP" : "READY", reasons };
}
