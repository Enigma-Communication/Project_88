import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Exchange the shared password for the session cookie.
 *
 * The comparison happens here rather than in the browser so the password never
 * reaches the client — the gate is only worth anything if the secret stays on
 * the server side of it.
 */
export async function POST(req: NextRequest) {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return NextResponse.json({ ok: true });

  const { password } = (await req.json().catch(() => ({}))) as { password?: string };

  if (typeof password !== "string" || password !== expected) {
    return NextResponse.json({ error: "That password is not right." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("p88", expected, {
    httpOnly: true,
    sameSite: "lax",
    // the club runs this over plain http on the LAN, so Secure would drop it
    secure: req.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
