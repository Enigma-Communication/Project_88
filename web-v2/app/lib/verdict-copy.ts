import type { Preflight, Verdict } from "./types";

/**
 * The verdict, as a sentence and an instruction.
 *
 * Board 03's note is the brief: "the verdict becomes a sentence and an
 * instruction ... the bullets read as diagnostics rather than directions".
 * So this returns one finding and one thing to do about it, and the raw
 * numbers move into a disclosure.
 *
 * Composed from the triage data rather than asked of the model: it is
 * deterministic, free, adds no round trip, and the same photo always reads
 * the same way twice. A second model call would be slower and would vary.
 *
 * Note on pronouns: the boards say "behind him". The app cannot know a
 * player's pronouns from a photograph, and the club fields an NRLW side, so
 * the copy is written to avoid the third person entirely rather than guess.
 */
export type VerdictCopy = { chip: string; finding: string; instruction: string };

const CHIP: Record<Verdict, string> = {
  READY: "Ready to go",
  "NEEDS CROP": "Needs a tighter crop",
  "NOT SUITABLE": "This one will struggle",
};

export function verdictCopy(pre: Preflight): VerdictCopy {
  const chip = CHIP[pre.verdict];
  const { overlaps, people, subjectPx, figureCutOff, motion, faceVisibility, triage } = pre;
  const others = Math.max(0, people - 1);

  // Ordered by what actually costs you the generation, worst first.
  if (!triage.poseReadable) {
    return {
      chip,
      finding: "The pose is not clearly legible.",
      instruction:
        "Limbs are merging with another player, so the model has to guess where the body goes — and it will. Pick a frame where the shape reads on its own.",
    };
  }

  if (subjectPx > 0 && subjectPx < 500) {
    return {
      chip,
      finding: `The subject is only ${subjectPx}px tall in the source.`,
      instruction:
        "That upscales to mush at 1280px. Crop tighter only if there is detail to crop to — otherwise this frame is not worth a generation.",
    };
  }

  if (overlaps > 0) {
    return {
      chip,
      finding:
        overlaps === 1
          ? "Another player is overlapping the subject."
          : `${cap(count(overlaps))} other players are overlapping the subject.`,
      instruction:
        "Pull the box in until it holds just the ball carrier. Whatever is inside the box is what gets drawn — the model will happily illustrate the whole run-out.",
    };
  }

  if (figureCutOff) {
    return {
      chip,
      finding: "The figure runs off the edge of the frame.",
      instruction:
        "A limb cut by the frame stays open in the stencil. Crop to a clean edge, or accept the cut and check the inverted version before exporting.",
    };
  }

  if (subjectPx > 0 && subjectPx < 700) {
    return {
      chip,
      finding: `The subject is ${subjectPx}px tall — on the small side.`,
      instruction:
        "It will upscale a little soft. Worth doing, but do not crop in any further than the box already is.",
    };
  }

  if (others >= 3) {
    return {
      chip,
      finding: `Busy frame — ${count(others)} other people are in shot.`,
      instruction:
        "Nobody is touching the subject, so this will work. Tighten the box anyway if you want the background gone entirely.",
    };
  }

  if (others > 0) {
    return {
      chip,
      finding: others === 1 ? "One other person is in the frame." : `${cap(count(others))} other people are in the frame.`,
      instruction: "Clear of the subject, so the crop should hold. Adjust it if you want them out of shot.",
    };
  }

  if (motion === "static") {
    return {
      chip,
      finding: "The pose is a static one.",
      instruction:
        "This style is built for motion, so a standing shot comes out stiffer. It will still draw — a running frame from the same set will come out better.",
    };
  }

  if (faceVisibility === "obscured") {
    return {
      chip,
      finding: "The face is turned away.",
      instruction:
        "Not a problem. Likeness comes from the pose here, and the prompt is told to keep the face turned rather than invent one.",
    };
  }

  return {
    chip,
    finding: "Clean frame, nothing in the way.",
    instruction: "The suggested box holds the whole figure. Adjust it if you want it tighter, then draw.",
  };
}

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const count = (n: number) => (n <= 10 ? WORDS[n] : String(n));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
