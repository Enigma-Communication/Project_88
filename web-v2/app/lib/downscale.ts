/**
 * Shrink a photo in the browser before uploading.
 *
 * Two reasons, both real:
 *  - Straight off a camera these run 5–25MB and the upload body limit rejects
 *    the big ones outright.
 *  - Staff shoot from the sideline on mobile data, where a 21MB upload is
 *    painful.
 *
 * 3000px on the long edge keeps far more detail than the pipeline needs — the
 * crop is upscaled to 1280px, and the athlete occupies 40–89% of frame across
 * the test set — so nothing visible is lost.
 *
 * Falls back to the original file if the browser can't decode it (some HEIC),
 * rather than failing the upload.
 */
const MAX_EDGE = 3000;
const QUALITY = 0.9;

export async function downscale(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    const longest = Math.max(width, height);
    if (longest <= MAX_EDGE && file.size < 4_000_000) {
      bitmap.close();
      return file;
    }

    const scale = Math.min(1, MAX_EDGE / longest);
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) { bitmap.close(); return file; }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", QUALITY));
    if (!blob) return file;

    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}
