import sharp from "sharp";
import type { Box, Triage } from "./gemini";
import { GEN_INPUT_PX } from "./config";

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

/**
 * Default white mount, as a fraction of the crop's long edge added to EACH
 * side. 0.15 on a 1000px-tall crop is a 1300px square with the figure centred.
 *
 * Tunable so a sweep can compare widths without a rebuild — see
 * `generator/src/test-mount.ts`.
 */
export const MOUNT = Number(process.env.P88_MOUNT ?? 0.15);

export type ModelInput = {
  /** the JPEG handed to the model */
  buffer: Buffer;
  /**
   * How tall the photo content is in that JPEG, mount excluded. The caller
   * divides by the crop's own height to get the scale factor — which with a
   * mount is not the output height, because most of the output is white.
   */
  contentHeight: number;
};

/**
 * Sit the crop in the middle of a white square before it goes to the model.
 *
 * Two separate things make this change the output, and they pull the same way:
 *
 * 1. The crop is upscaled to `target` afterwards, so the mount decides how much
 *    of the model's input the athlete actually occupies. Filling the frame gets
 *    a faithful transcription; leaving room gets a bolder, flatter read. This
 *    is the detail dial, and the only one we have that does not ask the
 *    operator to crop differently.
 * 2. GROUND in prompt.ts demands the figure "float in empty white space" and
 *    touch no edge. A tight operator crop shows the model the exact opposite on
 *    every submit. Mounting it makes the reference agree with the instruction.
 *
 * Square rather than an even border, on the AD's call — with the side benefit
 * that every photo now reaches the model in the same shape whatever shape it
 * was cropped, so crop aspect stops being a source of variance between one
 * generation and the next.
 *
 * Costs nothing downstream: white is above MATTE_THRESHOLD, so the mount keys
 * to alpha and `matteToInk`'s trim removes it. It never reaches the deliverable.
 *
 * Takes the source and the box rather than an open sharp pipeline on purpose:
 * web-v2 resolves Next's bundled sharp while core resolves its own, and the two
 * versions are deliberately not pinned together (see STATE.md), so a pipeline
 * handed across that boundary is a dual-package hazard as well as a type error.
 * Every sharp call for this stays in here.
 *
 * Does the mount as a resize-then-pad rather than `.extend()`:
 * **sharp applies extend AFTER resize no matter which order they are called
 * in**, so extending by the crop's own dimensions silently mounts the
 * already-downscaled image and blows the canvas past `target`. Padding to size
 * with `fit: "contain"` lands on exactly `target` square with no such trap.
 *
 * The raw intermediate is the full-quality handoff between the two stages — it
 * is taken after the downscale, so it is a couple of MB, not the whole crop.
 */
export async function toModelInput(
  src: string | Buffer,
  box: { left: number; top: number; width: number; height: number } | null,
  mount: number,
  target = GEN_INPUT_PX,
): Promise<ModelInput> {
  const pipe = box
    ? sharp(src).rotate().extract(box)
    : sharp(src).rotate();

  if (mount <= 0) {
    const buffer = await pipe
      .resize(target, target, { fit: "inside", withoutEnlargement: false })
      .jpeg({ quality: 92 })
      .toBuffer();
    const meta = await sharp(buffer).metadata();
    return { buffer, contentHeight: meta.height ?? target };
  }

  // the crop occupies this much of the square; the rest is mount
  const inner = Math.round(target / (1 + 2 * mount));
  const stage1 = await pipe
    .resize(inner, inner, { fit: "inside", withoutEnlargement: false })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const buffer = await sharp(stage1.data, { raw: stage1.info })
    .resize(target, target, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 1 },
      withoutEnlargement: true,
    })
    .jpeg({ quality: 92 })
    .toBuffer();

  return { buffer, contentHeight: stage1.info.height };
}

export async function cropToSubject(
  src: string | Buffer,
  triageResult: Triage,
  opts: { pad?: number; square?: boolean; mount?: number } = {},
): Promise<CropResult> {
  const pad = opts.pad ?? PAD;
  // Defaults off, not to MOUNT: web/ and the CLI are the stable pair and this
  // changes what the model sees. web-v2 opts in explicitly.
  const mount = opts.mount ?? 0;
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

  const { buffer, contentHeight } = await toModelInput(src, { left, top, width, height }, mount);

  // measured on the photo content, not the canvas — with a mount most of the
  // canvas is white, and subjectPxAfter is meant to say how much real detail
  // the athlete gets, which is exactly what the mount reduces
  const scale = contentHeight / height;

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
