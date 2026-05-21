import { NextResponse, type NextRequest } from "next/server";

const NO_STORE_ROUTES = [
  "/dashboard",
  "/settings",
  "/people",
  "/notifications",
  "/logout",
  "/login",
];

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const shouldNoStore = NO_STORE_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  const response = NextResponse.next();

  if (shouldNoStore) {
    response.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate"
    );
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
    response.headers.set("Surrogate-Control", "no-store");
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/settings/:path*",
    "/people/:path*",
    "/notifications/:path*",
    "/logout/:path*",
    "/login/:path*",
  ],
};
