import { NextRequest, NextResponse } from "next/server";
import {
  getProfessionalBookingAvailability,
  ProfessionalBookingAvailabilityError,
  saveProfessionalBookingAvailability,
} from "@/lib/professional-booking-availability-server";

function response(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function errorResponse(error: unknown) {
  if (error instanceof ProfessionalBookingAvailabilityError) {
    return response(
      {
        error: error.message,
        code: error.code,
      },
      error.status,
    );
  }

  console.error(
    "Professional Booking availability request failed:",
    error,
  );

  return response(
    {
      error:
        "Professional Booking could not complete this request.",
      code: "professional_booking_failed",
    },
    500,
  );
}

export async function GET(request: NextRequest) {
  try {
    return response(
      await getProfessionalBookingAvailability(request),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      throw new ProfessionalBookingAvailabilityError(
        "Invalid Professional Booking request.",
        400,
        "invalid_professional_booking_payload",
      );
    }

    return response(
      await saveProfessionalBookingAvailability(
        request,
        body as Record<string, unknown>,
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
