import { NextRequest, NextResponse } from "next/server";
import {
  getProfessionalBookingPolicy,
  ProfessionalBookingPolicyError,
  saveProfessionalBookingPolicy,
} from "@/lib/professional-booking-policy-server";

function response(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function errorResponse(error: unknown) {
  if (error instanceof ProfessionalBookingPolicyError) {
    return response(
      {
        error: error.message,
        code: error.code,
      },
      error.status,
    );
  }

  console.error("Professional Booking policy request failed:", error);
  return response(
    {
      error: "Professional Booking could not complete this request.",
      code: "professional_booking_policy_failed",
    },
    500,
  );
}

export async function GET(request: NextRequest) {
  try {
    return response(
      await getProfessionalBookingPolicy(
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
      throw new ProfessionalBookingPolicyError(
        "Invalid Professional Booking policy request.",
        400,
        "invalid_professional_booking_policy_payload",
      );
    }

    return response(
      await saveProfessionalBookingPolicy(
        request,
        body as Record<string, unknown>,
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
