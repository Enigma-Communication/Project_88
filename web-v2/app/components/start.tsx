"use client";

import { useEffect, useRef, useState } from "react";
import { imageFiles, MAX_BATCH } from "../lib/files";

/**
 * Board 02. The output is the onboarding.
 *
 * The v1 empty state was a dashed box and a camera emoji, so a first-time
 * user had no target in their head and no way to judge their own photo.
 * Four finished results do that job without a tour, a modal, or a line of
 * copy anyone has to read.
 *
 * Geometry is taken from the file rather than eyeballed. Board 02 runs on an
 * 88px margin with a 1264px column — wider than boards 03-05, which sit at 48.
 *
 * The amended layout is a two-column top block, 477px tall and vertically
 * centred: a 515px hero column on the left, the dropzone taking the rest on
 * the right with the guidance chips centred beneath it. THE RESULT row then
 * runs the full width below, on the same 16px rhythm with a 32px spacer above.
 */

/*
 * The four examples straight out of the Figma file — the exact assets on
 * board 02, not stand-ins chosen from `example images/`.
 *
 * They are transparent one-colour PNGs, so the tile background is what gives
 * each its surface. That is the point of the row: same pipeline, four surfaces
 * the club actually publishes on. Tile 2 is a white stencil, which only exists
 * as a real file here — the local folder had a red one.
 *
 * Downloaded and committed rather than hotlinked: Figma's asset URLs expire
 * after about a week.
 */
const EXAMPLES = [
  { src: "/examples/fig-01.png", kind: "Standard fill", on: "on paper", bg: "#F5F0E8", border: false },
  { src: "/examples/fig-02.png", kind: "Stencil", on: "on black", bg: "#0D0D0F", border: true },
  { src: "/examples/fig-03.png", kind: "Standard fill", on: "on club navy", bg: "#001A5C", border: false },
  { src: "/examples/fig-04.png", kind: "Standard fill", on: "on paper", bg: "#F5F0E8", border: false },
];

/**
 * Replaces "one athlete works best" with what the test set actually showed,
 * including the counter-intuitive middle case: a turned-away face is fine,
 * because pose carries the likeness.
 */
const CHIPS = [
  { tone: "good", label: "(Bradman) Best", text: "One player, big in frame" },
  { tone: "ok", label: "Fine", text: "Not facing camera, all action" },
  { tone: "bad", label: "Hard", text: "Busy frame, blocking player" },
];

const DOT = { good: "bg-emerald-400", ok: "bg-warn", bad: "bg-core-red" } as const;

function ExampleTile({ ex }: { ex: (typeof EXAMPLES)[number] }) {
  return (
    <figure>
      <div
        className={`aspect-[304/330] overflow-hidden rounded-[4px] ${ex.border ? "border border-hairline" : ""}`}
        style={{ background: ex.bg }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ex.src} alt="" className="h-full w-full object-contain px-[8%] py-[6.7%]" />
      </div>
      {/*
        The file sets these in Archivo Medium + IBM Plex Mono; on request they
        are PP Formula Extended instead, so the caption row sits in the same
        family as the rest of the UI.
      */}
      <figcaption className="mt-[10px] flex items-baseline gap-2">
        <span className="meta whitespace-nowrap text-[11px] text-body sm:text-[13px]">{ex.kind}</span>
        <span className="meta whitespace-nowrap text-[10px] text-muted sm:text-[11px]">{ex.on}</span>
      </figcaption>
    </figure>
  );
}

