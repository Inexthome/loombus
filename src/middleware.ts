import { screenDuplicateRequest } from "@/lib/duplicate-request-screening";
import { screenPhase2DuplicateRequest } from "@/lib/duplicate-request-screening-phase2";
import { updateSession } from "@/lib/supabase/proxy";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PHASE1_DUPLICATE_API_PATHS = new Set([
  "/api/discussions/create",
  "/api/replies/create",
  "/api/businesses",
]);

const PHASE2_DUPLICATE_API_PATHS = new Set([
  "/api/marketplace",
  "/api/jobs",
  "/api/events",
  "/api/requests",
  "/api/services",
]);

export async function middleware(request: NextRequest) {
  if (PHASE1_DUPLICATE_API_PATHS.has(request.nextUrl.pathname)) {
    return (await screenDuplicateRequest(request)) ?? NextResponse.next();
  }

  if (PHASE2_DUPLICATE_API_PATHS.has(request.nextUrl.pathname)) {
    return (await screenPhase2DuplicateRequest(request)) ?? NextResponse.next();
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
    "/api/marketplace",
    "/api/jobs",
    "/api/events",
    "/api/requests",
    "/api/services",
  ],
};
