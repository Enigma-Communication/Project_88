"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Lockup from "../components/lockup";

/**
 * Board 01. Replaces the browser's own Basic-auth dialog.
 *
 * The note on that board is the whole argument: today the first contact anyone
 * has with the tool is a grey system box with a URL in it, before they have
 * seen a single pixel of the work. The lockup is the pitch, and a wrong
 * password can finally say so in words — the native dialog just re-prompts,
 * silently, forever, which reads as broken.
 *
 * The password is posted to the server and compared there. Nothing about the
 * secret reaches the client.
 */
export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "That password is not right.");
        setPassword("");
        return;
      }
      const next = params.get("next");
      router.replace(next && next.startsWith("/") ? next : "/");
      router.refresh();
    } catch {
      setError("Could not reach the server. Is it still running?");
    } finally {
      setBusy(false);
    }
  };

  return (
    /*
      Board 01, revised. One centred column on every size.

      The poster that used to hold the left half is gone at the client's
      request — it did not survive the presentation. Nothing replaces it: the
      board puts the lockup, the field and the credit on an empty ground, and
      the lockup is already the pitch.

      That also removes the reason the old layout was a two-column flex with a
      separate phone case. A single centred column is the same on both, so the
      breakpoint work goes with it.
    */
    <main className="relative flex min-h-svh flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-[380px]">
        {/*
          Lockup and strapline are one group in the file, held at 22px, and the
          gap to the field below is 56px — the board spaces those with a 32px
          spacer between two 12px gaps rather than one value, so it is written
          out here as the sum rather than left looking like an arbitrary number.
        */}
        <Lockup className="w-full" />
        {/*
          normal-case is deliberate. .label uppercases by default, which is
          right everywhere else in the app, and the board sets this one line in
          sentence case — it reads as a caption under the mark rather than
          another UI label competing with PASSWORD below it.
        */}
        <p className="label mt-[22px] text-center text-[12px] normal-case text-muted">Illustration generator</p>

        <form onSubmit={submit} className="mt-14">
          <label htmlFor="p88-password" className="eyebrow block text-[10px] tracking-[0.1em] text-muted">
            Password
          </label>
          <input
            id="p88-password"
            type="password"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(null); }}
            className={`mt-3 h-[52px] w-full rounded-[6px] border bg-raised px-[15px] text-[18px] tracking-[0.06em] text-bright caret-ink outline-none transition ${
              error ? "border-core-red" : "border-edge focus:border-neutral-500"
            }`}
          />

          <button
            type="submit"
            disabled={busy || password.length === 0}
            className="btn mt-3 h-[52px] w-full rounded-[6px] bg-ink text-[16px] tracking-[0.07em] text-white transition hover:brightness-110 disabled:opacity-50"
          >
            {busy ? "Checking…" : "Enter"}
          </button>

          {/*
            A wrong password can say so. The native dialog this replaces just
            re-prompts with no explanation, which is the single thing board 01
            calls out as reading like a fault in the tool.

            Centred with the helper text under it, now the column is centred —
            left-aligned it read as a stray line rather than a reply to the
            field above.
          */}
          {error && (
            <p className="meta mt-3 text-center text-[11px] leading-[18px] text-core-red" role="alert">
              {error}
            </p>
          )}

          <p className="meta mt-3 text-center text-[10px] leading-[20px] text-muted">
            One shared password for club staff. Lost it? Ask Enigma — we can reset it in a minute.{" "}
            <a
              href={
                "mailto:will@enigma.net.au" +
                "?subject=" + encodeURIComponent("I can't login to Project 88") +
                "&body=" + encodeURIComponent(
                  "Hi Will,\n\nI can't log in to Project 88 — could you send me the password?\n\nThanks",
                )
              }
              className="text-white underline"
            >
              Contact us
            </a>.
          </p>
        </form>
      </div>

      {/*
        Bottom-right on desktop, as the board has it. Still desktop-only: the
        board specifies no phone position for it, and pinned to the corner of a
        short viewport it collides with the form rather than sitting under it.
      */}
      <div className="pointer-events-none absolute bottom-6 right-8 z-10 hidden items-center gap-[9px] lg:flex">
        <span className="meta text-[8px] uppercase tracking-[0.05em] text-white">Proudly developed by</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/signin/enigma.png" alt="Enigma" className="h-[14px] w-auto" />
      </div>
    </main>
  );
}
