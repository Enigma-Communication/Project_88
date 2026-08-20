"use client";

import { useRef } from "react";
import type { TrayItem } from "../lib/types";
import { imageFiles, MAX_BATCH } from "../lib/files";

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
  items, activeId, adding, notice, onPick, onAdd, onRemove, onDismissNotice,
}: {
  items: TrayItem[];
  activeId: string | null;
  /** files are being decoded and downscaled, before any tile exists for them */
  adding?: boolean;
  /** batch-level message, e.g. the cap turning some of a drop away */
  notice?: string | null;
  onPick: (id: string) => void;
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
  onDismissNotice?: () => void;
}) {
  const addRef = useRef<HTMLInputElement>(null);
  const checking = items.filter((i) => i.state === "checking" || i.state === "waiting").length;
  const full = items.length >= MAX_BATCH;

  const status = adding
    ? "adding…"
    : checking > 0
      ? `checking ${checking}…`
      : "ranked by the preflight pass";

  return (
    <section className="mt-10">
      <div className="flex items-center gap-4">
        <span className="eyebrow text-[10px] text-body">This batch</span>
        <span className="label label-reg text-[10px] text-muted">{items.length} photo{items.length === 1 ? "" : "s"}</span>
        <span className="label label-reg text-[10px] text-muted">{status}</span>
        {/*
          Says why the add tile is gone. Without it the control simply vanishes
          at the fortieth photo, which reads as a bug rather than a limit.
        */}
        {full && (
          <span className="label label-reg text-[10px] text-warn">full · {MAX_BATCH} max</span>
        )}
        <span className="h-px flex-1 bg-hairline" />
      </div>

      {/*
        Sits with the tray rather than in the page's error banner: it is a note
        about the batch, not a failed generation, and the banner's heading says
        otherwise.
      */}
      {notice && (
        <p className="mt-3 flex items-center gap-3 text-[12px] leading-[20px] text-warn">
          {notice}
          {onDismissNotice && (
            <button onClick={onDismissNotice} className="eyebrow text-[9px] text-muted underline hover:text-body">
              dismiss
            </button>
          )}
        </p>
      )}

      <div className="mt-4 flex gap-3 overflow-x-auto pb-3">
        {/*
          First, not last. The operator who needs this has one photo in the tray
          and is looking at the left-hand end of the strip — putting it after
          the batch would hide it off-screen at exactly the point a long batch
          makes it hardest to find.
        */}
        {!full && (
          <label
            className="group flex h-[86px] w-[124px] shrink-0 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[4px] border border-dashed border-edge transition hover:border-ink"
            title="Add more photos to this batch"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4 text-muted transition group-hover:text-ink" aria-hidden="true">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="eyebrow text-[9px] text-muted transition group-hover:text-ink">Add photos</span>
            <input
              ref={addRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = imageFiles(e.target.files);
                // reset first: picking the same file twice in a row fires no
                // change event otherwise, and the second add silently does nothing
                e.target.value = "";
                if (files.length) onAdd(files);
              }}
            />
          </label>
        )}

        {items.map((it) => {
          const chip = it.pre ? CHIP[it.pre.verdict] : null;
          const active = it.id === activeId;
          const busy = it.state === "waiting" || it.state === "checking";
          return (
            <div
              key={it.id}
              className={`group relative h-[86px] w-[124px] shrink-0 overflow-hidden rounded-[4px] border transition ${
                active ? "border-ink" : "border-hairline hover:border-edge"
              }`}
            >
              {/*
                A div wrapping two buttons rather than one button containing
                another: a nested button is invalid, and React quietly renders
                it while the inner click stops working on some browsers.
              */}
              <button onClick={() => onPick(it.id)} className="block h-full w-full" title={it.name}>
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

              {/*
                Held back while the photo is still being checked — removing an
                item mid-flight would leave its preflight response landing on a
                tray that no longer has anywhere to put it.

                Visible rather than hover-only. This is a touch app first, and a
                control that only exists on hover does not exist on a phone.
              */}
              {!busy && (
                <button
                  onClick={() => onRemove(it.id)}
                  aria-label={`Remove ${it.name}`}
                  title="Remove from batch"
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-sm bg-black/70 text-white/70 opacity-80 transition hover:bg-core-red hover:text-white hover:opacity-100 focus-visible:opacity-100"
                >
                  <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" aria-hidden="true">
                    <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
