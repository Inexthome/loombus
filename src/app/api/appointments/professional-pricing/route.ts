import { NextRequest, NextResponse } from "next/server";
import {
  getProfessionalBookingPricing,
  ProfessionalBookingPricingError,
  saveProfessionalBookingPricing,
} from "@/lib/professional-booking-pricing-server";

function response(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function errorResponse(error: unknown) {
  if (error instanceof ProfessionalBookingPricingError) {
    return response(
      {
        error: error.message,
        code: error.code,
      },
      error.status,
    );
  }

  console.error("Professional Booking pricing request failed:", error);
  return response(
    {
      error: "Professional Booking could not complete this request.",
      code: "professional_booking_pricing_failed",
    },
    500,
  );
}

export async function GET(request: NextRequest) {
  try {
    return response(
      await getProfessionalBookingPricing(
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
      throw new ProfessionalBookingPricingError(
        "Invalid Professional Booking pricing request.",
        400,
        "invalid_professional_booking_pricing_payload",
      );
    }

    return response(
      await saveProfessionalBookingPricing(
        request,
        body as Record<string, unknown>,
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
