import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSubscriptionEntitlementDecisionForUser } from "@/lib/subscription-access";

export function getBookmarkMutationSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase service configuration.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function hasUnlimitedOrganization(userId: string) {
  const decision = await getSubscriptionEntitlementDecisionForUser(
    userId,
    "unlimited_organization"
  );

  return decision.allowed;
}
