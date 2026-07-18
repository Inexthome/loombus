import { NextRequest, NextResponse } from "next/server";
import {
  IntelligentMatchingError,
  createMatchingRule,
  deleteMatchingRule,
  getIntelligentMatches,
  setMatchCandidateState,
  submitMatchFeedback,
  updateMatchingPreferences,
} from "@/lib/intelligent-matching-server";

function response(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function errorResponse(error: unknown) {
  if (error instanceof IntelligentMatchingError) {
    return response({ error: error.message, code: error.code }, error.status);
  }
  console.error("Intelligent Matching request failed:", error);
  return response(
    {
      error: "Intelligent Matching could not complete this action.",
      code: "intelligent_matching_failed",
    },
    500,
  );
}

export async function GET(request: NextRequest) {
  try {
    return response(await getIntelligentMatches(request));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new IntelligentMatchingError(
        "Invalid Intelligent Matching action.",
        400,
        "invalid_matching_payload",
      );
    }
    const input = body as Record<string, unknown>;
    const action = String(input.action ?? "").trim();
    if (action === "refresh") {
      return response(await getIntelligentMatches(request));
    }
    if (action === "update_preferences") {
      return response(await updateMatchingPreferences(request, input));
    }
    if (action === "create_rule") {
      return response(await createMatchingRule(request, input), 201);
    }
    if (action === "delete_rule") {
      return response(await deleteMatchingRule(request, input));
    }
    if (action === "candidate_state") {
      return response(await setMatchCandidateState(request, input));
    }
    if (action === "feedback") {
      return response(await submitMatchFeedback(request, input));
    }
    throw new IntelligentMatchingError(
      "Unsupported Intelligent Matching action.",
      400,
      "unsupported_matching_action",
    );
  } catch (error) {
    return errorResponse(error);
  }
}
