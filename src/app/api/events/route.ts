import { NextRequest, NextResponse } from "next/server";
import {
  EventsError,
  createEvent,
  getEventsManageData,
  getPublicEvent,
  listPublicEvents,
  moderateEvent,
  reportEvent,
  respondToEvent,
  reviewEventReport,
  setEventLifecycle,
  updateEvent,
} from "@/lib/events-server";
import { enforceAdultOnlyAction } from "@/lib/teen-safety-server";

const ADULT_ONLY_ACTIONS = new Set(["create", "update", "reopen", "respond"]);

function response(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function errorResponse(error: unknown) {
  if (error instanceof EventsError) {
    return response({ error: error.message, code: error.code }, error.status);
  }
  console.error("Events request failed:", error);
  return response(
    { error: "The Events service could not complete this request.", code: "events_failed" },
    500
  );
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    if (params.get("manage") === "1") return response(await getEventsManageData(request));
    const slug = params.get("slug");
    if (slug) return response(await getPublicEvent(request, slug));
    return response(await listPublicEvents(request));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new EventsError("Invalid Events request.", 400, "invalid_payload");
    }
    const input = body as Record<string, unknown>;
    const action = String(input.action ?? "").trim();

    if (ADULT_ONLY_ACTIONS.has(action)) {
      const restriction = await enforceAdultOnlyAction(
        request,
        "Publishing, reopening, or responding to an Event"
      );
      if (restriction) return restriction;
    }

    if (action === "create") return response(await createEvent(request, input), 201);
    if (action === "update") return response(await updateEvent(request, input));
    if (["cancel", "reopen", "complete", "remove"].includes(action)) {
      return response(await setEventLifecycle(request, input));
    }
    if (action === "respond") return response(await respondToEvent(request, input));
    if (action === "report") return response(await reportEvent(request, input), 201);
    if (action === "moderate") return response(await moderateEvent(request, input));
    if (action === "review_report") return response(await reviewEventReport(request, input));
    throw new EventsError("Unsupported Events action.", 400, "unsupported_action");
  } catch (error) {
    return errorResponse(error);
  }
}
