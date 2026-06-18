import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// Use Node.js runtime for middleware (next-auth v5 uses jose which needs Node.js)
export const runtime = "nodejs";

export default auth((req) => {
  // 排除 API 路由
  if (req.nextUrl.pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  const isLoggedIn = !!req.auth;
  const isAuthPage = req.nextUrl.pathname.startsWith("/login") || 
                     req.nextUrl.pathname.startsWith("/register");

  if (!isLoggedIn && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
