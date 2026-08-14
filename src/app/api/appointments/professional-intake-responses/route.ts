import { NextRequest, NextResponse } from "next/server";
import {
  getProfessionalBookingIntakeResponses,
  ProfessionalBookingIntakeResponsesError,
} from "@/lib/professional-booking-intake-responses-server";

function response(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET(request: NextRequest) {
  try {
    return response(await getProfessionalBookingIntakeResponses(request));
  } catch (error) {
    if (error instanceof ProfessionalBookingIntakeResponsesError) {
      return response(
        { error: error.message, code: error.code },
        error.status,
      );
    }

    console.error("Professional Booking intake responses request failed:", error);
    return response(
      {
        error: "Professional Booking client intake responses could not be loaded.",
        code: "professional_booking_intake_responses_failed",
      },
      500,
    );
  }
}
