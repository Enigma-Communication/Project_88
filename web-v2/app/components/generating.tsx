"use client";

import { useEffect, useState } from "react";

/**
 * Board 04. The wait, narrated.
 *
 * A spinner is not a progress indicator, and this is the longest moment in
 * the product. The four stages are the actual pipeline, so naming them costs
 * nothing and turns dead time into evidence that something skilled is
 * happening.
 *
 * On honesty, because it matters more than the animation:
 *  - Stages 1 and 2 are genuinely complete before this screen mounts. The
 *    vision pass really did run, and its elapsed time is measured, not made
 *    up.
 *  - Stage 3 is the model, and Gemini returns one finished image with no
 *    partial output and no progress events. So the bar is a countdown against
 *    a known duration, not a percentage of real work. It is capped short of
 *    the end and stalls there rather than sitting at 100% while you wait.
 *  - Stage 4 is the ink separation, which happens server-side after the model
 *    returns. Reaching it means the model is late, which is true and worth
 *    showing.
 *  - The wipe plays once, on arrival, over the crop the model was given. It
 *    is a reveal of a finished image, not a render in progress.
 *
 * The board also carried "safe to lock your phone". It is cut: backgrounding
 * the tab on iOS kills the fetch and bins a paid generation, and the fix is a
 * server-side job with polling rather than a line of copy.
 */
const DRAW_MS = 18_000; // typical; the AD's runs land 10-25s

const STAGES = [
  { key: "read", title: "Read the photo", note: (ms: number) => `the vision pass, ${(ms / 1000).toFixed(1)}s` },
  { key: "frame", title: "Framed the player", note: () => "your crop, upscaled to 1280px" },
  { key: "draw", title: "Drawing the ink", note: () => "usually 10 – 25 seconds" },
  { key: "plate", title: "Separating the plate", note: () => "white keyed out, stencil built" },
] as const;

export default function Generating({
  sourceCropUrl, resultUrl, preflightMs, onCancel,
}: {
  sourceCropUrl: string;
  resultUrl: string | null;
  preflightMs: number;
  onCancel: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const t0 = performance.now();
    const id = setInterval(() => setElapsed(performance.now() - t0), 100);
    return () => clearInterval(id);
  }, []);

  // stage 0 and 1 are already done; 2 is the model, 3 means it has run long
  const active = resultUrl ? 4 : elapsed < DRAW_MS ? 2 : 3;
  const pct = resultUrl ? 100 : Math.min(92, (elapsed / DRAW_MS) * 92);
  const left = Math.max(0, Math.ceil((DRAW_MS - elapsed) / 1000));

  return (
    <div className="mx-auto max-w-[760px] px-5 py-10 sm:px-8 lg:py-12">
      <p className="eyebrow flex items-center justify-center text-[14px] leading-[1.4] text-ink">
        {resultUrl ? "Done" : "Drawing"}
        {!resultUrl && (
          <span aria-hidden className="ml-[2px] inline-flex">
            {[0, 1, 2].map((n) => (
              <span key={n} className="ellipsis-dot" style={{ animationDelay: `${n * 160}ms` }}>.</span>
            ))}
          </span>
        )}
      </p>

      <div className="relative mx-auto mt-8 w-full max-w-[420px] overflow-hidden rounded-[4px] bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={sourceCropUrl} alt="" className="block w-full opacity-80" />

        {resultUrl && (
          <>
            <div className="wipe absolute inset-0 bg-paper">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={resultUrl} alt="Generated illustration" className="h-full w-full object-contain" />
            </div>
            <span className="wipe-line absolute left-0 h-[3px] w-full bg-ink" />
          </>
        )}
      </div>

      <div className="mt-9 h-[3px] w-full overflow-hidden rounded-full bg-hairline">
        <div className="h-full bg-ink transition-[width] duration-200 ease-linear" style={{ width: `${pct}%` }} />
      </div>

      <ol className="mt-7 space-y-4">
        {STAGES.map((s, i) => {
          const done = i < active;
          const now = i === active;
          return (
            <li key={s.key} className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
              <span
                className={`h-2 w-2 shrink-0 translate-y-[-1px] rounded-full ${
                  now ? "bg-ink pulse-dot" : done ? "bg-muted" : "border border-hairline"
                }`}
              />
              <span className={`flex-1 text-[13px] ${now ? "font-bold text-bright" : done ? "text-body" : "text-muted"}`}>
                {s.title}
              </span>
              <span className="meta text-[10px] text-muted">{s.note(preflightMs)}</span>
            </li>
          );
        })}
      </ol>

      <div className="mt-7 flex items-baseline justify-between">
        <p className="meta text-[10px] text-muted">
          {resultUrl
            ? "Kept in today's session."
            : active === 3
              ? "Running long — still going."
              : `About ${left} seconds left.`}
        </p>
        {!resultUrl && (
          <button onClick={onCancel} className="btn text-[10px] text-ink transition hover:brightness-125">
            Stop waiting
          </button>
        )}
      </div>
      {!resultUrl && (
        <p className="meta mt-2 text-[10px] text-[#4d4b47]">
          Stopping frees the screen. It cannot un-bill a generation already in flight.
        </p>
      )}
    </div>
  );
}
