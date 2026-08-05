import { screenDuplicateRequest } from "@/lib/duplicate-request-screening";
import { screenPhase2DuplicateRequest } from "@/lib/duplicate-request-screening-phase2";
import { updateSession } from "@/lib/supabase/proxy";
import { NextResponse, type NextRequest } from "next/server";

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

function redirectLegacyDiscussionTopic(request: NextRequest) {
  const topic = request.nextUrl.searchParams.get("topic")?.trim();
  if (request.nextUrl.pathname !== "/discussions" || !topic) return null;

  const destination = request.nextUrl.clone();
  destination.pathname = `/topics/${encodeURIComponent(topic)}`;
  destination.search = "";
  return NextResponse.redirect(destination);
}

export async function proxy(request: NextRequest) {
  const topicRedirect = redirectLegacyDiscussionTopic(request);
  if (topicRedirect) return topicRedirect;

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
    "/discussions",
    "/create",
    "/create/:path*",
    "/following",
    "/following/:path*",
    "/saved",
    "/saved/:path*",
    "/profile",
    "/profile/:path*",
    "/notifications",
    "/notifications/:path*",
    "/admin",
    "/admin/:path*",
    "/the-floor",
    "/the-floor/:path*",
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
