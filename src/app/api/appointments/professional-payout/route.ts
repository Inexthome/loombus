import { NextRequest, NextResponse } from "next/server";
import {
  getProfessionalBookingPayout,
  openProfessionalBookingPayoutDashboard,
  ProfessionalBookingPayoutError,
  refreshProfessionalBookingPayout,
  startProfessionalBookingPayoutOnboarding,
} from "@/lib/professional-booking-payout-server";

function response(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function errorResponse(error: unknown) {
  if (error instanceof ProfessionalBookingPayoutError) {
    return response({ error: error.message, code: error.code }, error.status);
  }

  console.error("Professional Booking payout request failed:", error);
  return response(
    {
      error: "Professional Booking payout setup could not complete this request.",
      code: "professional_booking_payout_failed",
    },
    500
  );
}

export async function GET(request: NextRequest) {
  try {
    return response(await getProfessionalBookingPayout(request));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action ?? "").trim().toLowerCase();

    if (action === "start_onboarding") {
      return response(await startProfessionalBookingPayoutOnboarding(request));
    }
    if (action === "refresh") {
      return response(await refreshProfessionalBookingPayout(request));
    }
    if (action === "open_dashboard") {
      return response(await openProfessionalBookingPayoutDashboard(request));
    }

    throw new ProfessionalBookingPayoutError(
      "Unsupported Professional Booking payout action.",
      400,
      "professional_booking_payout_action_invalid"
    );
  } catch (error) {
    return errorResponse(error);
  }
}
