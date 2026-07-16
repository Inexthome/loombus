import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/",
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
  ],
};
