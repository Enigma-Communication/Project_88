"use client";

import type { TrayItem } from "../lib/types";

/**
 * The photo that could not be read.
 *
 * Preflight fails for real reasons — a HEIC the browser could not decode, a
 * frame with no person in it at all, a model call that came back empty — and
 * before this screen existed a failed photo simply could not be opened: the
 * tray chip said "Failed" and tapping it did nothing, which looks like the app
 * is broken rather than the photo.
 *
 * It says what happened in a sentence, offers the two things that actually
 * help, and keeps the raw message in a disclosure for whoever is debugging.
 */
export default function Rejected({
  item, index, total, onRetry, onSkip, onStartOver, retrying,
}: {
  item: TrayItem;
  index: number;
  total: number;
  onRetry: () => void;
  onSkip: () => void;
  onStartOver: () => void;
  retrying: boolean;
  }) {
  const raw = item.error ?? "";

  /* The three that actually happen, in the words of someone holding a phone. */
  const known = /heic|unreadable|unsupported|decode/i.test(raw)
    ? {
        head: "We could not read that photo.",
        body: "Some iPhone HEIC files will not decode in a browser. Screenshot it, or set the camera to Most Compatible, and try again.",
      }
    : /no dominant|no person|not suitable|subject/i.test(raw)
      ? {
          head: "There is no player in that photo.",
          body: "This draws one athlete from a match frame. It needs a person in shot to find — a landscape, a crowd, or the dog will not give it anything to work with.",
        }
      : /RESOURCE_EXHAUSTED|limit: 0|429|quota/i.test(raw)
        ? {
            head: "The key has run out for now.",
            body: "The image quota on this API key is exhausted. Nothing was charged for this attempt.",
          }
        : {
            head: "That photo did not come out.",
            body: "The preflight could not read it. Trying again usually works — if it does not, the frame itself is the problem, so pick another.",
          };

  return (
    <section className="mx-auto max-w-[560px] pb-32 pt-4 lg:pb-0 lg:pt-10">
      <p className="eyebrow label-reg text-[10px] leading-[1.6] text-muted">
        Photo {index + 1} of {total} &nbsp;·&nbsp; {item.name}
      </p>

      <div className="mt-4 overflow-hidden rounded-[8px] border border-core-red/35 bg-[#2a0b0b]">
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.thumbUrl} alt="" className="block max-h-[38vh] w-full object-cover opacity-40" />
          <span className="absolute inset-0 bg-gradient-to-t from-[#2a0b0b] to-transparent" />
        </div>

        <div className="px-5 pb-5 pt-[18px]">
          <span className="flex items-center gap-[10px]">
            <span className="h-[9px] w-[9px] shrink-0 rounded-full bg-core-red" />
            <span className="eyebrow trim text-[10px] text-core-red">Cannot use this one</span>
          </span>
          <h2 className="mt-[10px] text-[14px] font-bold leading-[1.4] tracking-[-0.01em] text-bright">{known.head}</h2>
          <p className="mt-[10px] text-[12px] leading-[22px] text-body">{known.body}</p>

          {raw && (
            <details className="group mt-4 border-t border-white/10 pt-4">
              <summary className="eyebrow cursor-pointer list-none text-[10px] text-white transition hover:opacity-70">
                <span className="inline-block transition group-open:rotate-90">›</span> What the server said
              </summary>
              <p className="mt-3 font-mono text-[11px] leading-[1.6] text-body">{raw}</p>
            </details>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-[10px] sm:flex-row">
        <button
          onClick={onRetry}
          disabled={retrying}
          className="btn h-[52px] flex-1 whitespace-nowrap rounded-[6px] bg-ink text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {retrying ? "Trying again…" : "Try this photo again"}
        </button>
        {total > 1 ? (
          <button onClick={onSkip} className="btn h-[52px] whitespace-nowrap rounded-[6px] border border-edge bg-raised px-6 text-bright transition hover:bg-[#232329]">
            Skip to the next photo
          </button>
        ) : (
          <button onClick={onStartOver} className="btn h-[52px] whitespace-nowrap rounded-[6px] border border-edge bg-raised px-6 text-bright transition hover:bg-[#232329]">
            Choose another photo
          </button>
        )}
      </div>
    </section>
  );
}
