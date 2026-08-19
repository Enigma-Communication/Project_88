"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { describe, loadFeedback, saveFeedback, type FeedbackItem } from "../lib/feedback";

/**
 * The in-app feedback widget. Local development only.
 *
 * Point at a thing, say what is wrong with it, keep going. Each note carries
 * the element's text, classes, box and computed type/colour/spacing, which is
 * what makes "this is too big" actionable without a screenshot or a paragraph.
 *
 * Notes live in localStorage until sent, so a reload mid-review loses nothing.
 * Sending appends them to feedback/FEEDBACK.md in the repo.
 *
 * It deliberately does not sit in the tab order or intercept anything until
 * armed — an always-live click interceptor over a tool whose whole job is
 * dragging a crop box would be worse than the problem it solves.
 */
type Draft = { target: ReturnType<typeof describe> | null; note: string };

export default function Feedback() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [arming, setArming] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [openList, setOpenList] = useState(false);
  const [hover, setHover] = useState<DOMRect | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setItems(loadFeedback()); }, []);

  const persist = useCallback((next: FeedbackItem[]) => {
    setItems(next);
    saveFeedback(next);
  }, []);

  const mine = useCallback((el: EventTarget | null) =>
    el instanceof Node && !!rootRef.current?.contains(el), []);

  /** Arm mode: highlight what is under the pointer, capture it on click. */
  useEffect(() => {
    if (!arming) { setHover(null); return; }

    const onMove = (e: MouseEvent) => {
      if (mine(e.target)) { setHover(null); return; }
      const el = e.target as HTMLElement | null;
      setHover(el ? el.getBoundingClientRect() : null);
    };

    const onClick = (e: MouseEvent) => {
      if (mine(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      const el = e.target as HTMLElement;
      setDraft({ target: describe(el), note: "" });
      setArming(false);
      setTimeout(() => noteRef.current?.focus(), 0);
    };

    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setArming(false); };

    window.addEventListener("mousemove", onMove, true);
    window.addEventListener("click", onClick, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("mousemove", onMove, true);
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [arming, mine]);

  const screen = () => document.querySelector("main")?.getAttribute("data-stage") ?? "unknown";

  const commit = () => {
    if (!draft || !draft.note.trim()) return;
    const item: FeedbackItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: Date.now(),
      note: draft.note.trim(),
      screen: screen(),
      url: location.pathname,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      target: draft.target,
      sent: false,
    };
    persist([...items, item]);
    setDraft(null);
    setStatus("Noted");
    setTimeout(() => setStatus(null), 1200);
  };

  const send = async () => {
    const unsent = items.filter((i) => !i.sent);
    if (unsent.length === 0) return;
    setStatus("Sending…");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: unsent }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "failed");
      persist(items.map((i) => (i.sent ? i : { ...i, sent: true })));
      setStatus(`Sent ${json.count} → ${json.file}`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    }
  };

  const unsent = items.filter((i) => !i.sent).length;

  return (
    <div ref={rootRef} className="fixed bottom-28 right-3 z-[9999] flex max-w-[calc(100vw-1.5rem)] flex-col items-end gap-2 lg:bottom-5 lg:right-5">
      {/* hover highlight while arming */}
      {arming && hover && (
        <div
          className="pointer-events-none fixed z-[9998] border-2 border-warn bg-warn/10"
          style={{ left: hover.x, top: hover.y, width: hover.width, height: hover.height }}
        />
      )}

      {arming && (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-[9999] flex justify-center">
          <span className="label rounded-[6px] bg-warn px-3 py-2 text-[10px] text-black">
            Click anything to comment on it &nbsp;·&nbsp; Esc to cancel
          </span>
        </div>
      )}

      {/* composer */}
      {draft && (
        <div className="w-[min(340px,calc(100vw-1.5rem))] rounded-[8px] border border-edge bg-raised p-3 shadow-2xl">
          <p className="label text-[9px] text-muted">Note on</p>
          <p className="mt-1 truncate font-mono text-[11px] text-bright">
            {draft.target?.label ?? "page"}
          </p>
          <textarea
            ref={noteRef}
            value={draft.note}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) commit();
              if (e.key === "Escape") setDraft(null);
            }}
            rows={3}
            placeholder="What's wrong with it?"
            className="mt-2 w-full resize-none rounded-[4px] border border-hairline bg-panel p-2 font-body text-[13px] text-bright outline-none focus:border-edge"
          />
          <div className="mt-2 flex gap-2">
            <button onClick={commit} className="btn rounded-[4px] bg-ink px-3 py-2 text-[10px] text-white">
              Add note
            </button>
            <button onClick={() => setDraft(null)} className="btn rounded-[4px] border border-edge px-3 py-2 text-[10px] text-body">
              Cancel
            </button>
            <span className="meta ml-auto self-center text-[9px] text-muted">⌘↵</span>
          </div>
        </div>
      )}

      {/* list */}
      {openList && (
        <div className="max-h-[60vh] w-[min(380px,calc(100vw-1.5rem))] overflow-y-auto rounded-[8px] border border-edge bg-raised p-3 shadow-2xl">
          <div className="flex items-center gap-2">
            <span className="label text-[10px] text-bright">Notes</span>
            <span className="meta text-[10px] text-muted">{items.length} total · {unsent} unsent</span>
            {items.length > 0 && (
              <button
                onClick={() => persist([])}
                className="btn ml-auto text-[9px] font-normal text-muted hover:text-core-red"
              >
                Clear all
              </button>
            )}
          </div>

          {items.length === 0 && (
            <p className="mt-3 font-body text-[13px] text-muted">
              Nothing yet. Hit <span className="text-bright">Comment</span> and click something.
            </p>
          )}

          <ul className="mt-3 space-y-2">
            {items.map((it) => (
              <li key={it.id} className={`rounded-[4px] border p-2 ${it.sent ? "border-hairline opacity-50" : "border-edge"}`}>
                <div className="flex items-start gap-2">
                  <span className="flex-1 font-body text-[13px] leading-snug text-bright">{it.note}</span>
                  <button
                    onClick={() => persist(items.filter((x) => x.id !== it.id))}
                    className="btn text-[10px] font-normal text-muted hover:text-core-red"
                    aria-label="Delete note"
                  >
                    ×
                  </button>
                </div>
                <p className="mt-1 truncate font-mono text-[10px] text-muted">
                  {it.screen} · {it.target?.label ?? "page"}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* controls */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {status && (
          <span className="meta max-w-[280px] truncate rounded-[4px] border border-hairline bg-panel px-2 py-1.5 text-[10px] text-body">
            {status}
          </span>
        )}
        {unsent > 0 && (
          <button onClick={send} className="btn h-[44px] rounded-[6px] bg-ink px-3 text-[10px] text-white shadow-lg lg:h-auto lg:py-3">
            Send {unsent} to Claude
          </button>
        )}
        <button
          onClick={() => setOpenList((v) => !v)}
          className="btn h-[44px] rounded-[6px] border border-edge bg-raised px-3 text-[10px] text-body shadow-lg lg:h-auto lg:py-3"
        >
          {items.length} note{items.length === 1 ? "" : "s"}
        </button>
        <button
          onClick={() => { setArming((v) => !v); setDraft(null); }}
          className={`btn h-[44px] rounded-[6px] px-3 text-[10px] shadow-lg lg:h-auto lg:py-3 ${
            arming ? "bg-warn text-black" : "bg-seasonal-red text-white"
          }`}
        >
          {arming ? "Cancel" : "Comment"}
        </button>
      </div>
    </div>
  );
}
