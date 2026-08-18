import sharp from "sharp";
import type { Box, Triage } from "./gemini.js";
import { GEN_INPUT_PX } from "./config.js";

/**
 * Crop to the dominant athlete with headroom, then upscale to the model's
 * working size. Without this the athlete occupies a fraction of the model's
 * input and detail starves — see PLAN.md "the finding that changes the pipeline".
 */
export type CropResult = {
  buffer: Buffer;
  /** height of the athlete, in real source pixels, before upscale */
  subjectPx: number;
  /** what the athlete occupies in the generated input, in pixels */
  subjectPxAfter: number;
  box: { left: number; top: number; width: number; height: number };
};

/** Padding around the subject box, as a fraction of the box's larger side. */
const PAD = 0.18;

export async function cropToSubject(
  src: string | Buffer,
  triageResult: Triage,
  opts: { pad?: number; square?: boolean } = {},
): Promise<CropResult> {
  const pad = opts.pad ?? PAD;
  const img = sharp(src).rotate();
  const meta = await img.metadata();
  const W = meta.width!, H = meta.height!;

  const dom = triageResult.people.find((p) => p.role === "dominant");
  if (!dom) throw new Error("no dominant subject to crop to");

  // Gemini boxes are [ymin,xmin,ymax,xmax] normalised 0-1000
  const b: Box = dom.box;
  let x0 = (b.xmin / 1000) * W;
  let y0 = (b.ymin / 1000) * H;
  let x1 = (b.xmax / 1000) * W;
  let y1 = (b.ymax / 1000) * H;

  const subjectPx = Math.round(y1 - y0);

  const padPx = Math.max(x1 - x0, y1 - y0) * pad;
  x0 -= padPx; y0 -= padPx; x1 += padPx; y1 += padPx;

  if (opts.square) {
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const half = Math.max(x1 - x0, y1 - y0) / 2;
    x0 = cx - half; x1 = cx + half; y0 = cy - half; y1 = cy + half;
  }

  // clamp to image bounds
  const left = Math.max(0, Math.round(x0));
  const top = Math.max(0, Math.round(y0));
  const width = Math.min(W - left, Math.round(x1 - x0));
  const height = Math.min(H - top, Math.round(y1 - y0));

  const buffer = await sharp(src)
    .rotate()
    .extract({ left, top, width, height })
    .resize(GEN_INPUT_PX, GEN_INPUT_PX, { fit: "inside", withoutEnlargement: false })
    .jpeg({ quality: 92 })
    .toBuffer();

  const outMeta = await sharp(buffer).metadata();
  const scale = (outMeta.height ?? GEN_INPUT_PX) / height;

  return {
    buffer,
    subjectPx,
    subjectPxAfter: Math.round(subjectPx * scale),
    box: { left, top, width, height },
  };
}


/**
 * Tight crop of the athlete's head, upscaled.
 *
 * At whole-figure scale the face lands on well under 100px of model input,
 * which is why likeness drifts. Supplying the head separately, at high
 * resolution, gives the model something specific to match.
 */
export async function cropFace(
  src: string | Buffer,
  triageResult: Triage,
  size = 640,
): Promise<Buffer | null> {
  const b = triageResult.faceBox;
  if (!b) return null;

  const meta = await sharp(src).rotate().metadata();
  const W = meta.width!, H = meta.height!;

  let x0 = (b.xmin / 1000) * W, y0 = (b.ymin / 1000) * H;
  let x1 = (b.xmax / 1000) * W, y1 = (b.ymax / 1000) * H;

  const pad = Math.max(x1 - x0, y1 - y0) * 0.35;
  x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;

  const left = Math.max(0, Math.round(x0));
  const top = Math.max(0, Math.round(y0));
  const width = Math.min(W - left, Math.round(x1 - x0));
  const height = Math.min(H - top, Math.round(y1 - y0));
  if (width < 24 || height < 24) return null;

  return sharp(src).rotate()
    .extract({ left, top, width, height })
    .resize(size, size, { fit: "inside" })
    .jpeg({ quality: 94 })
    .toBuffer();
}
