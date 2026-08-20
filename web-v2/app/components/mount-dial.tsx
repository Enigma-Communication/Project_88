"use client";

import { useEffect, useState } from "react";
import { loadMount, saveMount, MOUNT_DEFAULT, MOUNT_PRESETS } from "../lib/mount";

/**
 * The white-mount dial. Local development only, same as the feedback widget.
 *
 * The mount is the one dial on detail-versus-boldness that does not ask the
 * operator to re-crop, and the right setting is a judgement call rather than a
 * measurement — so it has to be changeable between two generations of the same
 * photo. An env var cannot do that: it needs a dev-server restart, by which
 * point the comparison is being made from memory.
 *
 * Sits bottom-LEFT because the feedback widget already owns bottom-right, and
 * two floating panels on the same corner would overlap on a phone.
 *
 * Collapsed to a single chip until opened. It is a testing instrument sitting
 * on top of a screen that is itself under review, and a permanent control panel
 * over the corner of every screenshot would distort the thing being judged.
 */
export default function MountDial() {
  const [value, setValue] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  // read after mount, never during render — localStorage does not exist on the
  // server and the markup has to match what the server sent
  useEffect(() => { setValue(loadMount()); }, []);

  if (value === null) return null;

  const pick = (v: number) => { setValue(v); saveMount(v); };
  const pct = Math.round((1 / (1 + 2 * value)) * 100);

  return (
    <div className="fixed bottom-4 left-4 z-50 select-none">
      {open && (
        <div className="mb-2 w-[228px] rounded-[6px] border border-hairline bg-white p-3 shadow-lg">
          <div className="flex items-baseline justify-between">
            <span className="eyebrow text-[10px] text-body">White mount</span>
            <span className="label label-reg text-[10px] text-muted">dev only</span>
          </div>

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {MOUNT_PRESETS.map((m) => (
              <button
                key={m}
                onClick={() => pick(m)}
                className={`label label-reg rounded-[3px] border px-2 py-1 text-[11px] transition ${
                  m === value
                    ? "border-edge bg-[#111] text-white"
                    : "border-hairline text-body hover:border-edge"
                }`}
              >
                {m === 0 ? "off" : m.toFixed(2)}
              </button>
            ))}
          </div>

          {/*
            The number on its own means nothing to the eye, so say what it does.
            Deliberately "your crop", not "the athlete": the mount is measured
            against the crop, and the athlete is smaller than that by whatever
            headroom the framing left. Saying athlete here reads as a promise
            the number does not keep — measured on DSC02294 at 0.15, the crop
            holds 77% of the frame and the athlete only 68%.
          */}
          <p className="meta mt-2.5 text-[10px] leading-[1.5] text-[#4d4b47]">
            {value === 0
              ? "No mount — your crop fills the frame. Most literal, most detail."
              : `Your crop fills about ${pct}% of the frame, the rest is white. More mount reads bolder and flatter.`}
            {value !== MOUNT_DEFAULT && (
              <> <button onClick={() => pick(MOUNT_DEFAULT)} className="underline">reset to {MOUNT_DEFAULT}</button></>
            )}
          </p>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        className="label label-reg rounded-[4px] border border-hairline bg-white px-2.5 py-1.5 text-[11px] text-body shadow-sm transition hover:border-edge"
        title="White mount — local testing only"
      >
        mount {value === 0 ? "off" : value.toFixed(2)}
      </button>
    </div>
  );
}
