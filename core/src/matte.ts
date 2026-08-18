import sharp from "sharp";
import { INK_HEX } from "./config";

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

/**
 * Stencil inversion — swap ink and carved-out areas within the figure.
 *
 * The AD's note: on dark backgrounds, cut it the way a stencil artist would.
 * Our normal output is ink-positive (red marks, everything else transparent),
 * so on black the carved highlights vanish into the background. Inverting
 * inside the silhouette makes the figure read light-on-dark instead.
 *
 * The inversion is bounded by the silhouette, found by flooding transparent
 * pixels in from the canvas edge — everything the flood cannot reach is
 * "inside the figure". Without that bound, inverting alpha would simply fill
 * the whole canvas.
 *
 * A contour is then drawn back on. Inverting alone destroys the heavy outline
 * Prompt.md calls for, because that outline WAS the ink — flip it and the
 * figure's edge becomes the transparent part. So we band the inside of the
 * silhouette edge back to solid ink at `outline` px wide.
 */
export async function stencilInvert(
  png: Buffer,
  opts: { hex?: string; outline?: number } = {},
): Promise<Buffer> {
  const hex = opts.hex ?? INK_HEX;

  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, N = W * H;
  const alphaAt = (i: number) => data[i * 4 + 3];

  // AD picked 6px at our typical ~640px output. Kept as a ratio rather than a
  // hardcoded 6 so it still reads correctly if output resolution changes.
  const outline = opts.outline ?? Math.max(3, Math.round(Math.min(W, H) * 0.0094));

  // flood the outside: transparent pixels reachable from the border
  const outside = new Uint8Array(N);
  const stack: number[] = [];
  const OPEN = 24; // alpha at or below this is passable
  for (let x = 0; x < W; x++) {
    for (const i of [x, (H - 1) * W + x]) if (alphaAt(i) <= OPEN && !outside[i]) { outside[i] = 1; stack.push(i); }
  }
  for (let y = 0; y < H; y++) {
    for (const i of [y * W, y * W + W - 1]) if (alphaAt(i) <= OPEN && !outside[i]) { outside[i] = 1; stack.push(i); }
  }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % W, y = (i / W) | 0;
    if (x > 0)     { const j = i - 1; if (!outside[j] && alphaAt(j) <= OPEN) { outside[j] = 1; stack.push(j); } }
    if (x < W - 1) { const j = i + 1; if (!outside[j] && alphaAt(j) <= OPEN) { outside[j] = 1; stack.push(j); } }
    if (y > 0)     { const j = i - W; if (!outside[j] && alphaAt(j) <= OPEN) { outside[j] = 1; stack.push(j); } }
    if (y < H - 1) { const j = i + W; if (!outside[j] && alphaAt(j) <= OPEN) { outside[j] = 1; stack.push(j); } }
  }

  // Chamfer distance from the outside, so we can band the silhouette edge.
  // Two passes over the grid approximate a Euclidean distance closely enough
  // for a contour of a few pixels.
  const BIG = 1e6;
  const dist = new Float32Array(N);
  for (let i = 0; i < N; i++) dist[i] = outside[i] ? 0 : BIG;
  const D1 = 1, D2 = 1.4142;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let d = dist[i];
      if (x > 0)            d = Math.min(d, dist[i - 1] + D1);
      if (y > 0)            d = Math.min(d, dist[i - W] + D1);
      if (x > 0 && y > 0)   d = Math.min(d, dist[i - W - 1] + D2);
      if (x < W - 1 && y > 0) d = Math.min(d, dist[i - W + 1] + D2);
      dist[i] = d;
    }
  }
  for (let y = H - 1; y >= 0; y--) {
    for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x;
      let d = dist[i];
      if (x < W - 1)              d = Math.min(d, dist[i + 1] + D1);
      if (y < H - 1)              d = Math.min(d, dist[i + W] + D1);
      if (x < W - 1 && y < H - 1) d = Math.min(d, dist[i + W + 1] + D2);
      if (x > 0 && y < H - 1)     d = Math.min(d, dist[i + W - 1] + D2);
      dist[i] = d;
    }
  }

  const r0 = parseInt(hex.slice(1, 3), 16);
  const g0 = parseInt(hex.slice(3, 5), 16);
  const b0 = parseInt(hex.slice(5, 7), 16);

  const out = Buffer.alloc(N * 4);
  for (let i = 0; i < N; i++) {
    const d = i * 4;
    out[d] = r0; out[d + 1] = g0; out[d + 2] = b0;

    if (outside[i]) { out[d + 3] = 0; continue; }

    const inverted = 255 - alphaAt(i);
    if (dist[i] <= outline) {
      out[d + 3] = 255;                                  // solid contour band
    } else if (dist[i] <= outline + 1.5) {
      const t = (dist[i] - outline) / 1.5;               // 1.5px feather off the band
      out[d + 3] = Math.round(255 * (1 - t) + inverted * t);
    } else {
      out[d + 3] = inverted;
    }
  }
  return sharp(out, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer();
}

/** Compose a transparent PNG over a solid colour, for review sheets. */
export async function onBackground(pngWithAlpha: Buffer, bg: string): Promise<Buffer> {
  const meta = await sharp(pngWithAlpha).metadata();
  return sharp({ create: { width: meta.width!, height: meta.height!, channels: 4, background: bg } })
    .composite([{ input: pngWithAlpha }])
    .png()
    .toBuffer();
}
