import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedRoutes = [
  "/create",
  "/following",
  "/saved",
  "/profile",
  "/admin",
];

export function middleware(request: NextRequest) {
  const token =
    request.cookies.get("sb-access-token") ||
    request.cookies.get("supabase-auth-token");

  const pathname = request.nextUrl.pathname;

  const requiresAuth = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (requiresAuth && !token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/create/:path*",
    "/following/:path*",
    "/saved/:path*",
    "/profile/:path*",
    "/admin/:path*",
  ],
};
