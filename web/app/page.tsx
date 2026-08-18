"use client";

import { useCallback, useRef, useState } from "react";
import CropBox, { type Box } from "./crop-box";
import { downscale } from "./downscale";

type Preflight = {
  verdict: "READY" | "NEEDS CROP" | "NOT SUITABLE";
  reasons: string[];
  subject: string;
  faceVisibility: string;
  motion: string;
  people: number;
  overlaps: number;
  source: { width: number; height: number };
  box: Box;
  subjectPx: number;
  preview: string;
  triage: unknown;
};

type Result = { png: string; stencil: string; width: number; height: number };
type Stage = "idle" | "preflighting" | "ready" | "generating" | "done";

const VERDICT_STYLE = {
  READY: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  "NEEDS CROP": "bg-amber-500/10 text-amber-300 border-amber-500/30",
  "NOT SUITABLE": "bg-red-500/10 text-red-300 border-red-500/30",
} as const;

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [pre, setPre] = useState<Preflight | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [bg, setBg] = useState<"checker" | "white" | "black" | "navy">("checker");
  const [inverted, setInverted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setPre(null); setBox(null); setResult(null); setError(null); setStage("idle");
  };

  const onFile = useCallback(async (raw: File) => {
    reset();
    setStage("preflighting");
    // shrink before upload — camera files are 5-25MB and exceed the body limit
    const f = await downscale(raw);
    setFile(f);
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    setObjectUrl(URL.createObjectURL(f));
    try {
      const fd = new FormData();
      fd.append("photo", f);
      const res = await fetch("/api/preflight", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "preflight failed");
      setPre(json);
      setBox(json.box);
      setStage("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStage("idle");
    }
  }, [objectUrl]);

  const generate = async () => {
    if (!file || !pre) return;
    setStage("generating"); setError(null);
    try {
      const fd = new FormData();
      fd.append("photo", file);
      fd.append("triage", JSON.stringify(pre.triage));
      if (box) fd.append("box", JSON.stringify(box));
      const res = await fetch("/api/generate", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "generation failed");
      setResult(json);
      setStage("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStage("ready");
    }
  };

  const shown = result ? (inverted ? result.stencil : result.png) : null;
  const bgClass = bg === "checker" ? "checker" : "";
  const bgStyle = bg === "white" ? "#fff" : bg === "black" ? "#111" : bg === "navy" ? "#001A5C" : undefined;

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 sm:py-12">
      <header className="mb-8 flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Project 88</h1>
          <p className="text-sm text-neutral-400">Match photo → screenprint illustration</p>
        </div>
        {(pre || result) && (
          <button onClick={() => { setFile(null); reset(); }}
            className="shrink-0 rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800">
            Start over
          </button>
        )}
      </header>

      {!file && (
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
          className="flex min-h-64 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-neutral-700 bg-neutral-900/40 p-10 text-center transition hover:border-neutral-500 hover:bg-neutral-900/70"
        >
          <div className="text-4xl">📸</div>
          <div className="font-medium">Drop a match photo, or tap to choose</div>
          <div className="text-sm text-neutral-500">JPG, PNG or HEIC · one athlete works best</div>
          <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
        </label>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          <div className="font-medium">Something went wrong</div>
          <div className="mt-1 text-red-300/80">{error}</div>
          {error.includes("limit: 0") && (
            <div className="mt-2 text-red-300/80">Image generation isn&apos;t enabled on this API key&apos;s project.</div>
          )}
        </div>
      )}

      {stage === "preflighting" && <Progress label="Checking the photo…" />}

      {pre && objectUrl && stage !== "done" && (
        <section className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <CropBox src={objectUrl} source={pre.source} box={box ?? pre.box} onChange={setBox} />
            <p className="mt-2 text-xs text-neutral-500">Drag inside to move, or the corner handles to resize.</p>
          </div>

          <div className="space-y-4">
            <div className={`rounded-xl border p-4 ${VERDICT_STYLE[pre.verdict]}`}>
              <div className="font-semibold">{pre.verdict}</div>
              {pre.reasons.length > 0 ? (
                <ul className="mt-2 space-y-1 text-sm opacity-90">
                  {pre.reasons.map((r) => <li key={r}>· {r}</li>)}
                </ul>
              ) : <div className="mt-1 text-sm opacity-80">Nothing flagged.</div>}
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-sm">
              <Row k="In frame" v={`${pre.people}`} />
              <Row k="Overlapping" v={`${pre.overlaps}`} />
              <Row k="Face" v={pre.faceVisibility} />
              <Row k="Motion" v={pre.motion} />
              <Row k="Subject height" v={`${pre.subjectPx}px`} />
            </dl>

            <p className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-sm text-neutral-400">
              {pre.subject}
            </p>

            <button onClick={generate} disabled={stage === "generating"}
              className="w-full rounded-xl bg-[#D82020] px-4 py-3 font-medium text-white transition hover:brightness-110 disabled:opacity-50">
              {stage === "generating" ? "Generating…" : "Generate illustration"}
            </button>
            {stage === "generating" && <Progress label="Drawing — usually 10–25 seconds" />}
          </div>
        </section>
      )}

      {result && shown && (
        <section className="mt-6 space-y-4">
          <div className={`flex min-h-96 items-center justify-center rounded-2xl border border-neutral-800 p-6 ${bgClass}`}
               style={bgStyle ? { background: bgStyle } : undefined}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shown} alt="Generated illustration" className="max-h-[70vh] w-auto object-contain" />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-neutral-500">Preview on</span>
            {(["checker", "white", "black", "navy"] as const).map((b) => (
              <button key={b} onClick={() => setBg(b)}
                className={`rounded-lg border px-3 py-1.5 text-sm capitalize ${bg === b ? "border-neutral-500 bg-neutral-800 text-white" : "border-neutral-800 text-neutral-400 hover:bg-neutral-900"}`}>
                {b}
              </button>
            ))}
            <button onClick={() => setInverted((v) => !v)}
              className={`ml-auto rounded-lg border px-3 py-1.5 text-sm ${inverted ? "border-[#D82020] bg-[#D82020]/15 text-[#ff6b6b]" : "border-neutral-800 text-neutral-400 hover:bg-neutral-900"}`}>
              {inverted ? "Stencil (inverted)" : "Standard fill"}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <a href={result.png} download="illustration.png"
               className="rounded-xl bg-[#D82020] px-4 py-3 font-medium text-white hover:brightness-110">
              Download PNG
            </a>
            <a href={result.stencil} download="illustration-stencil.png"
               className="rounded-xl border border-neutral-700 px-4 py-3 font-medium text-neutral-200 hover:bg-neutral-800">
              Download stencil PNG
            </a>
            <button onClick={generate}
              className="rounded-xl border border-neutral-700 px-4 py-3 font-medium text-neutral-200 hover:bg-neutral-800">
              Generate again
            </button>
          </div>
          <p className="text-xs text-neutral-500">{result.width} × {result.height} · transparent background</p>
        </section>
      )}
    </main>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-neutral-500">{k}</dt>
      <dd className="text-right text-neutral-200">{v}</dd>
    </>
  );
}

function Progress({ label }: { label: string }) {
  return (
    <div className="mt-4 flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-600 border-t-[#D82020]" />
      <span className="text-sm text-neutral-300">{label}</span>
    </div>
  );
}
