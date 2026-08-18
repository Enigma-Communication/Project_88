"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type Box = { left: number; top: number; width: number; height: number };
type Source = { width: number; height: number };

type Drag =
  | { kind: "move"; startX: number; startY: number; orig: Box }
  | { kind: "resize"; corner: "nw" | "ne" | "sw" | "se"; startX: number; startY: number; orig: Box }
  | null;

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
 */
export default function CropBox({
  src, source, box, onChange,
}: { src: string; source: Source; box: Box; onChange: (b: Box) => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [drag, setDrag] = useState<Drag>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setScale(el.clientWidth / source.width);
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

    const point = (e: PointerEvent) => ({ x: e.clientX, y: e.clientY });

    const onMove = (e: PointerEvent) => {
      const p = point(e);
      const dx = (p.x - drag.startX) / scale;
      const dy = (p.y - drag.startY) / scale;

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
    { c: "nw", style: { left: -7, top: -7 }, cursor: "nwse-resize" },
    { c: "ne", style: { right: -7, top: -7 }, cursor: "nesw-resize" },
    { c: "sw", style: { left: -7, bottom: -7 }, cursor: "nesw-resize" },
    { c: "se", style: { right: -7, bottom: -7 }, cursor: "nwse-resize" },
  ];

  return (
    <div ref={wrapRef} className="relative select-none overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Source photo" className="block w-full" draggable={false} />

      {/* dim everything outside the crop */}
      <div className="pointer-events-none absolute inset-0 bg-black/55"
           style={{ clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${px(box.left)} ${px(box.top)}, ${px(box.left)} ${px(box.top + box.height)}, ${px(box.left + box.width)} ${px(box.top + box.height)}, ${px(box.left + box.width)} ${px(box.top)}, ${px(box.left)} ${px(box.top)})` }} />

      <div
        className="absolute cursor-move border-2 border-[#D82020] shadow-[0_0_0_9999px_rgba(0,0,0,0)]"
        style={{ left: px(box.left), top: px(box.top), width: px(box.width), height: px(box.height) }}
        onPointerDown={(e) => { e.preventDefault(); setDrag({ kind: "move", startX: e.clientX, startY: e.clientY, orig: box }); }}
      >
        {corners.map(({ c, style, cursor }) => (
          <span
            key={c}
            onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); setDrag({ kind: "resize", corner: c, startX: e.clientX, startY: e.clientY, orig: box }); }}
            className="absolute h-3.5 w-3.5 rounded-full border-2 border-white bg-[#D82020]"
            style={{ ...style, cursor, touchAction: "none" }}
          />
        ))}
      </div>
    </div>
  );
}
