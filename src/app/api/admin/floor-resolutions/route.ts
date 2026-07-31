import { NextResponse, type NextRequest } from "next/server";
import { createFloorRequestSupabase, createFloorServiceSupabase } from "@/lib/floor-operations";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: { "Cache-Control": "private, no-store" },
    }
  );
}

export async function GET(request: NextRequest) {
  const supabase = createFloorRequestSupabase(request);
  const accountAccess = await verifyRequestAccountAccess(supabase);

  if (!accountAccess.ok) {
    return jsonError(accountAccess.error, accountAccess.status);
  }
  if (!accountAccess.profile.is_admin) {
    return jsonError("Admin access required.", 403);
  }

  const service = createFloorServiceSupabase();
  const { data, error } = await service
    .from("floor_call_resolution_proposals")
    .select(
      "id, call_id, status, proposed_outcome, proposed_resolved_value, data_source, resolved_on, reviewed_by, reviewed_at, review_note, created_at, floor_calls(id, ticker, prediction, comparator, target_value, target_value_high, resolves_by, author:profiles!floor_calls_author_id_fkey(username, full_name), floor_theses(id, thesis))"
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) {
    return jsonError(error.message || "Unable to load proposals.", 500);
  }

  return NextResponse.json(
    { proposals: data ?? [] },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
