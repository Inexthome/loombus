import { NextRequest, NextResponse } from "next/server";
import {
  BusinessDirectoryError,
  claimBusiness,
  createBusiness,
  getBusinessManageData,
  getPublicBusiness,
  listPublicBusinesses,
  moderateBusiness,
  reportBusiness,
  reviewBusinessClaim,
  reviewBusinessReport,
  updateBusiness,
} from "@/lib/business-directory-server";

function response(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function errorResponse(error: unknown) {
  if (error instanceof BusinessDirectoryError) {
    return response({ error: error.message, code: error.code }, error.status);
  }

  console.error("Business directory request failed:", error);
  return response(
    {
      error: "The business directory could not complete this request.",
      code: "business_directory_failed",
    },
    500
  );
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const slug = params.get("slug");
    if (slug) {
      return response({ business: await getPublicBusiness(request, slug) });
    }

    if (params.get("manage") === "1") {
      return response(await getBusinessManageData(request));
    }

    return response(
      await listPublicBusinesses(request, {
        query: params.get("q"),
        category: params.get("category"),
        city: params.get("city"),
        limit: params.get("limit"),
      })
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new BusinessDirectoryError("Invalid directory request.", 400, "invalid_payload");
    }

    const input = body as Record<string, unknown>;
    const action = String(input.action ?? "").trim();

    if (action === "create") {
      return response({ business: await createBusiness(request, input) }, 201);
    }
    if (action === "update") {
      return response({ business: await updateBusiness(request, input) });
    }
    if (action === "claim") {
      return response(await claimBusiness(request, input), 201);
    }
    if (action === "report") {
      return response(await reportBusiness(request, input), 201);
    }
    if (action === "moderate") {
      return response(await moderateBusiness(request, input));
    }
    if (action === "review_claim") {
      return response(await reviewBusinessClaim(request, input));
    }
    if (action === "review_report") {
      return response(await reviewBusinessReport(request, input));
    }

    throw new BusinessDirectoryError("Unsupported directory action.", 400, "unsupported_action");
  } catch (error) {
    return errorResponse(error);
  }
}
