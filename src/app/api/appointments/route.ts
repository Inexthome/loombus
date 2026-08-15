import { NextRequest, NextResponse } from "next/server";
import {
  AppointmentsError,
  completeAppointment,
  createAppointmentService,
  getAppointmentManageData,
  getPublicBusinessScheduling,
  requestAppointment,
  requesterAppointmentAction,
  respondToAppointment,
  setAppointmentServiceStatus,
  updateAppointmentService,
} from "@/lib/appointments-server";
import {
  getProfessionalBookingIntakeRequestState,
  getPublicProfessionalBookingIntake,
} from "@/lib/professional-booking-intake-runtime-server";
import {
  prepareProfessionalBookingPaymentForNewRequest,
  professionalBookingPaymentsEnabled,
  runProviderResponseWithProfessionalBookingPayment,
  runRequesterActionWithProfessionalBookingPayment,
} from "@/lib/professional-booking-payment-server";
import {
  getProfessionalBookingPolicyRequestState,
  getPublicProfessionalBookingPolicy,
} from "@/lib/professional-booking-policy-runtime-server";
import {
  getProfessionalBookingPricingRequestState,
  getPublicProfessionalBookingPricing,
} from "@/lib/professional-booking-pricing-runtime-server";
import { getProfessionalBookingRequestViolation } from "@/lib/professional-booking-request-server";
import { getProfessionalBookingSlotGuidance } from "@/lib/professional-booking-slot-guidance-server";
import { enforceAdultOnlyAction } from "@/lib/teen-safety-server";

const ADULT_ONLY_ACTIONS = new Set([
  "create_service",
  "update_service",
  "set_service_status",
  "request",
  "provider_response",
]);

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
  console.error("Appointments request failed:", error);
  return response(
    {
      error: "The Appointments service could not complete this request.",
      code: "appointments_failed",
    },
    500
  );
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    if (params.get("manage") === "1") return response(await getAppointmentManageData(request));
    const businessSlug = params.get("businessSlug");
    if (!businessSlug) {
      throw new AppointmentsError("Business slug is required.", 400, "business_slug_required");
    }
    const intakeServiceId = params.get("intakeServiceId");
    if (intakeServiceId) {
      return response(
        await getPublicProfessionalBookingIntake(
          businessSlug,
          intakeServiceId,
        ),
      );
    }
    const policyServiceId = params.get("policyServiceId");
    if (policyServiceId) {
      return response(
        await getPublicProfessionalBookingPolicy(
          businessSlug,
          policyServiceId,
        ),
      );
    }
    const pricingServiceId = params.get("pricingServiceId");
    if (pricingServiceId) {
      return response(
        await getPublicProfessionalBookingPricing(
          businessSlug,
          pricingServiceId,
        ),
      );
    }
    const slotGuidanceServiceId = params.get("slotGuidanceServiceId");
    if (slotGuidanceServiceId) {
      return response(
        await getProfessionalBookingSlotGuidance(
          businessSlug,
          slotGuidanceServiceId,
        ),
      );
    }
    return response(await getPublicBusinessScheduling(request, businessSlug));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new AppointmentsError("Invalid Appointments request.", 400, "invalid_payload");
    }
    const input = body as Record<string, unknown>;
    const action = String(input.action ?? "").trim();

    if (ADULT_ONLY_ACTIONS.has(action)) {
      const restriction = await enforceAdultOnlyAction(
        request,
        "Publishing an appointment service or requesting an Appointment"
      );
      if (restriction) return restriction;
    }

    if (action === "create_service") {
      return response(await createAppointmentService(request, input), 201);
    }
    if (action === "update_service") {
      return response(await updateAppointmentService(request, input));
    }
    if (action === "set_service_status") {
      return response(await setAppointmentServiceStatus(request, input));
    }
    if (action === "request") {
      const violation = await getProfessionalBookingRequestViolation(
        request,
        input,
      );
      if (violation) {
        throw new AppointmentsError(
          violation.message,
          violation.status,
          violation.code,
        );
      }

      const policy = await getProfessionalBookingPolicyRequestState(
        request,
        input,
      );
      if (policy.violation) {
        throw new AppointmentsError(
          policy.violation.message,
          policy.violation.status,
          policy.violation.code,
        );
      }

      const intake = await getProfessionalBookingIntakeRequestState(
        request,
        input,
      );
      if (intake.violation) {
        throw new AppointmentsError(
          intake.violation.message,
          intake.violation.status,
          intake.violation.code,
        );
      }

      const pricing = await getProfessionalBookingPricingRequestState(
        request,
        input,
      );
      if (pricing.violation) {
        throw new AppointmentsError(
          pricing.violation.message,
          pricing.violation.status,
          pricing.violation.code,
        );
      }

      if (pricing.snapshot && !professionalBookingPaymentsEnabled()) {
        throw new AppointmentsError(
          "Paid Professional Booking requests are temporarily unavailable.",
          503,
          "professional_booking_payments_disabled",
        );
      }

      const appointment = await requestAppointment(
        request,
        input,
        intake.snapshot,
        policy.snapshot,
        pricing.snapshot,
      );
      const payment = await prepareProfessionalBookingPaymentForNewRequest(
        request,
        appointment.id,
      );
      return response(
        {
          ...appointment,
          professionalBookingPayment: payment
            ? { required: true, paymentId: payment.paymentId }
            : null,
        },
        201,
        payment?.checkoutUrl,
      );
    }
    if (action === "provider_response") {
      return response(
        await runProviderResponseWithProfessionalBookingPayment(
          request,
          input,
          () => respondToAppointment(request, input),
        ),
      );
    }
    if (action === "requester_action") {
      return response(
        await runRequesterActionWithProfessionalBookingPayment(
          request,
          input,
          () => requesterAppointmentAction(request, input),
        ),
      );
    }
    if (action === "complete") return response(await completeAppointment(request, input));
    throw new AppointmentsError(
      "Unsupported Appointments action.",
      400,
      "unsupported_action"
    );
  } catch (error) {
    return errorResponse(error);
  }
}
