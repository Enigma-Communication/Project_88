"use client";

import type { SessionEntry } from "../lib/session";

/**
 * The session strip — the fix for the worst CX bug in the v1 build.
 *
 * Close the tab there and every paid generation is gone. Held in IndexedDB on
 * the device, which is what "no accounts, single shared password" allows.
 *
 * It renders on the start screen as well as the result screen, deliberately.
 * Persisting the work is only half the promise: if the strip only appeared
 * after the next generation, then reopening the tab on Sunday morning would
 * still look exactly like losing everything, and the operator would have no
 * way back to Saturday's files.
 */
export default function SessionStrip({
  session, caption, onPick,
}: { session: SessionEntry[]; caption?: string; onPick: (e: SessionEntry) => void }) {
  if (session.length === 0) return null;

  return (
    <section className="mt-12">
      {/*
        The source filename is the first thing to go when space is tight — it
        is the least useful item here and the longest, and letting it wrap
        broke the rule and stacked the header into three lines on a phone.
      */}
      <div className="flex items-center gap-3 sm:gap-4">
        <span className="eyebrow shrink-0 text-[10px] text-body">Today</span>
        <span className="label label-reg shrink-0 whitespace-nowrap text-[10px] text-muted">
          {session.length} generation{session.length === 1 ? "" : "s"}
        </span>
        <span className="label label-reg hidden shrink-0 whitespace-nowrap text-[10px] text-muted sm:inline">
          kept on this device
        </span>
        <span className="h-px min-w-4 flex-1 bg-hairline" />
        {caption && (
          <span className="meta hidden max-w-[280px] truncate text-[10px] text-[#4d4b47] lg:inline">{caption}</span>
        )}
      </div>

      <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
        {session.map((g) => (
          <button
            key={g.id}
            onClick={() => onPick(g)}
            className="h-[96px] w-[86px] shrink-0 overflow-hidden rounded-[4px] border border-hairline transition hover:border-edge"
            style={{ background: "#F5F0E8" }}
            title={[
              g.sourceName,
              new Date(g.createdAt).toLocaleTimeString(),
              // only when a mount was recorded — old entries predate it, and
              // "mount undefined" on a hover is worse than saying nothing
              g.mount === undefined ? null : `mount ${g.mount === 0 ? "off" : g.mount.toFixed(2)}`,
            ].filter(Boolean).join(" · ")}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={g.pngUrl} alt="" className="h-full w-full object-contain p-1.5" />
          </button>
        ))}
      </div>
    </section>
  );
}
