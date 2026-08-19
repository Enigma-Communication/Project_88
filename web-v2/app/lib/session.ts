/**
 * Today's generations, kept on the device.
 *
 * This is the fix for the worst CX bug in the v1 build: close the tab and
 * every paid generation is gone. No accounts, no server — the club is on a
 * single shared password and the results are theirs, not ours.
 *
 * IndexedDB rather than localStorage, deliberately. A result is a 1024x1408
 * one-colour PNG, roughly 0.3-1.5MB, and the strip holds six or more of them.
 * localStorage caps at ~5MB of *string*, and base64 inflates by a third — so
 * a normal match-day session would blow the quota, and it fails by throwing
 * mid-save rather than degrading. IndexedDB stores the Blobs directly.
 */
const DB = "p88-v2";
const STORE = "generations";
const KEEP_DAYS = 7;

export type StoredGeneration = {
  id: string;
  createdAt: number;
  sourceName: string;
  width: number;
  height: number;
  ink: string;
  png: Blob;
  stencil: Blob;
  sourceCrop: Blob;
};

/** What the UI actually holds: object URLs, revoked when the strip unmounts. */
export type SessionEntry = Omit<StoredGeneration, "png" | "stencil" | "sourceCrop"> & {
  pngUrl: string;
  stencilUrl: string;
  sourceCropUrl: string;
};

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" }).createIndex("createdAt", "createdAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      }),
  );
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return await (await fetch(dataUrl)).blob();
}

export async function saveGeneration(
  g: Omit<StoredGeneration, "id" | "createdAt">,
): Promise<SessionEntry> {
  const rec: StoredGeneration = {
    ...g,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  };
  await tx("readwrite", (s) => s.put(rec));
  return toEntry(rec);
}

/** Newest first, and prunes anything older than a week on the way past. */
export async function listSession(): Promise<SessionEntry[]> {
  const all = await tx<StoredGeneration[]>("readonly", (s) => s.getAll());
  const cutoff = Date.now() - KEEP_DAYS * 86_400_000;
  const stale = all.filter((g) => g.createdAt < cutoff);
  if (stale.length) await Promise.all(stale.map((g) => remove(g.id)));
  return all
    .filter((g) => g.createdAt >= cutoff)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(toEntry);
}

export async function remove(id: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(id));
}

function toEntry(g: StoredGeneration): SessionEntry {
  const { png, stencil, sourceCrop, ...rest } = g;
  return {
    ...rest,
    pngUrl: URL.createObjectURL(png),
    stencilUrl: URL.createObjectURL(stencil),
    sourceCropUrl: URL.createObjectURL(sourceCrop),
  };
}

/** Same calendar day as now, which is what "today" means on the strip. */
export function isToday(ts: number): boolean {
  const d = new Date(ts), n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}
