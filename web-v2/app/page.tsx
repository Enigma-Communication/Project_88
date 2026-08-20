"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Header from "./components/header";
import Start from "./components/start";
import Tray, { rankTray } from "./components/tray";
import Review from "./components/review";
import Generating from "./components/generating";
import ResultView from "./components/result";
import SessionStrip from "./components/session-strip";
import Feedback from "./components/feedback";
import MountDial from "./components/mount-dial";
import { loadMount } from "./lib/mount";
import Rejected from "./components/rejected";
import { downscale } from "./lib/downscale";
import { INKS } from "./lib/recolour";
import { pool } from "./lib/concurrency";
import { dataUrlToBlob, listSession, saveGeneration, type SessionEntry } from "./lib/session";
import type { Box, Preflight, Result, TrayItem } from "./lib/types";
import { MAX_BATCH } from "./lib/files";

type Stage = "start" | "loading" | "review" | "generating" | "result";

/**
 * The v2 flow, boards 02 to 05.
 *
 * start ──drop──▶ loading ──first verdict──▶ review ──▶ generating ──▶ result
 *                                              ▲                          │
 *                                              └── adjust the crop ────────┘
 *
 * The wait sits on the start screen, in the dropzone, rather than on an empty
 * review screen. Nothing is reviewable until a vision pass returns, so moving
 * early just showed a blank column. It hands over the moment the first photo
 * has a verdict — the rest of the tray keeps filling in behind it.
 *
 * Sign-in (01), export presets (06) and the failure decks (07) are the next
 * slice. Errors here get an honest inline panel rather than the three copy
 * decks those boards specify.
 */
