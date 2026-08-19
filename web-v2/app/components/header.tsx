"use client";

import Lockup from "./lockup";

/**
 * The bar.
 *
 * The wordmark is the same three-frame lockup as the sign-in screen rather
 * than 88 Sans Grit with a still figure composited into it — one asset, one
 * behaviour, and the figure animates in both places instead of only at the
 * gate.
 *
 * Widths started from what the text version measured at each step
 * (110 / 138 / 172px) and are now 10% over that, on request:
 * 121 / 152 / 189px. At the source's 570 x 158 that lands the lockup at
 * 34 / 42 / 52px tall inside bars of 56 / 66 / 78, so it still clears the
 * rule with room either side.
 */
export default function Header({ onHome, onSignOut }: { onHome?: () => void; onSignOut?: () => void }) {
  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-pitch/85 backdrop-blur">
      {/*
        Same container as the page body — max width and gutter both — so the
        lockup sits on the hero's left edge at every width.
      */}
      <div className="mx-auto flex h-[56px] max-w-[1440px] items-center px-5 sm:h-[66px] sm:px-8 lg:h-[78px] lg:px-[88px]">
        <button
          onClick={onHome}
          aria-label="Project 88 — start over"
          className="flex h-full shrink-0 items-center transition hover:opacity-80"
        >
          <Lockup className="w-[121px] sm:w-[152px] lg:w-[189px]" />
        </button>

        {/*
          Sign out clears the session cookie and returns to the gate. It takes
          the full bar height as its tap target — the label's own box is only
          the cap height, which was an 8px target on a phone.
        */}
        <button
          onClick={onSignOut}
          className="btn -mr-2 ml-auto flex h-full items-center px-2 text-[10px] tracking-[0.1em] text-muted transition hover:text-bright"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
