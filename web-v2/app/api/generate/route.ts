import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { generateImage } from "p88-core/gemini";
import { buildPrompt } from "p88-core/prompt";
import { matteToInk, stripBorderFrame, stencilInvert } from "p88-core/matte";
import { DEFAULT_IMAGE_MODEL, type ImageModelKey } from "p88-core/config";
import type { Triage } from "p88-core/gemini";

export const maxDuration = 120;
export const runtime = "nodejs";

/**
 * Generate from an already-preflighted photo plus a crop box the operator may
 * have adjusted. The API key never leaves the server.
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("photo");
    const triageRaw = form.get("triage");
    const boxRaw = form.get("box");
    const model = (form.get("model") as string | null) ?? DEFAULT_IMAGE_MODEL;

    if (!(file instanceof File)) return NextResponse.json({ error: "no photo supplied" }, { status: 400 });
    if (typeof triageRaw !== "string") return NextResponse.json({ error: "missing preflight data" }, { status: 400 });

    const t = JSON.parse(triageRaw) as Triage;
    const src = Buffer.from(await file.arrayBuffer());

    // The white mount. A tighter crop reads as "transcribe this" and a mounted
    // one as "make a print of this" — see mountGeometry for why. Per-request so
    // a sweep can compare widths against one photo without restarting dev.
    const mountRaw = form.get("mount");
    const { toModelInput, MOUNT } = await import("p88-core/crop");
    const mount = typeof mountRaw === "string" && mountRaw !== "" ? Number(mountRaw) : MOUNT;
    if (!Number.isFinite(mount) || mount < 0 || mount > 2) {
      return NextResponse.json({ error: `mount must be between 0 and 2, got ${mountRaw}` }, { status: 400 });
    }

    // use the operator's box when supplied, else the proposed one
    let cropped: Buffer;
    if (typeof boxRaw === "string") {
      const b = JSON.parse(boxRaw) as { left: number; top: number; width: number; height: number };
      cropped = (await toModelInput(src, {
        left: Math.round(b.left), top: Math.round(b.top),
        width: Math.round(b.width), height: Math.round(b.height),
      }, mount)).buffer;
    } else {
      const { cropToSubject } = await import("p88-core/crop");
      cropped = (await cropToSubject(src, t, { mount })).buffer;
    }

    const raw = await generateImage(model as ImageModelKey, buildPrompt(t), [
      { b64: cropped.toString("base64"), mime: "image/jpeg" },
    ]);
    if (!raw) return NextResponse.json({ error: "the model returned no image — try again" }, { status: 502 });

    const inked = await stripBorderFrame(await matteToInk(raw));
    const stencil = await stencilInvert(inked);
    const meta = await sharp(inked).metadata();

    return NextResponse.json({
      png: `data:image/png;base64,${inked.toString("base64")}`,
      stencil: `data:image/png;base64,${stencil.toString("base64")}`,
      // the crop that produced it, so the result screen can hold-to-compare
      // against what the model actually saw rather than the whole photo —
      // mount included, because that is now part of what it saw
      sourceCrop: `data:image/jpeg;base64,${cropped.toString("base64")}`,
      mount,
      width: meta.width,
      height: meta.height,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg.includes("limit: 0") || msg.includes("RESOURCE_EXHAUSTED") ? 429 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
