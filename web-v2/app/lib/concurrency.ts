/**
 * Run tasks N at a time, reporting each as it lands.
 *
 * The tray preflights every photo on drop, and a 40-photo card is 40 vision
 * calls. Sequential is ~2s each and takes a minute and a half; unbounded
 * fires 40 concurrent requests at the API and at sharp. Five in flight keeps
 * a 40-photo batch around fifteen seconds without either end falling over.
 */
export async function pool<T, R>(
  items: T[],
  limit: number,
  run: (item: T, index: number) => Promise<R>,
  onSettled?: (item: T, index: number, result: R | null, error: unknown) => void,
): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      try {
        const r = await run(items[i], i);
        onSettled?.(items[i], i, r, null);
      } catch (e) {
        onSettled?.(items[i], i, null, e);
      }
    }
  });
  await Promise.all(workers);
}
