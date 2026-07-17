import { NextRequest, NextResponse } from "next/server";
import {
  JobsDirectoryError,
  closeJob,
  createJob,
  getJobsManageData,
  getPublicJob,
  listJobEmployers,
  listPublicJobs,
  moderateJob,
  reopenJob,
  reportJob,
  reviewJobReport,
  updateJob,
} from "@/lib/jobs-directory-server";

function response(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function errorResponse(error: unknown) {
  if (error instanceof JobsDirectoryError) {
    return response({ error: error.message, code: error.code }, error.status);
  }

  console.error("Jobs Directory request failed:", error);
  return response(
    {
      error: "The Jobs Directory could not complete this request.",
      code: "jobs_directory_failed",
    },
    500
  );
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const slug = params.get("slug");

    if (slug) {
      return response({ job: await getPublicJob(request, slug) });
    }

    if (params.get("manage") === "1") {
      return response(await getJobsManageData(request));
    }

    if (params.get("employers") === "1") {
      return response(await listJobEmployers(request, params.get("q")));
    }

    return response(
      await listPublicJobs(request, {
        query: params.get("q"),
        category: params.get("category"),
        city: params.get("city"),
        employmentType: params.get("employmentType"),
        workplaceType: params.get("workplaceType"),
        page: params.get("page"),
        pageSize: params.get("pageSize"),
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
      throw new JobsDirectoryError(
        "Invalid Jobs Directory request.",
        400,
        "invalid_payload"
      );
    }

    const input = body as Record<string, unknown>;
    const action = String(input.action ?? "").trim();

    if (action === "create") {
      return response({ job: await createJob(request, input) }, 201);
    }
    if (action === "update") {
      return response({ job: await updateJob(request, input) });
    }
    if (action === "close") {
      return response(await closeJob(request, input));
    }
    if (action === "reopen") {
      return response(await reopenJob(request, input));
    }
    if (action === "report") {
      return response(await reportJob(request, input), 201);
    }
    if (action === "moderate") {
      return response(await moderateJob(request, input));
    }
    if (action === "review_report") {
      return response(await reviewJobReport(request, input));
    }

    throw new JobsDirectoryError(
      "Unsupported Jobs Directory action.",
      400,
      "unsupported_action"
    );
  } catch (error) {
    return errorResponse(error);
  }
}