function Chip({ c }: { c: (typeof CHIPS)[number] }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-[4px] border border-hairline bg-panel py-2 pl-3 pr-3.5">
      <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${DOT[c.tone as keyof typeof DOT]}`} />
      <span className="display trim shrink-0 text-[18px] text-white">{c.label}</span>
      <span className="meta text-[10px] leading-none text-muted">{c.text}</span>
    </span>
  );
}

/**
 * The dropzone's loading state (board 22:393).
 *
 * Same shell — the dashed Core Red box never moves — with the buttons swapped
 * for one illustration and a line of copy. Keeping the operator on the home
 * screen while the batch is read is the point: the previous build jumped
 * straight to the review screen and sat there empty, because there is nothing
 * to review until the first vision pass returns.
 *
 * The illustration cycles through the four examples below it, which is free —
 * they are already downloaded and on screen — and turns a blank wait into the
 * thing the tool makes. Held still for anyone who asked for reduced motion.
 */
function LoadingPlate() {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setI((n) => (n + 1) % EXAMPLES.length), 420);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <div className="relative h-[115.4px] w-[101.7px]">
        {/*
          All four are rendered and cross-faded on opacity rather than swapped
          by src, so the browser never has a frame with nothing decoded in it.
        */}
        {EXAMPLES.map((ex, n) => (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            key={ex.src}
            src={ex.src}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-contain transition-opacity duration-200"
            style={{ opacity: n === i ? 1 : 0 }}
          />
        ))}
      </div>
      {/* the double space after the comma is deliberate — it is in the file too */}
      <p className="meta text-[10px] uppercase text-muted" role="status">
        Loading image(s),&nbsp; relax…
      </p>
    </>
  );
}

export default function Start({
  onFiles, loading = false, children,
}: { onFiles: (files: File[]) => void; loading?: boolean; children?: React.ReactNode }) {
  const chooseRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [chip, setChip] = useState(0);
  const railRef = useRef<HTMLDivElement>(null);
  const [slide, setSlide] = useState(0);

  /*
   * The guidance key fades between its three entries on a phone, where three
   * stacked full-width chips cost more vertical space than they are worth.
   * Desktop still shows all three at once, as the file does. Held on the first
   * entry for anyone who asked for reduced motion.
   */
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setChip((n) => (n + 1) % CHIPS.length), 3200);
    return () => clearInterval(id);
  }, []);

  const take = (list: FileList | null) => {
    const files = imageFiles(list);
    if (files.length) onFiles(files);
  };

  return (
    <div className="mx-auto max-w-[1440px] px-5 pb-16 pt-8 sm:px-8 lg:px-[88px] lg:pt-[34px]">
      {/*
        The top block: 515px hero column, 16px gutter, dropzone taking the
        remainder. Both sides are centred against a 477px row, which is what
        puts the hero's optical centre level with the dropzone's.
      */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="flex w-full flex-col gap-4 lg:w-[515px] lg:shrink-0">
          {/*
            101px, leading 0.83, tracking -0.025em, in a 504px column — which
            measures 504 x 251 against the file's 504 x 252.

            The breaks are explicit. The file lets one string wrap naturally,
            but the browser's metrics put "an" on the second line where Figma
            drops it to the third, so the shape only matches if it is set.
          */}
          <h1 className="display mx-auto max-w-[504px] text-center text-[clamp(3.4rem,13vw,101px)] text-white lg:mx-0 lg:text-left">
            Turn a match<br />photo into<br />an <span className="font-grit">accent</span>
          </h1>
          <p className="label text-center text-[11px] leading-[20px] text-body lg:text-left lg:text-[14px] lg:leading-[28px]">
            Drop in the whole batch, not just one.
          </p>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-4 lg:h-[477px]">
          <div
            onDragOver={(e) => { if (!loading) e.preventDefault(); }}
            onDrop={(e) => { if (loading) return; e.preventDefault(); take(e.dataTransfer.files); }}
            className={`relative flex min-h-[280px] flex-1 flex-col items-center justify-center gap-[18px] rounded-[10px] bg-panel px-6 py-[50px] transition ${loading ? "" : "hover:bg-[#17171b]"}`}
          >
            {/*
              The dashed outline is drawn rather than bordered. CSS dashes have
              no controllable length or gap — the browser derives them from the
              stroke width — so a longer dash means an SVG stroke. Geometry is
              set in CSS rather than as attributes so the rect tracks the box at
              any size, inset by half the stroke so the line sits fully inside.
            */}
            <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full">
              <rect
                x="0.75"
                y="0.75"
                rx="10"
                ry="10"
                fill="none"
                stroke="var(--color-core-red)"
                strokeWidth="1.5"
                strokeDasharray="14 10"
                style={{ width: "calc(100% - 1.5px)", height: "calc(100% - 1.5px)" }}
              />
            </svg>
            {loading ? <LoadingPlate /> : <>
            <p className="eyebrow hidden text-[10px] tracking-[0.12em] text-body lg:block">Drop photos here</p>

            <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-[18px]">
              <button
                onClick={() => chooseRef.current?.click()}
                className="btn whitespace-nowrap rounded-[6px] bg-seasonal-red px-[24px] py-[14px] text-bright transition hover:brightness-110"
              >
                Choose photo
              </button>
              {/*
                Two buttons, not one. A single input with capture="environment"
                forces the camera on some mobile browsers, and most staff are
                picking a shot they already took.
              */}
              <button
                onClick={() => cameraRef.current?.click()}
                className="btn whitespace-nowrap rounded-[6px] border border-edge bg-raised px-[24px] py-[14px] text-bright transition hover:bg-[#232329]"
              >
                Take a photo
              </button>
            </div>

            <p className="meta text-center text-[10px] text-muted">
              JPG · PNG · HEIC &nbsp;·&nbsp; up&nbsp;to&nbsp;{MAX_BATCH} at a time
            </p>
            </>}

            <input ref={chooseRef} type="file" accept="image/*" multiple className="hidden"
                   onChange={(e) => { take(e.target.files); e.target.value = ""; }} />
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
                   onChange={(e) => { take(e.target.files); e.target.value = ""; }} />
          </div>

          {/* the key: one at a time on a phone, all three from lg up */}
          <div className="relative h-[33px] lg:hidden">
            {CHIPS.map((c, n) => (
              <span
                key={c.label}
                aria-hidden={n !== chip}
                className="absolute inset-x-0 top-0 flex justify-center overflow-hidden transition-opacity duration-500"
                style={{ opacity: n === chip ? 1 : 0 }}
              >
                <Chip c={c} />
              </span>
            ))}
          </div>

          <div className="hidden flex-wrap justify-center gap-[10px] lg:flex">
            {CHIPS.map((c) => <Chip key={c.label} c={c} />)}
          </div>
        </div>
      </div>

      {/* the 32px spacer sits above THE RESULT */}
      <div className="mt-12 flex items-center gap-[14px]">
        <span className="label text-[11px] text-body">The result</span>
        <span className="h-px flex-1 bg-hairline" />
      </div>

      {/*
        A snap carousel on a phone, the four-up grid from lg.

        Two-up stacked meant scrolling past four tall tiles to reach anything
        below them, and each tile was too small to read. One card at 78% of the
        width leaves the next one peeking, which is what tells you to swipe
        without needing an affordance drawn on top of the artwork.

        The rail bleeds to the screen edge via a negative margin and pays it
        back as padding, so the first card still lines up with the page gutter.
      */}
      <div className="lg:hidden">
        <div
          ref={railRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            const step = el.scrollWidth / EXAMPLES.length;
            setSlide(Math.min(EXAMPLES.length - 1, Math.round(el.scrollLeft / step)));
          }}
          className="-mx-5 mt-4 flex snap-x snap-mandatory scroll-pl-5 gap-4 overflow-x-auto px-5 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:-mx-8 sm:scroll-pl-8 sm:px-8 [&::-webkit-scrollbar]:hidden"
        >
          {EXAMPLES.map((ex) => (
            <div key={ex.src} className="w-[78%] shrink-0 snap-start">
              <ExampleTile ex={ex} />
            </div>
          ))}
        </div>

        <div className="mt-3 flex justify-center gap-1.5">
          {EXAMPLES.map((ex, n) => (
            <button
              key={ex.src}
              aria-label={`Show example ${n + 1}`}
              onClick={() => {
                const el = railRef.current;
                if (el) el.scrollTo({ left: (el.scrollWidth / EXAMPLES.length) * n, behavior: "smooth" });
              }}
              className="flex h-[44px] w-[24px] items-center justify-center"
            >
              <span
                className={`h-[6px] rounded-full transition-all ${
                  n === slide ? "w-[18px] bg-ink" : "w-[6px] bg-hairline"
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 hidden gap-4 lg:grid lg:grid-cols-4">
        {EXAMPLES.map((ex) => <ExampleTile key={ex.src} ex={ex} />)}
      </div>

      {children}
    </div>
  );
}
