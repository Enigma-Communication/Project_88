import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/** Drop the session cookie. The gate does the rest on the next request. */
export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("p88", "", { httpOnly: true, path: "/", maxAge: 0, sameSite: "lax", secure: req.nextUrl.protocol === "https:" });
  return res;
}
