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

function response(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
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
    if (action === "create_service") {
      return response(await createAppointmentService(request, input), 201);
    }
    if (action === "update_service") {
      return response(await updateAppointmentService(request, input));
    }
    if (action === "set_service_status") {
      return response(await setAppointmentServiceStatus(request, input));
    }
    if (action === "request") return response(await requestAppointment(request, input), 201);
    if (action === "provider_response") {
      return response(await respondToAppointment(request, input));
    }
    if (action === "requester_action") {
      return response(await requesterAppointmentAction(request, input));
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
