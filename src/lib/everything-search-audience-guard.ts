import "server-only";

import type { NextRequest } from "next/server";
import {
  EverythingSearchError,
  runEverythingSearch as runBaseEverythingSearch,
} from "./everything-search-server";
import { createRoomServiceSupabase } from "@/lib/room-operations";

export { EverythingSearchError };

const EMPTY_DISCUSSION_ID = "00000000-0000-4000-8000-000000000000";

async function discussionAudienceControlsAreActive() {
  const serviceSupabase = createRoomServiceSupabase();
  const { error } = await serviceSupabase.rpc("can_view_discussion_audience", {
    p_discussion_id: EMPTY_DISCUSSION_ID,
    p_viewer_user_id: null,
  });

  if (!error) return true;

  const missing =
    error.code === "42883" ||
    /can_view_discussion_audience|schema cache|could not find the function/i.test(
      error.message ?? ""
    );

  if (missing) return false;

  throw new EverythingSearchError(
    "Everything Search could not verify Discussion privacy.",
    503,
    "discussion_audience_check_unavailable"
  );
}

export async function runEverythingSearch({
  request,
  query,
  limit,
}: {
  request: NextRequest;
  query: unknown;
  limit?: number;
}) {
  const result = await runBaseEverythingSearch({ request, query, limit });

  if (result.indexed) return result;

  const audienceControlsActive = await discussionAudienceControlsAreActive();
  if (audienceControlsActive) {
    throw new EverythingSearchError(
      "Everything Search is temporarily unavailable while privacy-safe indexing recovers.",
      503,
      "privacy_safe_search_index_required"
    );
  }

  return result;
}
