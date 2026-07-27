import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { refreshDueAgeTransitions } from "@/lib/teen-safety-server";

function response(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const authorization = request.headers.get("authorization") ?? "";
  return authorization === `Bearer ${secret}`;
}

async function processTransitions(request: NextRequest) {
  if (!authorized(request)) return response({ error: "Unauthorized." }, 401);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return response({ error: "Age transition service is not configured." }, 500);

  const service = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const result = await refreshDueAgeTransitions(service);
  if (result.error) {
    return response({ error: result.error.message }, 500);
  }

  return response({
    ok: true,
    transitioned: result.transitioned,
    processedAt: new Date().toISOString(),
    privacyPreserved: true,
  });
}

export async function GET(request: NextRequest) {
  return processTransitions(request);
}

export async function POST(request: NextRequest) {
  return processTransitions(request);
}
