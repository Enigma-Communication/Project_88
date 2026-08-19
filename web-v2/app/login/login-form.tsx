"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Lockup from "../components/lockup";

/**
 * Board 01. Replaces the browser's own Basic-auth dialog.
 *
 * The note on that board is the whole argument: today the first contact anyone
 * has with the tool is a grey system box with a URL in it, before they have
 * seen a single pixel of the work. The poster half is the pitch, and a wrong
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
    <main className="relative flex h-svh flex-col overflow-hidden lg:flex-row">
      {/*
        The poster. It is the pitch — anyone who lands here sees what the tool
        makes before being asked for anything. On a phone it becomes a band
        across the top rather than half the screen, so the form stays reachable
        without scrolling.
      */}
      {/*
        Edge to edge on a phone, cropped to whatever height is left over.

        The crest is the thing that must survive, and it sits at 50.7% across
        and 34.3% down the 900 x 1606 source — so horizontally, showing the
        full width centres it for free.

        Vertically it is anchored rather than positioned. An object-position
        percentage is measured against the overflow, so the right value changes
        with the container's aspect and would only be correct on one device.
        Pinning the image's top to the container's middle and pulling it back by
        the crest's own 34.3% puts the crest on the centre line at any height.
      */}
      <div className="relative h-[40svh] w-full shrink-0 overflow-hidden lg:h-full lg:w-[700px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/signin/poster.png"
          alt=""
          className="absolute left-0 top-1/2 w-full max-w-none -translate-y-[34.3%] lg:static lg:h-full lg:translate-y-0 lg:object-cover lg:object-top"
        />
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-6 py-6 lg:px-0 lg:py-10">
        <div className="w-full max-w-[380px]">
          <Lockup className="w-full" />

          <p className="label mt-3 text-[12px] text-muted">Illustration generator</p>

          <form onSubmit={submit} className="mt-7 lg:mt-11">
            <label htmlFor="p88-password" className="eyebrow block text-[10px] text-muted">
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
            */}
            {error && (
              <p className="meta mt-3 text-[11px] leading-[18px] text-core-red" role="alert">
                {error}
              </p>
            )}

            <p className="meta mt-3 text-[10px] leading-[20px] text-muted">
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
      </div>

      <div className="pointer-events-none absolute bottom-6 right-8 z-10 hidden items-center gap-[9px] lg:flex">
        <span className="meta text-[8px] uppercase tracking-[0.05em] text-white">Proudly developed by</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/signin/enigma.png" alt="Enigma" className="h-[14px] w-auto" />
      </div>
    </main>
  );
}
