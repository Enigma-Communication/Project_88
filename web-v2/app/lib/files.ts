/**
 * How many photos one batch holds.
 *
 * Not an API limit — the club moves to its own key, so nothing bills per photo
 * here. It is the point past which the tray stops being readable and the
 * browser is holding an unreasonable number of decoded bitmaps at once.
 */
export const MAX_BATCH = 40;

/**
 * Pull the usable images out of a drop or a file picker.
 *
 * HEIC is matched on the extension as well as the type: Safari reports it as
 * image/heic, but a file arriving from a share sheet or an SD card reader often
 * carries an empty type, and a type-only filter silently drops exactly the
 * files a phone produces.
 */
export function imageFiles(list: FileList | null | undefined): File[] {
  return Array.from(list ?? []).filter(
    (f) => f.type.startsWith("image/") || /\.hei[cf]$/i.test(f.name),
  );
}