export default function Home() {
  const [stage, setStage] = useState<Stage>("start");
  const [items, setItems] = useState<TrayItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [resultName, setResultName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<SessionEntry[]>([]);
  const [preflightMs, setPreflightMs] = useState(2100);
  const [retrying, setRetrying] = useState(false);
  const [adding, setAdding] = useState(false);
  /**
   * Batch-level messages — the cap, mostly. Deliberately not `error`: that
   * banner is headed "That did not come out" and framed as a failed
   * generation, which is the wrong voice for "this batch is full".
   */
  const [notice, setNotice] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const autoPicked = useRef(false);

  /**
   * The tray as it stands right now, for the callbacks that must not close over
   * a stale copy. onFiles is built once and reads the count to decide how much
   * room is left; through state it would still be reading the empty array the
   * first batch started from.
   */
  const itemsRef = useRef<TrayItem[]>([]);
  useEffect(() => { itemsRef.current = items; }, [items]);

  useEffect(() => { listSession().then(setSession).catch(() => {}); }, []);

  const active = items.find((i) => i.id === activeId) ?? null;

  /**
   * Drop handler: build the tray immediately, then preflight in the background.
   *
   * `append` is the same path taken from the tray's add tile, and differs in
   * three ways that all come from the operator being mid-job rather than at the
   * start of one: the existing batch is kept, the loading screen is not shown
   * (it would throw away the crop they are looking at), and autoPicked is left
   * alone so a newly checked photo cannot yank the view off the one they are
   * working on.
   */
  const onFiles = useCallback(async (files: File[], append = false) => {
    setError(null);

    // measured against what is already in the tray, not against this drop —
    // the cap is on the batch, and appending is how you would otherwise walk
    // straight past it in twos and threes
    const held = append ? itemsRef.current.length : 0;
    const room = MAX_BATCH - held;
    if (room <= 0) {
      setNotice(`The batch already holds ${MAX_BATCH} photos. Remove one to add another.`);
      return;
    }
    // Said out loud rather than silently sliced. Dropping a card of 60 and
    // being given 40 with no message looks like the app lost twenty photos.
    setNotice(
      files.length > room
        ? `Only room for ${room} more — ${files.length - room} not added.`
        : null,
    );
    const taking = files.slice(0, room);

    if (append) setAdding(true);
    else {
      autoPicked.current = false;
      // straight away, so the downscale is covered too — 40 camera files take a
      // noticeable moment to shrink before a single request goes out
      setStage("loading");
    }

    const shrunk = await Promise.all(taking.map((f) => downscale(f)));
    const stamp = Date.now();
    const fresh: TrayItem[] = shrunk.map((f, i) => ({
      // the random suffix matters once appending exists — two adds inside the
      // same millisecond would otherwise collide on id and React would treat
      // them as the same tile
      id: `${stamp}-${Math.random().toString(36).slice(2, 8)}-${i}`,
      file: f,
      name: taking[i].name,
      thumbUrl: URL.createObjectURL(f),
      state: "waiting",
      pre: null,
      error: null,
      box: null,
    }));

    setItems((cur) => (append ? [...cur, ...fresh] : fresh));
    if (append) setAdding(false);

    const t0 = performance.now();
    let measured = false;
    let anyChecked = false;

    await pool(
      fresh,
      5,
      async (it) => {
        setItems((cur) => cur.map((c) => (c.id === it.id ? { ...c, state: "checking" } : c)));
        const fd = new FormData();
        fd.append("photo", it.file);
        const res = await fetch("/api/preflight", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "preflight failed");
        return json as Preflight;
      },
      (it, _i, pre, err) => {
        if (!measured) { measured = true; setPreflightMs(performance.now() - t0); }
        if (pre) anyChecked = true;
        setItems((cur) =>
          rankTray(
            cur.map((c) =>
              c.id === it.id
                ? pre
                  ? { ...c, state: "checked" as const, pre, box: pre.box }
                  : { ...c, state: "failed" as const, error: err instanceof Error ? err.message : String(err) }
                : c,
            ),
          ),
        );
      },
    );

    // Every photo failed, so no verdict will ever arrive to move us on. Show
    // the review screen anyway rather than leaving the dropzone spinning.
    // Only on a fresh batch — when appending we are already there.
    if (!anyChecked && !append) setStage("review");
  }, []);

  /**
   * Open the first usable photo as soon as one lands, so the operator is not
   * watching a tray fill up with nothing to do. Only ever fires once.
   */
  useEffect(() => {
    if (autoPicked.current || activeId) return;
    const first = items.find((i) => i.state === "checked")
      ?? (items.length > 0 && items.every((i) => i.state === "failed") ? items[0] : undefined);
    if (!first) return;
    autoPicked.current = true;
    setActiveId(first.id);
    setBox(first.box ?? first.pre?.box ?? null);
    setStage((cur) => (cur === "loading" ? "review" : cur));
  }, [items, activeId]);

  /**
   * Open any photo the tray shows, including a failed one — its chip used to
   * be a dead end, which read as the app ignoring the tap rather than the
   * photo being unusable.
   */
  const pick = (id: string) => {
    const it = items.find((i) => i.id === id);
    if (!it || it.state === "waiting" || it.state === "checking") return;
    setActiveId(id);
    setBox(it.pre ? it.box ?? it.pre.box : null);
    setResult(null);
    setError(null);
    setStage("review");
  };

  /**
   * Drop one photo from the batch.
   *
   * Three things have to happen together, and the order matters. The object URL
   * is revoked or the bitmap stays in memory for the life of the tab — the
   * whole reason there is a cap at all. If the removed photo is the one on
   * screen, the next openable one takes its place rather than leaving a review
   * pane rendering a photo that is no longer in the batch. And emptying the
   * tray returns to the start screen, because a review screen with nothing to
   * review is a dead end with no way back.
   */
  const removeItem = (id: string) => {
    const it = itemsRef.current.find((i) => i.id === id);
    if (!it) return;
    URL.revokeObjectURL(it.thumbUrl);

    const rest = itemsRef.current.filter((i) => i.id !== id);
    setItems(rest);
    setError(null);
    setNotice(null);

    if (id !== activeId) return;

    const openable = (i: TrayItem) => i.state === "checked" || i.state === "failed";
    const next = rest.find(openable);
    if (next) {
      setActiveId(next.id);
      setBox(next.box ?? next.pre?.box ?? null);
      setResult(null);
      setStage("review");
      return;
    }

    setActiveId(null);
    setBox(null);
    setResult(null);
    if (rest.length === 0) {
      autoPicked.current = false;
      setStage("start");
    }
  };

  const skip = () => {
    const openable = (i: TrayItem) => i.state === "checked" || i.state === "failed";
    const idx = items.findIndex((i) => i.id === activeId);
    const nextUp = items.slice(idx + 1).find(openable) ?? items.find((i) => openable(i) && i.id !== activeId);
    if (nextUp) pick(nextUp.id);
  };

  /** Re-run preflight on one photo, in place. */
  const retryPreflight = useCallback(async (id: string) => {
    const it = items.find((i) => i.id === id);
    if (!it) return;
    setRetrying(true);
    setItems((cur) => cur.map((c) => (c.id === id ? { ...c, state: "checking", error: null } : c)));
    try {
      const fd = new FormData();
      fd.append("photo", it.file);
      const res = await fetch("/api/preflight", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "preflight failed");
      const pre = json as Preflight;
      setItems((cur) => rankTray(cur.map((c) => (c.id === id ? { ...c, state: "checked" as const, pre, box: pre.box, error: null } : c))));
      setBox(pre.box);
    } catch (e) {
      setItems((cur) => cur.map((c) => (c.id === id ? { ...c, state: "failed" as const, error: e instanceof Error ? e.message : String(e) } : c)));
    } finally {
      setRetrying(false);
    }
  }, [items]);

  const generate = useCallback(async () => {
    if (!active?.pre) return;
    setError(null);
    setResult(null);
    setStage("generating");

    // keep the operator's box on the item, so coming back holds their framing
    if (box) setItems((cur) => cur.map((c) => (c.id === active.id ? { ...c, box } : c)));

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const fd = new FormData();
      fd.append("photo", active.file);
      fd.append("triage", JSON.stringify(active.pre.triage));
      if (box) fd.append("box", JSON.stringify(box));
      // Local testing only. Omitted in production so the server's own default
      // wins there and a stale localStorage value cannot follow a build out.
      if (process.env.NODE_ENV !== "production") fd.append("mount", String(loadMount()));

      const res = await fetch("/api/generate", { method: "POST", body: fd, signal: ctrl.signal });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "generation failed");

      const r = json as Result;
      setResult(r);
      setResultName(active.name);

      const [png, stencil, sourceCrop] = await Promise.all([
        dataUrlToBlob(r.png), dataUrlToBlob(r.stencil), dataUrlToBlob(r.sourceCrop),
      ]);
      const entry = await saveGeneration({
        sourceName: active.name, width: r.width, height: r.height, ink: INKS[0].hex,
        mount: r.mount, png, stencil, sourceCrop,
      });
      setSession((cur) => [entry, ...cur]);

      // let the wipe play out before handing over to the result screen
      setTimeout(() => setStage("result"), 1600);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") { setStage("review"); return; }
      setError(e instanceof Error ? e.message : String(e));
      setStage("review");
    } finally {
      abortRef.current = null;
    }
  }, [active, box]);

  /**
   * Reopen a stored generation. The blob URLs already exist on the entry, so
   * this is just a state swap — nothing is refetched and nothing is re-billed.
   */
  const openStored = (e: SessionEntry) => {
    setResult({
      png: e.pngUrl, stencil: e.stencilUrl, sourceCrop: e.sourceCropUrl,
      width: e.width, height: e.height, mount: e.mount,
    });
    setResultName(e.sourceName);
    setStage("result");
  };

  const reset = () => {
    items.forEach((i) => URL.revokeObjectURL(i.thumbUrl));
    setItems([]); setActiveId(null); setBox(null); setResult(null); setError(null); setNotice(null);
    autoPicked.current = false;
    setStage("start");
  };

  return (
    <>
      <Header
        onHome={reset}
        onSignOut={async () => {
          await fetch("/api/logout", { method: "POST" }).catch(() => {});
          window.location.href = "/login";
        }}
      />
      <main data-stage={stage}>
        {(stage === "start" || stage === "loading") && (
          <Start onFiles={onFiles} loading={stage === "loading"}>
            <SessionStrip session={session} onPick={openStored} />
          </Start>
        )}

        {stage === "generating" && active && (
          <Generating
            sourceCropUrl={result?.sourceCrop ?? active.thumbUrl}
            resultUrl={result?.png ?? null}
            preflightMs={preflightMs}
            onCancel={() => { abortRef.current?.abort(); }}
          />
        )}

        {stage === "result" && result && (
          <ResultView
            result={result}
            sourceName={resultName}
            session={session}
            live={Boolean(active)}
            onAdjustCrop={() => { setResult(null); setStage("review"); }}
            onAgain={generate}
            onDifferent={() => {
              if (!active) { reset(); return; }
              setResult(null); setStage("review"); skip();
            }}
            onPickSession={openStored}
          />
        )}

        {stage === "review" && (
          <div className="mx-auto max-w-[1440px] px-5 pb-16 pt-8 sm:px-8 lg:px-12 lg:pt-11">
            {error && (
              <div className="mb-7 rounded-[8px] border border-core-red/35 bg-[#2a0b0b] p-5">
                <p className="eyebrow text-[10px] text-core-red">That did not come out</p>
                <p className="mt-2.5 font-mono text-[11px] leading-relaxed text-body">{error}</p>
                <p className="mt-3 text-[12px] leading-[22px] text-muted">
                  Board 07&apos;s three failure decks are the next slice — for now this is the raw response.
                </p>
              </div>
            )}

            {active && active.state === "failed" ? (
              <Rejected
                item={active}
                index={items.findIndex((i) => i.id === active.id)}
                total={items.length}
                retrying={retrying}
                onRetry={() => retryPreflight(active.id)}
                onSkip={skip}
                onStartOver={reset}
              />
            ) : active?.pre && box ? (
              <Review
                item={active}
                index={items.findIndex((i) => i.id === active.id)}
                total={items.length}
                box={box}
                onBox={setBox}
                onGenerate={generate}
                onSkip={skip}
                onResetCrop={() => setBox(active.pre!.box)}
              />
            ) : (
              <div className="flex min-h-[280px] items-center justify-center">
                <p className="eyebrow text-[10px] text-muted">Checking the batch…</p>
              </div>
            )}

            {items.length > 0 && (
              <Tray
                items={items}
                activeId={activeId}
                adding={adding}
                notice={notice}
                onDismissNotice={() => setNotice(null)}
                onPick={pick}
                onAdd={(files) => onFiles(files, true)}
                onRemove={removeItem}
              />
            )}
          </div>
        )}
      </main>
      {process.env.NODE_ENV !== "production" && <MountDial />}
      {process.env.NODE_ENV !== "production" && <Feedback />}
    </>
  );
}
