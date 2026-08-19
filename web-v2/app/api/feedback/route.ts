import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import type { FeedbackItem } from "../../lib/feedback";

export const runtime = "nodejs";

/**
 * Write a round of feedback into the repo as markdown the agent reads.
 *
 * Appended rather than overwritten, so several rounds over an afternoon build
 * up in one file instead of each one erasing the last.
 *
 * Refuses outright in a production build. This route writes to the filesystem
 * from an unauthenticated request, which is fine on a local dev box and is not
 * fine anywhere else — the widget is compiled out of production too, so this
 * is the second of two locks rather than the only one.
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "feedback is a local development tool" }, { status: 403 });
  }

  try {
    const { items } = (await req.json()) as { items: FeedbackItem[] };
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "nothing to send" }, { status: 400 });
    }

    const dir = path.join(process.cwd(), "feedback");
    await fs.mkdir(dir, { recursive: true });

    const now = new Date();
    const stamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);

    const byScreen = new Map<string, FeedbackItem[]>();
    for (const it of items) {
      const k = it.screen || "unknown";
      byScreen.set(k, [...(byScreen.get(k) ?? []), it]);
    }

    const lines: string[] = [
      `## Round — ${now.toLocaleString()}`,
      "",
      `${items.length} note${items.length === 1 ? "" : "s"}.`,
      "",
    ];

    for (const [screen, group] of byScreen) {
      lines.push(`### Screen: \`${screen}\``, "");
      for (const it of group) {
        lines.push(`- **${it.note}**`);
        if (it.target) {
          const t = it.target;
          lines.push(`  - element: \`<${t.tag}>\` ${t.label}`);
          if (t.classes) lines.push(`  - classes: \`${t.classes}\``);
          lines.push(`  - box: ${t.rect.w}x${t.rect.h} at (${t.rect.x}, ${t.rect.y})`);
          const style = Object.entries(t.styles).map(([k, v]) => `${k}: ${v}`).join("; ");
          if (style) lines.push(`  - computed: ${style}`);
        }
        lines.push(`  - viewport: ${it.viewport.w}x${it.viewport.h}`);
        lines.push("");
      }
    }
    lines.push("---", "");

    const md = lines.join("\n");
    const file = path.join(dir, "FEEDBACK.md");

    let existing = "";
    try {
      existing = await fs.readFile(file, "utf8");
    } catch {
      existing = "# Project 88 v2 - feedback\n\nWritten by the in-app widget. Newest round at the bottom.\n\n";
    }
    await fs.writeFile(file, existing + md, "utf8");

    // keep the raw payload too, so nothing is lost to the markdown formatting
    await fs.writeFile(path.join(dir, `raw-${stamp}.json`), JSON.stringify(items, null, 2), "utf8");

    return NextResponse.json({ ok: true, count: items.length, file: path.relative(process.cwd(), file) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
