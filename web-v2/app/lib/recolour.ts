/**
 * Swap the ink colour of a one-colour PNG, preserving alpha.
 *
 * The output is a single flat ink tone with an alpha channel, so changing
 * colour is just rewriting RGB and leaving A alone — no regeneration, no
 * server round trip, instant in the picker.
 */

/**
 * Board 05 names the inks. Five unlabelled circles is a guessing game, and
 * one of them (white) makes the preview look like a broken export unless the
 * background flips with it.
 */
/*
 * Seasonal Red 01 is #F90000 — the named style in the Figma file, and the
 * swatch v1 already shipped. #D82020 is a different thing: the ink the
 * pipeline mattes the model's output to before anyone picks a colour. Using
 * the matte default as the swatch, as the first pass did, made the picker
 * disagree with both the design and the existing app.
 */
export const INKS = [
  { hex: "#F90000", name: "Seasonal red 01", note: "Knights red" },
  { hex: "#0027C5", name: "Seasonal blue 01", note: "" },
  { hex: "#000000", name: "Black", note: "" },
  { hex: "#FFFFFF", name: "White", note: "Preview flips to dark" },
] as const;

export type Surface = "alpha" | "paper" | "black" | "navy";

export const SURFACES: { key: Surface; label: string; css: string | null }[] = [
  { key: "alpha", label: "Alpha", css: null },
  { key: "paper", label: "Paper", css: "#F5F0E8" },
  { key: "black", label: "Black", css: "#111113" },
  { key: "navy", label: "Navy", css: "#001A5C" },
];

export async function recolour(src: string, hex: string): Promise<string> {
  const img = new Image();
  img.src = src;
  await img.decode();

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return src;

  ctx.drawImage(img, 0, 0);
  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = frame.data;

  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue; // leave fully transparent pixels alone
    d[i] = r; d[i + 1] = g; d[i + 2] = b;
  }
  ctx.putImageData(frame, 0, 0);
  return canvas.toDataURL("image/png");
}

/** Relative luminance, for deciding what an ink needs to sit on. */
export function luminance(hex: string): number {
  return (
    0.2126 * parseInt(hex.slice(1, 3), 16) +
    0.7152 * parseInt(hex.slice(3, 5), 16) +
    0.0722 * parseInt(hex.slice(5, 7), 16)
  );
}
