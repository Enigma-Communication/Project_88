"use client";

import { useEffect, useState } from "react";

/**
 * The animated PROJECT 88 lockup.
 *
 * Three supplied frames, each the same wordmark with a different player struck
 * over the 88. Cycled as a flip-book rather than cross-faded: the figures are
 * different poses, not a tween, so dissolving between them reads as a smudge
 * where a hard cut reads as a sequence.
 *
 * All three are rendered and toggled on opacity so the browser never shows a
 * frame it has not decoded, and the box is sized from the source so nothing
 * reflows as they swap.
 *
 * The source PNGs carried 46px of transparent padding on the left, which sat
 * the wordmark visibly inboard of the text beneath it. All three have the same
 * content bounds, so they are cropped to that union — 570 x 158 — which both
 * aligns the lockup to the column and lets it fill the width.
 */
const FRAMES = ["/lockup/frame-1.png", "/lockup/frame-2.png", "/lockup/frame-3.png"];
const HOLD_MS = 2000;

export default function Lockup({ className = "" }: { className?: string }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setI((n) => (n + 1) % FRAMES.length), HOLD_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={`relative aspect-[570/158] ${className}`} role="img" aria-label="Project 88">
      {FRAMES.map((src, n) => (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          key={src}
          src={src}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-contain"
          style={{ opacity: n === i ? 1 : 0 }}
        />
      ))}
    </div>
  );
}
