import { NextResponse, type NextRequest } from "next/server";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";
import { createRequestSupabase } from "@/lib/room-operations";
import {
  RoomBillingError,
  isPaidRoomPlanKey,
  provisionFreeRoom,
  startPaidRoomCheckout,
} from "@/lib/room-billing";
import {
  freeRoomIsAvailable,
  provisionIncludedRoom,
} from "@/lib/room-plan-capacity";
import { normalizeRoomPlanKey } from "@/lib/room-plan-entitlements";
import {
  getRoomCheckoutStorageMessage,
  getRoomCheckoutStorageReadiness,
} from "@/lib/room-checkout-readiness";
import { ROOM_MODELS, ROOM_PLANS } from "@/app/rooms/rooms-v2-model";

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json(code ? { error: message, code } : { error: message }, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function trustedCheckoutOrigin(value: string | null | undefined) {
  if (!value) return null;

  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase();
    const isLoombusHost =
      hostname === "loombus.com" || hostname.endsWith(".loombus.com");
    const isVercelPreview = hostname.endsWith(".vercel.app");
    const isLocalHost =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]";

    if (!isLoombusHost && !isVercelPreview && !isLocalHost) return null;
    if (!isLocalHost && parsed.protocol !== "https:") return null;
    if (isLocalHost && !["http:", "https:"].includes(parsed.protocol)) return null;

    return parsed.origin;
  } catch {
    return null;
  }
}

function getOrigin(request: NextRequest) {
  const candidates = [
    request.headers.get("origin"),
    request.nextUrl.origin,
    process.env.NEXT_PUBLIC_SITE_URL,
  ];

  for (const candidate of candidates) {
    const origin = trustedCheckoutOrigin(candidate);
    if (origin) return origin;
  }

  return "https://loombus.com";
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
    modelId?: unknown;
    planId?: unknown;
    roomName?: unknown;
    description?: unknown;
  };

  const modelId = typeof body.modelId === "string" ? body.modelId.trim() : "";
  const planId = typeof body.planId === "string" ? body.planId.trim() : "";
  const roomName = typeof body.roomName === "string" ? body.roomName.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : "";

  if (!ROOM_MODELS.some((model) => model.id === modelId)) {
    return jsonError("Choose a valid Room model.", 400, "invalid_room_model");
  }

  if (!ROOM_PLANS.some((plan) => plan.id === planId)) {
    return jsonError("Choose a valid Room plan.", 400, "invalid_room_plan");
  }

  if (roomName.length < 3 || roomName.length > 80) {
    return jsonError(
      "Enter a Room name between 3 and 80 characters.",
      400,
      "invalid_room_name"
    );
  }

  if (description.length < 10 || description.length > 600) {
    return jsonError(
      "Enter a Room purpose between 10 and 600 characters.",
      400,
      "invalid_room_description"
    );
  }

  try {
    const paidPlan = isPaidRoomPlanKey(planId);
    const input = {
      userId: accountAccess.user.id,
      email: accountAccess.user.email ?? null,
      roomName,
      description,
      modelId,
      planKey: planId,
      origin: getOrigin(request),
    };

    if (planId === "free") {
      const available = await freeRoomIsAvailable(input.userId);
      if (!available) {
        return jsonError(
          "The Free plan includes one active Room. Choose a paid plan for another Room.",
          409,
          "free_room_limit_reached"
        );
      }
    }

    if (paidPlan) {
      const includedRoom = await provisionIncludedRoom({
        userId: input.userId,
        roomName,
        description,
        modelId,
        planKey: normalizeRoomPlanKey(planId),
      });

      if (includedRoom) {
        return NextResponse.json(includedRoom, {
          headers: { "Cache-Control": "private, no-store" },
        });
      }

      const storage = await getRoomCheckoutStorageReadiness();
      if (!storage.ready) {
        return jsonError(
          getRoomCheckoutStorageMessage(storage.issue),
          503,
          `room_checkout_${storage.issue}`
        );
      }
    }

    const result =
      planId === "free"
        ? await provisionFreeRoom(input)
        : paidPlan
          ? await startPaidRoomCheckout(input)
          : null;

    if (!result) {
      return jsonError("Invalid Room plan selected.", 400, "invalid_room_plan");
    }

    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof RoomBillingError) {
      if (error.code === "room_checkout_intent_failed") {
        return jsonError(
          "Room checkout storage rejected the setup. Apply the latest Room billing repair migration in Supabase, then retry.",
          503,
          "room_checkout_storage_rejected"
        );
      }

      return jsonError(error.message, error.status, error.code);
    }

    console.error("Room provisioning failed:", error);
    return jsonError(
      error instanceof Error
        ? error.message
        : "Loombus could not provision this Room.",
      500,
      "room_provision_failed"
    );
  }
}
