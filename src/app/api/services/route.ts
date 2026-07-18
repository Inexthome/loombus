import { NextRequest, NextResponse } from "next/server";
import {
  ProviderServicesError,
  createProviderService,
  createProviderServiceInquiry,
  getProviderServicesManageData,
  getPublicProviderService,
  getSavedProviderServices,
  listPublicProviderServices,
  moderateProviderService,
  providerCloseServiceInquiry,
  providerServiceInquiryAction,
  reportProviderService,
  requesterServiceInquiryAction,
  reviewProviderServiceReport,
  saveProviderService,
  setProviderServiceLifecycle,
  unsaveProviderService,
  updateProviderService,
} from "@/lib/provider-services-server";

function response(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function errorResponse(error: unknown) {
  if (error instanceof ProviderServicesError) {
    return response({ error: error.message, code: error.code }, error.status);
  }
  console.error("Services request failed:", error);
  return response(
    {
      error: "The Services system could not complete this action.",
      code: "services_failed",
    },
    500,
  );
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    if (params.get("manage") === "1") {
      return response(await getProviderServicesManageData(request));
    }
    if (params.get("saved") === "1") {
      return response(await getSavedProviderServices(request));
    }
    const slug = params.get("slug");
    if (slug) return response(await getPublicProviderService(request, slug));
    return response(await listPublicProviderServices(request));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new ProviderServicesError(
        "Invalid Services action.",
        400,
        "invalid_payload",
      );
    }
    const input = body as Record<string, unknown>;
    const action = String(input.action ?? "").trim();
    if (action === "create") {
      return response(await createProviderService(request, input), 201);
    }
    if (action === "update") {
      return response(await updateProviderService(request, input));
    }
    if (["pause", "activate", "archive", "reopen"].includes(action)) {
      return response(await setProviderServiceLifecycle(request, input));
    }
    if (action === "moderate") {
      return response(await moderateProviderService(request, input));
    }
    if (action === "save") {
      return response(await saveProviderService(request, input));
    }
    if (action === "unsave") {
      return response(await unsaveProviderService(request, input));
    }
    if (action === "inquire") {
      return response(await createProviderServiceInquiry(request, input), 201);
    }
    if (action === "provider_inquiry_action") {
      return response(await providerServiceInquiryAction(request, input));
    }
    if (action === "requester_inquiry_action") {
      return response(await requesterServiceInquiryAction(request, input));
    }
    if (action === "provider_close_inquiry") {
      return response(await providerCloseServiceInquiry(request, input));
    }
    if (action === "report") {
      return response(await reportProviderService(request, input), 201);
    }
    if (action === "review_report") {
      return response(await reviewProviderServiceReport(request, input));
    }
    throw new ProviderServicesError(
      "Unsupported Services action.",
      400,
      "unsupported_action",
    );
  } catch (error) {
    return errorResponse(error);
  }
}
