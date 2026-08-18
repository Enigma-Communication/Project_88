import { NextRequest, NextResponse } from "next/server";

/**
 * Single shared password, held in APP_PASSWORD. Internal club staff tool —
 * this is a gate, not an identity system. Static assets stay public so the
 * login page can style itself.
 */
export function proxy(req: NextRequest) {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return NextResponse.next(); // unset (local dev) = open

  if (req.cookies.get("p88")?.value === expected) return NextResponse.next();

  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    const [, pass] = atob(header.slice(6)).split(":");
    if (pass === expected) {
      const res = NextResponse.next();
      res.cookies.set("p88", expected, { httpOnly: true, sameSite: "lax", secure: true, maxAge: 60 * 60 * 24 * 30 });
      return res;
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Project 88", charset="UTF-8"' },
  });
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
