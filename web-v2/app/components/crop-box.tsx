"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Box } from "../lib/types";

type Source = { width: number; height: number };

type Drag =
  | { kind: "move"; startX: number; startY: number; orig: Box }
  | { kind: "resize"; corner: "nw" | "ne" | "sw" | "se"; startX: number; startY: number; orig: Box }
  | null;

/*
 * Handle size lives in CSS (--crop-handle) so it can grow on coarse pointers:
 * 22px as board 03 draws it, 30px under a finger. The offsets are calc()'d off
 * the same variable so the handle stays centred on the corner at either size.
 */
const HALF = "calc(var(--crop-handle) / -2)";

/**
 * Crop-to-subject UI. The proposed box comes pre-drawn from the vision pass;
 * the operator adjusts it.
 *
 * This is the one piece of real interaction in the app and it carries the
 * output quality — the recurring failure in the test photos is another player
 * overlapping the athlete, which is a framing problem, not a model problem.
 *
 * Box coordinates are always in SOURCE pixels; the overlay converts to
 * displayed pixels via a single scale factor.
 *
 * Three fixes over v1:
 *  - touch-action:none sits on the whole surface rather than only the four
 *    handles, so dragging the box on iOS moves the box instead of scrolling
 *    the page out from under your thumb (board 03).
 *  - rule-of-thirds guides, because "tighten the crop" is useless without
 *    something to tighten it against (board 03).
 *  - the image is capped by height. A portrait frame at full container width
 *    pushed the bottom two handles below the fold, and with page scrolling
 *    suppressed on the surface they were unreachable.
 */
export default function CropBox({
  src, source, box, label, onChange,
}: {
  src: string;
  source: Source;
  box: Box;
  label: string;
  onChange: (b: Box) => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [scale, setScale] = useState(0);
  const [drag, setDrag] = useState<Drag>(null);

  /** Scale comes off the rendered image, not its container — see above. */
  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;
    const measure = () => { if (el.clientWidth) setScale(el.clientWidth / source.width); };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [source.width]);

  const clamp = useCallback((b: Box): Box => {
    const width = Math.max(80, Math.min(b.width, source.width));
    const height = Math.max(80, Math.min(b.height, source.height));
    return {
      width, height,
      left: Math.max(0, Math.min(b.left, source.width - width)),
      top: Math.max(0, Math.min(b.top, source.height - height)),
    };
  }, [source]);

  useEffect(() => {
    if (!drag) return;

    const onMove = (e: PointerEvent) => {
      const dx = (e.clientX - drag.startX) / scale;
      const dy = (e.clientY - drag.startY) / scale;

      if (drag.kind === "move") {
        onChange(clamp({ ...drag.orig, left: drag.orig.left + dx, top: drag.orig.top + dy }));
        return;
      }
      const o = drag.orig;
      let { left, top, width, height } = o;
      if (drag.corner === "se") { width = o.width + dx; height = o.height + dy; }
      if (drag.corner === "sw") { left = o.left + dx; width = o.width - dx; height = o.height + dy; }
      if (drag.corner === "ne") { top = o.top + dy; width = o.width + dx; height = o.height - dy; }
      if (drag.corner === "nw") { left = o.left + dx; top = o.top + dy; width = o.width - dx; height = o.height - dy; }
      onChange(clamp({ left, top, width, height }));
    };

    const stop = () => setDrag(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, [drag, scale, clamp, onChange]);

  const px = (v: number) => `${v * scale}px`;
  const corners: Array<{ c: "nw" | "ne" | "sw" | "se"; style: React.CSSProperties; cursor: string }> = [
    { c: "nw", style: { left: HALF, top: HALF }, cursor: "nwse-resize" },
    { c: "ne", style: { right: HALF, top: HALF }, cursor: "nesw-resize" },
    { c: "sw", style: { left: HALF, bottom: HALF }, cursor: "nesw-resize" },
    { c: "se", style: { right: HALF, bottom: HALF }, cursor: "nwse-resize" },
  ];

  const clip = `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${px(box.left)} ${px(box.top)}, ${px(box.left)} ${px(box.top + box.height)}, ${px(box.left + box.width)} ${px(box.top + box.height)}, ${px(box.left + box.width)} ${px(box.top)}, ${px(box.left)} ${px(box.top)})`;

  return (
    <div className="flex justify-center rounded-sm border border-hairline bg-black">
      <div className="relative select-none" style={{ touchAction: "none" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={src}
          alt="Source photo"
          className="block max-h-[min(56vh,720px)] w-auto max-w-full lg:max-h-[min(68vh,720px)]"
          onLoad={(e) => setScale(e.currentTarget.clientWidth / source.width)}
          draggable={false}
        />

        {scale > 0 && (
          <>
            {/* dim everything outside the crop */}
            <div className="pointer-events-none absolute inset-0 bg-black/60" style={{ clipPath: clip }} />

            <div
              className="absolute cursor-move border-2 border-ink"
              style={{ left: px(box.left), top: px(box.top), width: px(box.width), height: px(box.height) }}
              onPointerDown={(e) => {
                e.preventDefault();
                setDrag({ kind: "move", startX: e.clientX, startY: e.clientY, orig: box });
              }}
            >
              {/* rule of thirds, so there is something to tighten against */}
              <div className="pointer-events-none absolute inset-0">
                <span className="absolute left-1/3 top-0 h-full w-px bg-white/20" />
                <span className="absolute left-2/3 top-0 h-full w-px bg-white/20" />
                <span className="absolute left-0 top-1/3 h-px w-full bg-white/20" />
                <span className="absolute left-0 top-2/3 h-px w-full bg-white/20" />
              </div>

              <span className="label pointer-events-none absolute -top-[24px] left-0 whitespace-nowrap rounded-t-[3px] bg-ink px-2 py-1.5 text-[10px] text-white">
                {label}
              </span>

              {corners.map(({ c, style, cursor }) => (
                <span
                  key={c}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setDrag({ kind: "resize", corner: c, startX: e.clientX, startY: e.clientY, orig: box });
                  }}
                  className="absolute rounded-full border-2 border-white bg-ink"
                  style={{ ...style, width: "var(--crop-handle)", height: "var(--crop-handle)", cursor, touchAction: "none" }}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
