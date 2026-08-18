import sharp from "sharp";
import { INK_HEX } from "./config.js";

/**
 * Turn the model's flat-ground illustration into a true one-colour ink
 * separation on alpha.
 *
 * Deliberately arithmetic, not an ML matting model. rembg / remove.bg are
 * trained on photographic subjects and soften the rough screenprint edges that
 * carry the whole style. The generated image is two-tone by construction, so
 * alpha is a luminance ramp — exact, instant, and it keeps the grit.
 *
 * All light pixels are removed, including the carved interior highlights. That
 * is what a real one-colour screenprint separation is.
 */

const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/**
 * Find the ground tone as the dominant bright mode in the luminance histogram.
 *
 * We ask the model for a pure white ground, but the AD's style spec calls for
 * "warm off-white paper" and the style references carry a grey ground, so the
 * model may well return something other than 255. A fixed threshold turns that
 * into a half-transparent mess.
 *
 * Border sampling was the obvious approach and it is not robust: any padding,
 * vignette or second light tone and it locks onto the wrong one. The ground is
 * always the most *common* bright value, so take the histogram mode instead.
 */
export async function detectGround(input: Buffer): Promise<{ lum: number; confidence: number }> {
  const { data, info } = await sharp(input)
    .flatten({ background: "#ffffff" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const ch = info.channels;

  const hist = new Array(256).fill(0);
  let total = 0;
  for (let i = 0; i < data.length; i += ch) {
    hist[Math.round(luma(data[i], data[i + 1], data[i + 2]))]++;
    total++;
  }

  // the ground is the most common value in the bright half
  let peak = 255, peakN = -1;
  for (let l = 140; l < 256; l++) {
    if (hist[l] > peakN) { peakN = hist[l]; peak = l; }
  }

  // how much of the image sits within +/-6 of that peak
  let near = 0;
  for (let l = Math.max(0, peak - 6); l <= Math.min(255, peak + 6); l++) near += hist[l];

  return { lum: peak, confidence: near / total };
}

export type MatteOptions = {
  hex?: string;
  /** Override auto-detection. Luminance at which a pixel is fully background. */
  groundLum?: number;
  /** Width of the soft edge, in luminance units, below the ground. */
  feather?: number;
  /** How far below the ground to place the fully-opaque point, in luma units. */
  spread?: number;
  trim?: boolean;
};

export async function matteToInk(input: Buffer, opts: MatteOptions = {}): Promise<Buffer> {
  const hex = opts.hex ?? INK_HEX;
  const feather = opts.feather ?? 18;
  const spread = opts.spread ?? 55;

  const ground = opts.groundLum ?? (await detectGround(input)).lum;

  // fully transparent at/above (ground - feather); fully opaque below (ground - spread)
  const hi = ground - feather;
  const lo = ground - spread;

  const { data, info } = await sharp(input).flatten({ background: "#ffffff" }).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const px = width * height;
  const out = Buffer.alloc(px * 4);

  const r0 = parseInt(hex.slice(1, 3), 16);
  const g0 = parseInt(hex.slice(3, 5), 16);
  const b0 = parseInt(hex.slice(5, 7), 16);

  for (let i = 0; i < px; i++) {
    const s = i * channels;
    const lum = luma(data[s], data[s + 1], data[s + 2]);
    let a: number;
    if (lum >= hi) a = 0;
    else if (lum <= lo) a = 255;
    else a = Math.round(255 * (1 - (lum - lo) / (hi - lo)));
    const d = i * 4;
    out[d] = r0; out[d + 1] = g0; out[d + 2] = b0; out[d + 3] = a;
  }

  let pipe = sharp(out, { raw: { width, height, channels: 4 } }).png({ compressionLevel: 9 });
  if (opts.trim !== false) pipe = pipe.trim({ threshold: 1 });
  return pipe.toBuffer();
}

/**
 * Remove a border frame the model has drawn around the illustration.
 *
 * The prompt tells it not to; it sometimes does anyway. A frame is ink that
 * runs along the canvas edges, which also defeats trim() — so we scan inward
 * from each side for the first almost-empty line (the gap between frame and
 * artwork) and cut there.
 *
 * Deliberately conservative: it only acts when a real gap exists just inside
 * the edge, so a figure that genuinely reaches the edge is left alone.
 */
export async function stripBorderFrame(png: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const A = (x: number, y: number) => data[(y * W + x) * 4 + 3];

  const rowInk = (y: number) => { let n = 0; for (let x = 0; x < W; x++) if (A(x, y) > 24) n++; return n / W; };
  const colInk = (x: number) => { let n = 0; for (let y = 0; y < H; y++) if (A(x, y) > 24) n++; return n / H; };

  // a frame side is a line covering most of that edge
  const FRAME = 0.6;
  // the gap just inside it is nearly empty
  const GAP = 0.02;
  // only look within this fraction of the image from each edge
  const REACH = 0.12;

  const findCut = (n: number, ink: (i: number) => number, fromStart: boolean): number => {
    const limit = Math.floor(n * REACH);
    let sawFrame = false;
    for (let k = 0; k < limit; k++) {
      const i = fromStart ? k : n - 1 - k;
      const v = ink(i);
      if (v >= FRAME) sawFrame = true;
      else if (sawFrame && v <= GAP) return k + 1;
    }
    return 0;
  };

  const top = findCut(H, rowInk, true);
  const bottom = findCut(H, rowInk, false);
  const left = findCut(W, colInk, true);
  const right = findCut(W, colInk, false);
  if (!top && !bottom && !left && !right) return png;

  const w = W - left - right, h = H - top - bottom;
  if (w < W * 0.5 || h < H * 0.5) return png; // implausible, leave it

  return sharp(png).extract({ left, top, width: w, height: h }).trim({ threshold: 1 }).png().toBuffer();
}

/** Compose a transparent PNG over a solid colour, for review sheets. */
export async function onBackground(pngWithAlpha: Buffer, bg: string): Promise<Buffer> {
  const meta = await sharp(pngWithAlpha).metadata();
  return sharp({ create: { width: meta.width!, height: meta.height!, channels: 4, background: bg } })
    .composite([{ input: pngWithAlpha }])
    .png()
    .toBuffer();
}
