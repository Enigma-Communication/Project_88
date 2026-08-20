/**
 * The white mount width, as a fraction of the crop's long edge per side, kept
 * where the operator can change it between generations.
 *
 * Local testing only. The server owns the real default (MOUNT in p88-core), and
 * page.tsx only sends this when NODE_ENV is not production — so a deployed
 * build ignores the whole thing and uses the server's value, whatever a stale
 * localStorage entry happens to say.
 *
 * Stored rather than held in React state because a reload mid-comparison
 * otherwise silently resets the dial and the next result is not what you think
 * it is — the exact failure mode that makes a sweep untrustworthy.
 */
const KEY = "p88.mount";

/** Mirrors MOUNT in p88-core/crop. Kept in step by hand; the dial shows it. */
export const MOUNT_DEFAULT = 0.15;

/** The widths worth comparing — 0 is the old behaviour, kept as the baseline. */
export const MOUNT_PRESETS = [0, 0.15, 0.3, 0.5, 0.75] as const;

export function loadMount(): number {
  if (typeof window === "undefined") return MOUNT_DEFAULT;
  const raw = window.localStorage.getItem(KEY);
  if (raw === null) return MOUNT_DEFAULT;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= 2 ? n : MOUNT_DEFAULT;
}

export function saveMount(value: number): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, String(value));
}
