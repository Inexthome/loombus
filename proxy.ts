import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/create/:path*",
    "/following/:path*",
    "/saved/:path*",
    "/profile/:path*",
    "/notifications/:path*",
    "/admin/:path*",
  ],
};
