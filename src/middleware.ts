import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

// Lightweight Edge-compatible middleware: reads JWT from cookie directly
// (next-auth's auth() uses jose which needs Node.js; this bypasses that.)
export async function middleware(request: Request) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Allow static assets and API auth routes through
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/api/mcp") ||
    pathname.startsWith("/api/uploads/")
  ) {
    return NextResponse.next();
  }

  // CF Workers / HTTPS: cookie name is prefixed with "__Secure-".
  // getToken() defaults secureCookie=false and looks for "authjs.session-token",
  // so without this it never finds the session-token cookie.
  const isHttps = url.protocol === "https:";
  const token = await getToken({
    req: request as any,
    secret: process.env.AUTH_SECRET,
    secureCookie: isHttps,
    cookieName: isHttps ? "__Secure-authjs.session-token" : "authjs.session-token",
    salt: isHttps ? "__Secure-authjs.session-token" : "authjs.session-token",
  });

  const isLoggedIn = !!token;
  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/register");

  if (!isLoggedIn && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", url));
  }

  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/", url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
