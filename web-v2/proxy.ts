import { NextRequest, NextResponse } from "next/server";

/**
 * Single shared password, held in APP_PASSWORD. Internal club staff tool —
 * this is a gate, not an identity system.
 *
 * Differs from the stable app in one way: that build answers with a 401 and
 * lets the browser draw its own Basic-auth dialog, so the very first contact
 * anyone has with the tool is a grey system box with a URL in it. Board 01
 * replaces that with a real screen, so this redirects to /login instead.
 *
 * Unset APP_PASSWORD leaves the app open, which is what a fresh clone with no
 * env file should do rather than locking the developer out of their own build.
 */
const PUBLIC = ["/login", "/api/login", "/api/logout"];

export function proxy(req: NextRequest) {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return NextResponse.next();

  const { pathname } = req.nextUrl;
  const authed = req.cookies.get("p88")?.value === expected;

  if (PUBLIC.some((p) => pathname.startsWith(p))) {
    // already in — no reason to show the gate again
    if (authed && pathname === "/login") {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  if (authed) return NextResponse.next();

  const to = new URL("/login", req.url);
  // come back to where they were aiming once they are through
  if (pathname !== "/") to.searchParams.set("next", pathname);
  return NextResponse.redirect(to);
}

/*
 * Static files have to pass the gate, not sit behind it.
 *
 * The sign-in screen is served to people who are by definition not signed in,
 * and it needs the lockup frames, the Enigma credit and the two licensed fonts
 * — all of which live in public/ and are served from the root. With only the _next
 * paths excluded they were being redirected to /login themselves, so the gate
 * rendered with broken images and fallback type.
 *
 * Nothing sensitive is in public/: fonts, the example plates, the lockup. Every
 * generated illustration is held in the browser, never written there.
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpe?g|svg|webp|gif|ico|woff2?|ttf|otf|css|js|map|txt|webmanifest)$).*)"],
};
