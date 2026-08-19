"use client";

import type { TrayItem } from "../lib/types";

/**
 * The batch, ranked by the preflight pass.
 *
 * Photos arrive as a card off the sideline, not one at a time, so the tray is
 * the shape of the real job. Preflight already ranks — this makes the ranking
 * visible, and the same component becomes the session history later.
 *
 * Items sort as their verdicts land, so the strip re-orders under you while
 * the calls are still in flight. That is deliberate: the best frame floats to
 * the front without anyone reading a list.
 */
const CHIP = {
  READY: { text: "Ready", dot: "bg-emerald-400", ring: "ring-emerald-400/30" },
  "NEEDS CROP": { text: "Crop", dot: "bg-amber-400", ring: "ring-amber-400/30" },
  "NOT SUITABLE": { text: "Skip", dot: "bg-ink", ring: "ring-ink/30" },
} as const;

const RANK = { READY: 0, "NEEDS CROP": 1, "NOT SUITABLE": 2 } as const;

export function rankTray(items: TrayItem[]): TrayItem[] {
  return [...items].sort((a, b) => {
    const av = a.pre ? RANK[a.pre.verdict] : 3;
    const bv = b.pre ? RANK[b.pre.verdict] : 3;
    if (av !== bv) return av - bv;
    // within a verdict, the bigger subject upscales better
    return (b.pre?.subjectPx ?? 0) - (a.pre?.subjectPx ?? 0);
  });
}

export default function Tray({
  items, activeId, onPick,
}: { items: TrayItem[]; activeId: string | null; onPick: (id: string) => void }) {
  const checking = items.filter((i) => i.state === "checking" || i.state === "waiting").length;

  return (
    <section className="mt-10">
      <div className="flex items-center gap-4">
        <span className="eyebrow text-[10px] text-body">This batch</span>
        <span className="label label-reg text-[10px] text-muted">{items.length} photo{items.length === 1 ? "" : "s"}</span>
        <span className="label label-reg text-[10px] text-muted">
          {checking > 0 ? `checking ${checking}…` : "ranked by the preflight pass"}
        </span>
        <span className="h-px flex-1 bg-hairline" />
      </div>

      <div className="mt-4 flex gap-3 overflow-x-auto pb-3">
        {items.map((it) => {
          const chip = it.pre ? CHIP[it.pre.verdict] : null;
          const active = it.id === activeId;
          return (
            <button
              key={it.id}
              onClick={() => onPick(it.id)}
              className={`group relative h-[86px] w-[124px] shrink-0 overflow-hidden rounded-[4px] border transition ${
                active ? "border-ink" : "border-hairline hover:border-edge"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.thumbUrl} alt="" className="h-full w-full object-cover" />
              <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />

              {it.state === "checking" && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <span className="pulse-dot h-2 w-2 rounded-full bg-white" />
                </span>
              )}

              {chip && (
                <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1.5 rounded-sm bg-black/80 px-1.5 py-1">
                  <span className={`h-1.5 w-1.5 rounded-full ${chip.dot}`} />
                  <span className="eyebrow text-[9px] text-white">{chip.text}</span>
                </span>
              )}

              {it.state === "failed" && (
                <span className="absolute bottom-1.5 left-1.5 rounded-sm bg-black/80 px-1.5 py-1">
                  <span className="eyebrow text-[9px] text-muted">Failed</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
