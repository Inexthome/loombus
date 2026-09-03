import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_MEMBER_SETTINGS,
  normalizeMemberSettings,
  type MemberSettings,
} from "@/lib/member-settings";

export function createMemberSettingsServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function getMemberSettingsForUser(
  userId: string,
  client?: SupabaseClient
): Promise<MemberSettings> {
  const service = client ?? createMemberSettingsServiceClient();
  if (!service) return DEFAULT_MEMBER_SETTINGS;

  const { data, error } = await service
    .from("member_settings")
    .select("preferences")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Member settings lookup failed:", error.message);
    return DEFAULT_MEMBER_SETTINGS;
  }

  return normalizeMemberSettings(data?.preferences ?? DEFAULT_MEMBER_SETTINGS);
}
