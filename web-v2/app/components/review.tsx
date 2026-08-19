"use client";

import CropBox from "./crop-box";
import { verdictCopy } from "../lib/verdict-copy";
import type { Box, TrayItem } from "../lib/types";

/**
 * Board 03. The quality-carrying screen.
 *
 * The crop box is the single biggest lever on output quality — the recurring
 * failure across the test photos is another player overlapping the subject,
 * which is a framing problem, not a model problem. So it gets the whole left
 * side, and the verdict beside it says one thing and asks for one action.
 *
 * The metrics the v1 build showed at equal weight are the art director's
 * data, not the operator's: they go in a disclosure, closed by default.
 */
/* The amber the file actually specifies: #2A1F0B ground, #E8A33D at 35% edge. */
const TONE = {
  READY: "border-emerald-500/30 bg-emerald-950/40",
  "NEEDS CROP": "border-warn/35 bg-warn-bg",
  "NOT SUITABLE": "border-core-red/35 bg-[#2a0b0b]",
} as const;

const DOT = {
  READY: "bg-emerald-400",
  "NEEDS CROP": "bg-warn",
  "NOT SUITABLE": "bg-core-red",
} as const;

const CHIP_TEXT = {
  READY: "text-emerald-400",
  "NEEDS CROP": "text-warn",
  "NOT SUITABLE": "text-core-red",
} as const;

export default function Review({
  item, index, total, box, onBox, onGenerate, onSkip, onResetCrop,
}: {
  item: TrayItem;
  index: number;
  total: number;
  box: Box;
  onBox: (b: Box) => void;
  onGenerate: () => void;
  onSkip: () => void;
  onResetCrop: () => void;
}) {
  const pre = item.pre;
  if (!pre) return null;

  const copy = verdictCopy(pre);
  const moved =
    Math.round(box.left) !== Math.round(pre.box.left) ||
    Math.round(box.top) !== Math.round(pre.box.top) ||
    Math.round(box.width) !== Math.round(pre.box.width) ||
    Math.round(box.height) !== Math.round(pre.box.height);

  return (
    <section className="grid gap-6 pb-32 lg:grid-cols-[minmax(0,856fr)_448px] lg:gap-[40px] lg:pb-0">
      <div>
        <CropBox
          src={item.thumbUrl}
          source={pre.source}
          box={box}
          label="Drag to crop"
          onChange={onBox}
        />
        <p className="label label-reg mt-3 text-[10px] leading-[1.6] text-muted lg:mt-[18px]">
          <span className="lg:hidden">Drag the box &nbsp;·&nbsp; corners resize &nbsp;·&nbsp; inside the box is what gets drawn</span>
          <span className="hidden lg:inline">Drag to move &nbsp;·&nbsp; corners to resize &nbsp;·&nbsp; pinch to zoom &nbsp;·&nbsp; everything inside the box is what gets drawn</span>
        </p>
        {moved && (
          <button onClick={onResetCrop} className="btn mt-[14px] text-[10px] font-normal text-ink transition hover:brightness-125">
            Reset to suggested crop
          </button>
        )}
      </div>

      <div>
        <p className="eyebrow label-reg text-[10px] leading-[1.6] text-muted">
          Photo {index + 1} of {total} &nbsp;·&nbsp; {item.name}
        </p>

        <div className={`mt-4 rounded-[8px] border px-[20px] pb-[20px] pt-[18px] ${TONE[pre.verdict]}`}>
          <span className="flex items-center gap-[10px]">
            <span className={`h-[9px] w-[9px] shrink-0 rounded-full ${DOT[pre.verdict]}`} />
            <span className={`eyebrow trim text-[10px] ${CHIP_TEXT[pre.verdict]}`}>{copy.chip}</span>
          </span>
          <h2 className="mt-[10px] text-[14px] font-bold leading-[1.4] tracking-[-0.01em] text-bright">{copy.finding}</h2>
          <p className="mt-[10px] text-[12px] leading-[22px] text-body">{copy.instruction}</p>
        </div>

        {/*
          Desktop keeps the commit action in the rail beside the crop. On a
          phone it moves to the fixed bar below — see the bottom of this file.
        */}
        <div className="hidden lg:block">
          <button
            onClick={onGenerate}
            className="btn mt-4 w-full whitespace-nowrap rounded-[6px] bg-ink py-[19px] text-white transition hover:brightness-110"
          >
            Generate illustration
          </button>
          <p className="label mt-4 text-center text-[10px] text-muted">About 20 seconds</p>

          <button onClick={onSkip} className="btn mt-4 block w-full text-center text-[10px] text-white transition hover:opacity-70">
            Skip to the next photo →
          </button>
        </div>

        {/*
          The AD's numbers. Real, and useful when a result comes out wrong —
          but they are diagnostics, and at equal weight they competed with the
          one sentence that actually tells the operator what to do.
        */}
        <details open className="group mt-4 border-t border-hairline pt-4">
          <summary className="eyebrow cursor-pointer list-none text-[10px] text-white transition hover:opacity-70">
            <span className="inline-block transition group-open:rotate-90">›</span> What the preflight saw
          </summary>
          <dl className="mt-[14px]">
            <Row k="People in frame" v={String(pre.people)} />
            <Row k="Overlapping the subject" v={String(pre.overlaps)} />
            <Row k="Face" v={pre.faceVisibility} />
            <Row k="Motion" v={pre.motion} />
            <Row k="Cut off by the frame" v={pre.figureCutOff ? "yes" : "no"} />
            <Row k="Subject height" v={`${pre.subjectPx} px`} />
            <Row k="Source" v={`${pre.source.width} × ${pre.source.height}`} />
          </dl>
          {pre.notes && <p className="meta mt-[14px] text-[11px] leading-[1.6] text-muted">{pre.notes}</p>}
        </details>
      </div>

      {/*
        The phone's commit bar.
        
        On a small screen the crop canvas, the hint, the verdict and the
        disclosure all sit above the fold, which pushed Generate off the bottom
        — you had to scroll past the thing you were judging to act on it. Every
        touch editor solves this the same way: the canvas owns the screen and
        the commit action is pinned. It carries the cost line with it, so the
        one number that matters is never separated from the button that spends
        it, and it respects the home-indicator inset.
      */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-pitch/95 px-5 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">
        <button
          onClick={onGenerate}
          className="btn w-full whitespace-nowrap rounded-[6px] bg-ink py-[18px] text-white transition hover:brightness-110"
        >
          Generate illustration
        </button>
        <div className="mt-2.5 flex items-center justify-between">
          <span className="label label-reg text-[10px] text-muted">About 20 seconds</span>
          <button onClick={onSkip} className="btn text-[10px] text-white transition hover:opacity-70">
            Skip to the next photo →
          </button>
        </div>
      </div>
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-[7px]">
      <dt className="meta text-[11px] leading-[1.5] text-muted">{k}</dt>
      <dd className="meta text-[11px] leading-[1.5] text-body">{v}</dd>
    </div>
  );
}
