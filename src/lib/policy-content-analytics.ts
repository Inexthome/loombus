import "server-only";

import { createClient } from "@supabase/supabase-js";

export type PolicyAnalyticsSurface = "current" | "history" | "archive";

export type PolicyAnalyticsAggregateRow = {
  event_date: string;
  surface: PolicyAnalyticsSurface;
  document_id: string;
  version: string;
  view_count: number;
};

function createPolicyAnalyticsServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing policy analytics service configuration.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function incrementPolicyContentDailyView(input: {
  surface: PolicyAnalyticsSurface;
  documentId: string;
  version: string;
}) {
  const supabase = createPolicyAnalyticsServiceClient();
  const { error } = await supabase.rpc("increment_policy_content_daily_analytics", {
    p_surface: input.surface,
    p_document_id: input.documentId,
    p_version: input.version,
  });

  if (error) {
    throw new Error(`Policy analytics increment failed: ${error.message}`);
  }
}

export async function readPolicyContentDailyAnalytics(input: {
  startDate: string;
  endDate: string;
}) {
  const supabase = createPolicyAnalyticsServiceClient();
  const { data, error } = await supabase
    .from("policy_content_daily_analytics")
    .select("event_date,surface,document_id,version,view_count")
    .gte("event_date", input.startDate)
    .lte("event_date", input.endDate)
    .order("event_date", { ascending: false })
    .order("document_id", { ascending: true })
    .order("surface", { ascending: true });

  if (error) {
    throw new Error(`Policy analytics read failed: ${error.message}`);
  }

  return (data ?? []) as PolicyAnalyticsAggregateRow[];
}
