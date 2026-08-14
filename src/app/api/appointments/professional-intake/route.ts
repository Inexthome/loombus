import { NextRequest, NextResponse } from "next/server";
import {
  getProfessionalBookingIntakeForm,
  ProfessionalBookingIntakeError,
  saveProfessionalBookingIntakeForm,
} from "@/lib/professional-booking-intake-server";

function response(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function errorResponse(error: unknown) {
  if (error instanceof ProfessionalBookingIntakeError) {
    return response(
      {
        error: error.message,
        code: error.code,
      },
      error.status,
    );
  }

  console.error("Professional Booking intake request failed:", error);
  return response(
    {
      error: "Professional Booking could not complete this request.",
      code: "professional_booking_intake_failed",
    },
    500,
  );
}

export async function GET(request: NextRequest) {
  try {
    return response(
      await getProfessionalBookingIntakeForm(
        request,
        request.nextUrl.searchParams.get("serviceId"),
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new ProfessionalBookingIntakeError(
        "Invalid Professional Booking intake request.",
        400,
        "invalid_professional_booking_intake_payload",
      );
    }

    return response(
      await saveProfessionalBookingIntakeForm(
        request,
        body as Record<string, unknown>,
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
