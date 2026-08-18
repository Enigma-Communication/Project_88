import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { triage } from "p88-core/gemini";
import { judge } from "p88-core/verdict";
import { cropToSubject } from "p88-core/crop";

export const maxDuration = 60;
export const runtime = "nodejs";

/**
 * Preflight only. Runs the vision pass and returns the verdict plus the
 * proposed crop, so the operator can adjust the box before we spend a
 * generation on it.
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("photo");
    if (!(file instanceof File)) return NextResponse.json({ error: "no photo supplied" }, { status: 400 });

    const buf = Buffer.from(await file.arrayBuffer());
    const meta = await sharp(buf).rotate().metadata();
    if (!meta.width || !meta.height) return NextResponse.json({ error: "unreadable image" }, { status: 400 });

    const small = await sharp(buf).rotate().resize(1024, 1024, { fit: "inside" }).jpeg({ quality: 88 }).toBuffer();
    const t = await triage(small.toString("base64"));

    const crop = await cropToSubject(buf, t);
    const { verdict, reasons } = judge(t, crop.subjectPx);

    return NextResponse.json({
      verdict,
      reasons,
      subject: t.subject,
      faceVisibility: t.faceVisibility,
      motion: t.motion,
      people: t.people.length,
      overlaps: t.people.filter((p) => p.overlapsDominant).length,
      source: { width: meta.width, height: meta.height },
      // pixel box in the *rotated* source, for the crop UI
      box: crop.box,
      subjectPx: crop.subjectPx,
      preview: `data:image/jpeg;base64,${crop.buffer.toString("base64")}`,
      triage: t,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg.includes("limit: 0") || msg.includes("RESOURCE_EXHAUSTED") ? 429 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
