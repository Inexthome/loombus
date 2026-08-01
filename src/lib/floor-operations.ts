import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

export function createFloorRequestSupabase(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase request configuration.");
  }

  const authorization = request.headers.get("authorization") ?? "";

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: authorization ? { Authorization: authorization } : {},
    },
  });
}

export function createFloorServiceSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Floor service configuration.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function hasActiveFloorAccess(
  supabase: ReturnType<typeof createFloorRequestSupabase>,
  userId: string
) {
  const [{ data: profile }, { data: subscription }] = await Promise.all([
    supabase.from("profiles").select("is_admin").eq("id", userId).maybeSingle(),
    supabase
      .from("floor_subscriptions")
      .select("status")
      .eq("user_id", userId)
      .in("status", ["active", "trialing"])
      .maybeSingle(),
  ]);
  return profile?.is_admin === true || Boolean(subscription);
}
