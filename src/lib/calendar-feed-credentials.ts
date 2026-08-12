import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const CALENDAR_FEED_TOKEN_BYTES = 32;
const CALENDAR_FEED_TOKEN_HINT_LENGTH = 8;

export type CalendarFeedCredentialRow = {
  user_id: string;
  token_hash: string;
  token_hint: string;
  created_at: string;
  updated_at: string;
  revoked_at: string | null;
};

export function hashCalendarFeedToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createCalendarFeedToken() {
  const token = randomBytes(CALENDAR_FEED_TOKEN_BYTES).toString("base64url");

  return {
    token,
    tokenHash: hashCalendarFeedToken(token),
    tokenHint: token.slice(-CALENDAR_FEED_TOKEN_HINT_LENGTH),
  };
}

export function createCalendarFeedServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Calendar feed service configuration is incomplete.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
