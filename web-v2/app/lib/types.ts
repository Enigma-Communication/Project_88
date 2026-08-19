import type { Triage } from "p88-core/gemini";

export type Box = { left: number; top: number; width: number; height: number };
export type Verdict = "READY" | "NEEDS CROP" | "NOT SUITABLE";

/** What /api/preflight returns for one photo. */
export type Preflight = {
  verdict: Verdict;
  reasons: string[];
  subject: string;
  faceVisibility: string;
  motion: string;
  notes: string;
  people: number;
  overlaps: number;
  figureCutOff: boolean;
  source: { width: number; height: number };
  box: Box;
  subjectPx: number;
  triage: Triage;
};

/** What /api/generate returns. */
export type Result = {
  png: string;
  stencil: string;
  sourceCrop: string;
  width: number;
  height: number;
};

/**
 * One photo in the tray. The file never leaves the browser until it is
 * preflighted or generated, so the tray itself costs nothing.
 */
export type TrayItem = {
  id: string;
  file: File;
  name: string;
  thumbUrl: string;
  state: "waiting" | "checking" | "checked" | "failed";
  pre: Preflight | null;
  error: string | null;
  /** operator's adjusted crop, once they have touched it */
  box: Box | null;
};
