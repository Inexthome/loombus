import { screenDuplicateRequest } from "@/lib/duplicate-request-screening";
import { updateSession } from "@/lib/supabase/proxy";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const DUPLICATE_API_PATHS = new Set([
  "/api/discussions/create",
  "/api/replies/create",
  "/api/businesses",
]);

export async function middleware(request: NextRequest) {
  if (DUPLICATE_API_PATHS.has(request.nextUrl.pathname)) {
    return (await screenDuplicateRequest(request)) ?? NextResponse.next();
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/",
    "/create/:path*",
    "/following/:path*",
    "/saved/:path*",
    "/profile/:path*",
    "/notifications/:path*",
    "/admin/:path*",
    "/api/discussions/create",
    "/api/replies/create",
    "/api/businesses",
  ],
};
