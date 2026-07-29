import { NextResponse, type NextRequest } from "next/server";
import {
  RoomBillingError,
} from "@/lib/room-billing";
import {
  changeRoomPaidPlan,
  createRoomBillingPortal,
  getRoomBillingOverview,
  setRoomCancellation,
  startExistingRoomUpgrade,
} from "@/lib/room-billing-management";
import {
  administratorRoomIsComped,
  changeAdministratorRoomPlan,
} from "@/lib/admin-room-provisioning";
import { createRequestSupabase } from "@/lib/room-operations";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";

type RouteContext = { params: Promise<{ roomId: string }> };

function jsonError(error: unknown) {
  if (error instanceof RoomBillingError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status, headers: { "Cache-Control": "private, no-store" } }
    );
  }
  return NextResponse.json(
    { error: "Room billing could not be completed.", code: "room_billing_error" },
    { status: 500, headers: { "Cache-Control": "private, no-store" } }
  );
}

function validUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function authorize(request: NextRequest) {
  const account = await verifyRequestAccountAccess(createRequestSupabase(request));
  if (!account.ok) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: account.error, code: account.code },
        { status: account.status, headers: { "Cache-Control": "private, no-store" } }
      ),
    };
  }
  return {
    ok: true as const,
    user: account.user,
    profile: account.profile,
  };
}

export async function GET(request: NextRequest, context: RouteContext) {
  const authorized = await authorize(request);
  if (!authorized.ok) return authorized.response;
  const { roomId } = await context.params;
  if (!validUuid(roomId)) {
    return NextResponse.json({ error: "Invalid Room id." }, { status: 400 });
  }
  try {
    const overview = await getRoomBillingOverview(roomId, authorized.user.id);
    const adminComped =
      authorized.profile.is_admin === true &&
      (await administratorRoomIsComped(roomId, authorized.user.id));

    if (adminComped) {
      overview.currentPlan.priceLabel = "Administrator included";
      overview.availablePlans = overview.availablePlans.map((plan) => ({
        ...plan,
        priceLabel: "Administrator included",
        selfServe: true,
        contactSales: false,
      }));
      overview.billingConfigured = false;
      overview.hasStripeSubscription = false;
      overview.invoices = [];
    }

    return NextResponse.json(
      { ...overview, adminComped },
      {
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const authorized = await authorize(request);
  if (!authorized.ok) return authorized.response;
  const { roomId } = await context.params;
  if (!validUuid(roomId)) {
    return NextResponse.json({ error: "Invalid Room id." }, { status: 400 });
  }
  const body = await request.json().catch(() => ({}));
  const action = typeof body?.action === "string" ? body.action : "";
  const origin = request.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://loombus.com";

  try {
    const adminComped =
      authorized.profile.is_admin === true &&
      (await administratorRoomIsComped(roomId, authorized.user.id));

    if (adminComped) {
      if (action === "upgrade" || action === "change_plan") {
        return NextResponse.json(
          await changeAdministratorRoomPlan(
            roomId,
            authorized.user.id,
            String(body?.planKey ?? "")
          ),
          { headers: { "Cache-Control": "private, no-store" } }
        );
      }

      if (["portal", "schedule_cancel", "resume"].includes(action)) {
        return NextResponse.json(
          {
            error: "Administrator-included Rooms do not use Stripe billing.",
            code: "admin_room_not_billed",
          },
          { status: 409, headers: { "Cache-Control": "private, no-store" } }
        );
      }
    }

    if (action === "portal") {
      return NextResponse.json(
        await createRoomBillingPortal(roomId, authorized.user.id, origin),
        { headers: { "Cache-Control": "private, no-store" } }
      );
    }
    if (action === "upgrade") {
      return NextResponse.json(
        await startExistingRoomUpgrade(
          roomId,
          authorized.user.id,
          authorized.user.email ?? null,
          String(body?.planKey ?? ""),
          origin
        ),
        { headers: { "Cache-Control": "private, no-store" } }
      );
    }
    if (action === "change_plan") {
      return NextResponse.json(
        await changeRoomPaidPlan(
          roomId,
          authorized.user.id,
          String(body?.planKey ?? "")
        ),
        { headers: { "Cache-Control": "private, no-store" } }
      );
    }
    if (action === "schedule_cancel" || action === "resume") {
      return NextResponse.json(
        await setRoomCancellation(
          roomId,
          authorized.user.id,
          action === "schedule_cancel"
        ),
        { headers: { "Cache-Control": "private, no-store" } }
      );
    }
    return NextResponse.json(
      { error: "Unknown Room billing action." },
      { status: 400, headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    return jsonError(error);
  }
}
