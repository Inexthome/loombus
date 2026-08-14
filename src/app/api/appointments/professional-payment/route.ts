import { NextRequest, NextResponse } from "next/server";
import { AppointmentsError } from "@/lib/appointments-server";
import {
  listProfessionalBookingPayments,
  refreshProfessionalBookingPayment,
  startProfessionalBookingPaymentCheckout,
} from "@/lib/professional-booking-payment-server";

function response(
  payload: unknown,
  status = 200,
  navigateTo?: string | null,
) {
  const headers = new Headers({ "Cache-Control": "private, no-store" });
  if (navigateTo) headers.set("X-Loombus-Navigate-To", navigateTo);
  return NextResponse.json(payload, { status, headers });
}

function errorResponse(error: unknown) {
  if (error instanceof AppointmentsError) {
    return response({ error: error.message, code: error.code }, error.status);
  }
  console.error("Professional Booking payment request failed:", error);
  return response(
    {
      error: "The Professional Booking payment service could not complete this request.",
      code: "professional_booking_payment_failed",
    },
    500,
  );
}

export async function GET(request: NextRequest) {
  try {
    return response(await listProfessionalBookingPayments(request));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new AppointmentsError(
        "Invalid Professional Booking payment request.",
        400,
        "invalid_professional_booking_payment_payload",
      );
    }
    const input = body as Record<string, unknown>;
    const action = String(input.action ?? "").trim();

    if (action === "checkout") {
      const result = await startProfessionalBookingPaymentCheckout(
        request,
        input.paymentId,
      );
      return response(result, 200, result.checkoutUrl);
    }
    if (action === "refresh") {
      return response(
        await refreshProfessionalBookingPayment(request, input.paymentId),
      );
    }

    throw new AppointmentsError(
      "Unsupported Professional Booking payment action.",
      400,
      "unsupported_professional_booking_payment_action",
    );
  } catch (error) {
    return errorResponse(error);
  }
}
