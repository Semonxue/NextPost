import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export const runtime = "experimental-edge";

// Lightweight Edge-compatible middleware: reads JWT from cookie directly
// (next-auth's auth() uses jose which needs Node.js; this bypasses that.)
export async function middleware(request: Request) {
  const pathname = new URL(request.url).pathname;

  // Allow static assets and API auth routes through
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/api/mcp")
  ) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request as any,
    secret: process.env.AUTH_SECRET,
  });

  const isLoggedIn = !!token;
  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/register");

  if (!isLoggedIn && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
