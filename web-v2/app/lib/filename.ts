/**
 * A filename that says what the file is.
 *
 * Every download out of the v1 build is called illustration.png, so twenty on
 * a match day become illustration (17).png and the comms team cannot tell
 * them apart. Board 06 derives the name from the match and the source frame;
 * the match is not in the app yet, so this uses what is: the source photo and
 * the treatment.
 */
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const stem = (name: string) => slug(name.replace(/\.[^.]+$/, ""));

export function exportName(sourceName: string, kind: "fill" | "stencil", inkName: string): string {
  return `knights_${stem(sourceName)}_${kind}_${slug(inkName)}.png`;
}

/** The zip that holds every version of one illustration. */
export function packName(sourceName: string): string {
  return `knights_${stem(sourceName)}_pack.zip`;
}

/** Trigger a download of a data URL without leaving the page. */
export function download(dataUrl: string, filename: string): void {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Same, for a Blob — revokes the object URL once the click is through. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  download(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
