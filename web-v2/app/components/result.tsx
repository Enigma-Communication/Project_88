"use client";

import { useEffect, useState } from "react";
import { INKS, SURFACES, luminance, recolour } from "../lib/recolour";
import type { Surface } from "../lib/recolour";
import type { SessionEntry } from "../lib/session";
import type { Result } from "../lib/types";
import SessionStrip from "./session-strip";
import { download, downloadBlob, exportName, packName } from "../lib/filename";

/**
 * Board 05. Where the work is actually judged.
 *
 * The v1 screen had a button reading "Standard fill / Stencil (inverted)".
 * Nobody outside this build knows what the inverted state looks like until
 * they click it, so both become thumbnails you can see. Same for the inks:
 * five unlabelled circles were a guessing game.
 */
export default function ResultView({
  result, sourceName, session, live, onAdjustCrop, onAgain, onDifferent, onPickSession,
}: {
  result: Result;
  sourceName: string;
  session: SessionEntry[];
  /** false when reopened from history — there is no tray item to go back to */
  live: boolean;
  onAdjustCrop: () => void;
  onAgain: () => void;
  onDifferent: () => void;
  onPickSession: (e: SessionEntry) => void;
}) {
  const [ink, setInk] = useState<string>(INKS[0].hex);
  const [surface, setSurface] = useState<Surface>("alpha");
  const [stencil, setStencil] = useState(false);
  const [surfaceTouched, setSurfaceTouched] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [packing, setPacking] = useState(false);

  /**
   * Keep the ink visible against the preview surface.
   *
   * White ink on paper renders a blank panel, which reads as a broken export
   * rather than a colour choice. v1 did this silently; here the swatch says
   * "preview flips to dark" so the surface moving is a stated behaviour and
   * not a magic trick.
   */
  useEffect(() => {
    if (surfaceTouched) return;
    const l = luminance(ink);
    if (l > 200) setSurface("black");
    else if (l < 40) setSurface("paper");
    else setSurface("alpha");
  }, [ink, surfaceTouched]);

  const shown = stencil ? result.stencil : result.png;
  const surfaceCss = SURFACES.find((s) => s.key === surface)?.css ?? null;

  return (
    <div className="mx-auto max-w-[1440px] px-5 pb-32 pt-8 sm:px-8 lg:px-12 lg:pb-16 lg:pt-10">
      <div className="grid gap-6 lg:grid-cols-[186px_1fr_348px] lg:gap-[30px]">
        {/* versions — visible, not a toggle you have to click to understand */}
        <div className="order-2 lg:order-none">
          <p className="eyebrow label-reg text-[10px] text-muted lg:text-[8px]">Versions</p>

          {/*
            On a phone the two plates become a segmented control. Thumbnails are
            the right call on desktop — you can see what "inverted" means before
            committing — but at 124px they were a small target showing a picture
            too small to read, which is the worst of both. The segment is a 44px
            target and the big preview above already shows the state.
          */}
          <div className="mt-[10px] grid grid-cols-2 rounded-[6px] border border-hairline bg-panel p-[3px] lg:hidden">
            {[
              { on: false, title: "Standard fill" },
              { on: true, title: "Stencil" },
            ].map((v) => (
              <button
                key={v.title}
                onClick={() => setStencil(v.on)}
                className={`btn flex h-[44px] items-center justify-center rounded-[4px] text-[11px] transition ${
                  stencil === v.on ? "bg-raised text-bright" : "font-normal text-body"
                }`}
              >
                {v.title}
              </button>
            ))}
          </div>

          <div className="mt-[10px] hidden lg:block lg:space-y-[26px]">
            {/*
              The thumbnails carry the same trap as the main preview: white ink
              on paper is an invisible panel that reads as a broken export.
              They flip only in the degenerate cases, so the familiar pairing
              (fill on paper, stencil on black) survives for every normal ink.
            */}
            {[
              { on: false, src: result.png, title: "Standard fill", note: "All white keyed out", bg: luminance(ink) > 200 ? "#0D0D0F" : "#F5F0E8" },
              { on: true, src: result.stencil, title: "Stencil", note: "Fills invert on dark", bg: luminance(ink) < 20 ? "#F5F0E8" : "#0D0D0F" },
            ].map((v) => (
              <button key={v.title} onClick={() => setStencil(v.on)} className="block w-full text-left">
                <div
                  className={`aspect-[3/4] overflow-hidden rounded-sm border-2 transition ${
                    stencil === v.on ? "border-ink" : "border-hairline hover:border-edge"
                  }`}
                  style={{ background: v.bg }}
                >
                  <InkPlate src={v.src} ink={ink} className="h-full w-full p-2" />
                </div>
                <p className="label mt-[10px] whitespace-nowrap text-[10px] text-bright">{v.title}</p>
                <p className="label label-reg mt-[6px] whitespace-nowrap text-[9px] text-muted">{v.note}</p>
              </button>
            ))}
          </div>
        </div>

        {/* the artwork */}
        <div className="order-1 lg:order-none">
          <div
            className={`flex min-h-[300px] items-center justify-center rounded-sm p-4 sm:p-8 lg:min-h-[420px] ${surface === "alpha" ? "checker" : ""}`}
            style={surfaceCss ? { background: surfaceCss } : undefined}
          >
            {comparing ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={result.sourceCrop} alt="The photo it came from" className="max-h-[46vh] w-auto object-contain lg:max-h-[62vh]" />
            ) : (
              <InkPlate src={shown} ink={ink} className="h-[46vh] w-full lg:h-[62vh]" />
            )}
          </div>
          <p className="meta mt-[14px] text-[10px] text-muted">
            {result.width} × {result.height} px &nbsp;·&nbsp; transparent background &nbsp;·&nbsp; ink {ink.toUpperCase()} &nbsp;·&nbsp; one plate
          </p>

        </div>

        {/* ink, surface, compare */}
        <div className="order-3 lg:order-none">
          <p className="eyebrow label-reg text-[10px] text-muted lg:text-[8px]">Ink</p>

          {/*
            Swatches as circles on a phone, the way every touch editor does it:
            a 44px target you can hit with a thumb, with the selected name read
            out underneath. The desktop list keeps the names inline because
            there is room for them.
          */}
          <div className="mt-3 lg:hidden">
            <div className="flex items-center gap-3">
              {INKS.map((s2) => (
                <button
                  key={s2.hex}
                  onClick={() => setInk(s2.hex)}
                  aria-label={s2.name}
                  aria-pressed={ink === s2.hex}
                  className={`h-[44px] w-[44px] shrink-0 rounded-full border-2 transition ${
                    ink === s2.hex ? "border-bright" : "border-white/20"
                  }`}
                  style={{ background: s2.hex }}
                />
              ))}
            </div>
            <p className="label mt-3 text-[10px] text-bright">
              {INKS.find((i) => i.hex === ink)?.name}
              {INKS.find((i) => i.hex === ink)?.note && (
                <span className="label-reg text-muted"> · {INKS.find((i) => i.hex === ink)?.note}</span>
              )}
            </p>
          </div>

          <div className="mt-2 hidden space-y-1 lg:block">
            {INKS.map((s) => (
              <button
                key={s.hex}
                onClick={() => setInk(s.hex)}
                className={`flex w-full items-center gap-[12px] rounded-[5px] border px-[12px] py-[10px] text-left transition ${
                  ink === s.hex ? "border-edge bg-raised" : "border-transparent hover:bg-panel"
                }`}
              >
                <span className="h-5 w-5 shrink-0 rounded-full border border-white/25" style={{ background: s.hex }} />
                <span className={`flex-1 text-[10px] uppercase ${ink === s.hex ? "font-bold text-bright" : "text-body"}`}>{s.name}</span>
                {s.note && <span className="label label-reg text-[8px] text-muted">{s.note}</span>}
              </button>
            ))}
          </div>

          <p className="eyebrow label-reg mt-7 text-[10px] text-muted lg:mt-[26px] lg:text-[8px]">Preview it on</p>
          <div className="mt-[10px] grid grid-cols-4 rounded-[6px] border border-hairline bg-panel p-[3px]">
            {SURFACES.map((s) => (
              <button
                key={s.key}
                onClick={() => { setSurface(s.key); setSurfaceTouched(true); }}
                className={`btn flex h-[44px] items-center justify-center rounded-[4px] text-[11px] tracking-[0.06em] transition lg:h-[31px] lg:text-[9px] ${
                  surface === s.key ? "bg-raised text-bright" : "font-normal text-body hover:bg-panel"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          {/*
            The single most likely misunderstanding at handover: someone picks
            Navy, downloads, and expects navy.
          */}
          <p className="meta mt-[10px] text-[10px] leading-[1.5] text-muted lg:text-[8px]">
            Preview only. The file you download is always transparent — the surface never bakes in.
          </p>

          <button
            onPointerDown={() => setComparing(true)}
            onPointerUp={() => setComparing(false)}
            onPointerLeave={() => setComparing(false)}
            className="mt-7 flex w-full items-center gap-[12px] rounded-[5px] border border-hairline bg-panel p-[12px] text-left transition hover:bg-raised lg:mt-[26px]"
            style={{ touchAction: "none" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={result.sourceCrop} alt="" className="h-[38px] w-[38px] shrink-0 rounded-[3px] object-cover" />
            <span>
              <span className="label block text-[10px] leading-[1.5] text-bright">Hold to compare</span>
              <span className="label label-reg mt-[3px] block text-[9px] leading-[1.5] text-muted">The photo it came from</span>
            </span>
          </button>
        </div>
      </div>

      {/*
        Full width, below all three columns — board 05 puts this row at x=48
        spanning the whole 1344 content width, not tucked under the preview.
      */}
      <div className="mt-8 hidden flex-col items-stretch gap-[10px] sm:flex-row sm:flex-wrap sm:items-center lg:mt-[30px] lg:flex">
        {/*
          Board 06 opens a preset and lockup composer here. Until that slice
          lands, these two do the job that actually costs the comms team time:
          one file with a name that says what it is, or the lot in one go.
        */}
        <button
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              const name = INKS.find((i) => i.hex === ink)?.name ?? "ink";
              download(await recolour(shown, ink), exportName(sourceName, stencil ? "stencil" : "fill", name));
            } finally {
              setSaving(false);
            }
          }}
          className="btn whitespace-nowrap rounded-[6px] bg-ink px-[24px] py-[14px] text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {saving ? "Preparing…" : "Download PNG"}
        </button>

        {/*
          The pack: both versions in all four inks, eight one-colour PNGs in a
          single zip, so nobody has to come back and re-download after changing
          the swatch.

          Zipped in the browser. The plates already exist and recolouring is a
          canvas pass over the alpha, so this costs nothing at the API and can
          never re-bill a generation.
        */}
        <button
          disabled={packing}
          onClick={async () => {
            setPacking(true);
            try {
              const { default: JSZip } = await import("jszip");
              const zip = new JSZip();
              for (const swatch of INKS) {
                const [fill, sten] = await Promise.all([
                  recolour(result.png, swatch.hex),
                  recolour(result.stencil, swatch.hex),
                ]);
                zip.file(exportName(sourceName, "fill", swatch.name), fill.split(",")[1], { base64: true });
                zip.file(exportName(sourceName, "stencil", swatch.name), sten.split(",")[1], { base64: true });
              }
              downloadBlob(await zip.generateAsync({ type: "blob" }), packName(sourceName));
            } finally {
              setPacking(false);
            }
          }}
          className="btn whitespace-nowrap rounded-[6px] border border-edge bg-raised px-[24px] py-[14px] text-bright transition hover:bg-[#232329] disabled:opacity-60"
        >
          {packing ? "Packing…" : "Download pack"}
        </button>
        {(live
          ? [
              { label: "Adjust the crop", fn: onAdjustCrop },
              { label: "Generate again", fn: onAgain },
              { label: "Try a different photo", fn: onDifferent },
            ]
          : [{ label: "Start a new batch", fn: onDifferent }]
        ).map((b) => (
          <button
            key={b.label}
            onClick={b.fn}
            className="btn whitespace-nowrap rounded-[6px] border border-edge bg-raised px-[24px] py-[14px] text-bright transition hover:bg-[#232329]"
          >
            {b.label}
          </button>
        ))}
        <span className="flex items-center gap-2 self-center sm:ml-auto">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span className="label label-reg text-[9px] text-body">
            {live ? "Kept in today's session" : "From today's session"}
          </span>
        </span>
      </div>

      {/* secondary actions on a phone — export lives in the pinned bar below */}
      <div className="mt-6 flex gap-[10px] overflow-x-auto pb-1 lg:hidden">
        {(live
          ? [
              { label: "Adjust the crop", fn: onAdjustCrop },
              { label: "Generate again", fn: onAgain },
              { label: "Try a different photo", fn: onDifferent },
            ]
          : [{ label: "Start a new batch", fn: onDifferent }]
        ).map((b) => (
          <button
            key={b.label}
            onClick={b.fn}
            className="btn h-[44px] shrink-0 whitespace-nowrap rounded-[6px] border border-edge bg-raised px-5 text-bright transition hover:bg-[#232329]"
          >
            {b.label}
          </button>
        ))}
      </div>

      <SessionStrip session={session} caption={sourceName} onPick={onPickSession} />

      {/*
        The phone's export bar.

        Same reasoning as the review screen: the artwork owns the screen, and
        the action that finishes the job is pinned rather than buried under a
        column of controls. Both exports sit here because they are the point of
        the screen — everything above is adjustment.
      */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex gap-[10px] border-t border-hairline bg-pitch/95 px-5 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">
        <button
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              const name = INKS.find((i) => i.hex === ink)?.name ?? "ink";
              download(await recolour(shown, ink), exportName(sourceName, stencil ? "stencil" : "fill", name));
            } finally {
              setSaving(false);
            }
          }}
          className="btn flex-1 whitespace-nowrap rounded-[6px] bg-ink py-[18px] text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {saving ? "Preparing…" : "Download PNG"}
        </button>
        <button
          disabled={packing}
          onClick={async () => {
            setPacking(true);
            try {
              const { default: JSZip } = await import("jszip");
              const zip = new JSZip();
              for (const swatch of INKS) {
                const [fill, sten] = await Promise.all([
                  recolour(result.png, swatch.hex),
                  recolour(result.stencil, swatch.hex),
                ]);
                zip.file(exportName(sourceName, "fill", swatch.name), fill.split(",")[1], { base64: true });
                zip.file(exportName(sourceName, "stencil", swatch.name), sten.split(",")[1], { base64: true });
              }
              downloadBlob(await zip.generateAsync({ type: "blob" }), packName(sourceName));
            } finally {
              setPacking(false);
            }
          }}
          className="btn shrink-0 whitespace-nowrap rounded-[6px] border border-edge bg-raised px-5 py-[18px] text-bright transition hover:bg-[#232329] disabled:opacity-60"
        >
          {packing ? "Packing…" : "Pack"}
        </button>
      </div>
    </div>
  );
}

/**
 * A one-colour plate, painted rather than repainted.
 *
 * The output is flat ink plus an alpha channel, so the alpha IS the artwork
 * and the colour is arbitrary. Recolouring it through a canvas meant walking
 * every pixel of two full-size images on the main thread for each swatch
 * click — measurably janky, and it froze the tab hard enough that a script
 * injected mid-click timed out against it.
 *
 * Using the PNG as a CSS mask over a solid background gives the same result
 * on the GPU, instantly, with no JavaScript at all. maskSize:contain
 * reproduces object-contain, so it drops straight into the old layout.
 *
 * The canvas pass still exists — it runs once, on download, because the file
 * leaving the app has to be a real recoloured PNG rather than two CSS
 * properties.
 */
function InkPlate({ src, ink, className }: { src: string; ink: string; className?: string }) {
  return (
    <div
      role="img"
      aria-label="Generated illustration"
      className={className}
      style={{
        backgroundColor: ink,
        WebkitMaskImage: `url("${src}")`,
        maskImage: `url("${src}")`,
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
      }}
    />
  );
}

