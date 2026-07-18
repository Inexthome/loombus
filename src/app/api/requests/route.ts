import { NextRequest, NextResponse } from "next/server";
import {
  ServiceRequestsError,
  createServiceRequest,
  getPublicServiceRequest,
  getSavedServiceRequests,
  getServiceRequestManageData,
  listPublicServiceRequests,
  moderateServiceRequest,
  reportServiceRequest,
  respondToServiceRequest,
  reviewServiceRequestReport,
  saveServiceRequest,
  selectServiceRequestResponse,
  setServiceRequestLifecycle,
  unsaveServiceRequest,
  updateServiceRequest,
  withdrawServiceRequestResponse,
} from "@/lib/service-requests-server";

function response(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function errorResponse(error: unknown) {
  if (error instanceof ServiceRequestsError) {
    return response({ error: error.message, code: error.code }, error.status);
  }
  console.error("Requests action failed:", error);
  return response(
    { error: "The Requests service could not complete this action.", code: "requests_failed" },
    500,
  );
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    if (params.get("manage") === "1") return response(await getServiceRequestManageData(request));
    if (params.get("saved") === "1") return response(await getSavedServiceRequests(request));
    const slug = params.get("slug");
    if (slug) return response(await getPublicServiceRequest(request, slug));
    return response(await listPublicServiceRequests(request));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new ServiceRequestsError("Invalid Requests action.", 400, "invalid_payload");
    }
    const input = body as Record<string, unknown>;
    const action = String(input.action ?? "").trim();
    if (action === "create") return response(await createServiceRequest(request, input), 201);
    if (action === "update") return response(await updateServiceRequest(request, input));
    if (["reviewing", "in_progress", "resolved", "closed", "reopen", "remove"].includes(action)) {
      return response(await setServiceRequestLifecycle(request, input));
    }
    if (action === "moderate") return response(await moderateServiceRequest(request, input));
    if (action === "save") return response(await saveServiceRequest(request, input));
    if (action === "unsave") return response(await unsaveServiceRequest(request, input));
    if (action === "respond") return response(await respondToServiceRequest(request, input), 201);
    if (action === "withdraw_response") return response(await withdrawServiceRequestResponse(request, input));
    if (action === "select_response") return response(await selectServiceRequestResponse(request, input));
    if (action === "report") return response(await reportServiceRequest(request, input), 201);
    if (action === "review_report") return response(await reviewServiceRequestReport(request, input));
    throw new ServiceRequestsError("Unsupported Requests action.", 400, "unsupported_action");
  } catch (error) {
    return errorResponse(error);
  }
}
