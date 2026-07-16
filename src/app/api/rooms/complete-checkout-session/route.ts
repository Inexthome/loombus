import { NextResponse, type NextRequest } from "next/server";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";
import { createRequestSupabase } from "@/lib/room-operations";
import {
  RoomBillingError,
  completeRoomCheckoutSession,
} from "@/lib/room-billing";

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json(code ? { error: message, code } : { error: message }, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function validUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function validCheckoutSessionId(value: unknown): value is string {
  return typeof value === "string" && /^cs_(test|live)_[A-Za-z0-9]+$/.test(value);
}

export async function POST(request: NextRequest) {
  let requestSupabase;

  try {
    requestSupabase = createRequestSupabase(request);
  } catch {
    return jsonError("Rooms service is not configured.", 500, "rooms_not_configured");
  }

  const accountAccess = await verifyRequestAccountAccess(requestSupabase);
  if (!accountAccess.ok) {
    return jsonError(
      accountAccess.error,
      accountAccess.status,
      accountAccess.code
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    roomId?: unknown;
    sessionId?: unknown;
  };

  if (!validUuid(body.roomId) || !validCheckoutSessionId(body.sessionId)) {
    return jsonError(
      "A valid Room ID and Stripe checkout session are required.",
      400,
      "invalid_room_checkout_return"
    );
  }

  try {
    const result = await completeRoomCheckoutSession(
      body.sessionId,
      body.roomId,
      accountAccess.user.id
    );

    return NextResponse.json(
      { ok: true, ...result },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    if (error instanceof RoomBillingError) {
      return jsonError(error.message, error.status, error.code);
    }

    console.error("Room checkout completion failed:", error);
    return jsonError(
      "Loombus could not complete this Room checkout.",
      500,
      "room_checkout_completion_failed"
    );
  }
}
