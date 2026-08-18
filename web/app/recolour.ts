/**
 * Swap the ink colour of a one-colour PNG, preserving alpha.
 *
 * The output is a single flat ink tone with an alpha channel, so changing
 * colour is just rewriting RGB and leaving A alone — no regeneration, no
 * server round trip, instant in the picker.
 */
export const SWATCHES = [
  { hex: "#F90000", name: "Red" },
  { hex: "#0027C5", name: "Blue" },
  { hex: "#000000", name: "Black" },
  { hex: "#FFFFFF", name: "White" },
] as const;

export async function recolour(dataUrl: string, hex: string): Promise<string> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;

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
