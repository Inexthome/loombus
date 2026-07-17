import "server-only";

import type { NextRequest } from "next/server";
import type { JobReport, JobsManageResponse } from "@/lib/jobs-directory";
import {
  JOB_SELECT,
  JobsDirectoryError,
  asNumber,
  cleanLongText,
  cleanText,
  missingJobsSchema,
  normalizeEmployer,
  normalizeJob,
  refreshExpiredJobs,
  resolveJobsViewer,
} from "@/lib/jobs-directory-server-shared";

export async function listPublicJobs(
  request: NextRequest,
  filters: {
    query?: unknown;
    category?: unknown;
    city?: unknown;
    employmentType?: unknown;
    workplaceType?: unknown;
    page?: unknown;
    pageSize?: unknown;
  }
) {
  const viewer = await resolveJobsViewer(request, false);
  await refreshExpiredJobs(viewer.service);

  const page = Math.max(Math.floor(asNumber(filters.page) || 1), 1);
  const pageSize = Math.min(
    Math.max(Math.floor(asNumber(filters.pageSize) || 24), 1),
    48
  );

  const { data, error } = await viewer.service.rpc("search_public_jobs", {
    search_text: cleanText(filters.query, 180) || null,
    category_filter: cleanText(filters.category, 120) || null,
    city_filter: cleanText(filters.city, 120) || null,
    employment_filter: cleanText(filters.employmentType, 30) || null,
    workplace_filter: cleanText(filters.workplaceType, 20) || null,
    page_number: page,
    page_size: pageSize,
  });

  if (error) {
    if (missingJobsSchema(error)) {
      return {
        jobs: [],
        total: 0,
        page,
        pageSize,
        directoryActive: false,
      };
    }

    throw new JobsDirectoryError(
      "The Jobs Directory could not load.",
      503,
      "jobs_directory_unavailable"
    );
  }

  const payload = (data ?? {}) as Record<string, unknown>;
  const rows = Array.isArray(payload.jobs)
    ? (payload.jobs as Record<string, unknown>[])
    : [];

  return {
    jobs: rows.map(normalizeJob),
    total: Math.max(asNumber(payload.total), 0),
    page,
    pageSize,
    directoryActive: true,
  };
}

export async function getPublicJob(request: NextRequest, rawSlug: unknown) {
  const viewer = await resolveJobsViewer(request, false);
  await refreshExpiredJobs(viewer.service);
  const slug = cleanText(rawSlug, 100).toLowerCase();

  if (!slug) {
    throw new JobsDirectoryError("Job not found.", 404, "job_not_found");
  }

  const { data, error } = await viewer.service
    .from("job_postings")
    .select(JOB_SELECT)
    .eq("slug", slug)
    .eq("status", "published")
    .eq("businesses.status", "published")
    .maybeSingle();

  if (error) {
    if (missingJobsSchema(error)) {
      throw new JobsDirectoryError(
        "The Jobs Directory is not active yet.",
        503,
        "jobs_directory_unavailable"
      );
    }

    throw new JobsDirectoryError(
      "Unable to load this job posting.",
      503,
      "job_unavailable"
    );
  }

  if (!data) {
    throw new JobsDirectoryError("Job not found.", 404, "job_not_found");
  }

  return normalizeJob(data as Record<string, unknown>);
}

export async function listJobEmployers(
  request: NextRequest,
  rawQuery: unknown
) {
  const viewer = await resolveJobsViewer(request, true);
  const query = cleanText(rawQuery, 160);

  let employerQuery = viewer.service
    .from("businesses")
    .select(
      "id, owner_id, slug, name, logo_url, verification_status, status"
    )
    .order("name", { ascending: true });

  if (viewer.isAdmin) {
    employerQuery = employerQuery.in("status", [
      "published",
      "pending",
      "draft",
      "rejected",
    ]);
    if (query) employerQuery = employerQuery.ilike("name", `%${query}%`);
    employerQuery = employerQuery.limit(60);
  } else {
    employerQuery = employerQuery.eq("owner_id", viewer.user!.id);
  }

  const { data, error } = await employerQuery;
  if (error) {
    if (missingJobsSchema(error)) {
      throw new JobsDirectoryError(
        "Apply the Local Business migrations before creating jobs.",
        503,
        "business_directory_unavailable"
      );
    }

    throw new JobsDirectoryError(
      "Unable to load employer profiles.",
      503,
      "job_employers_unavailable"
    );
  }

  return {
    employers: (data ?? []).map((row) =>
      normalizeEmployer(row as Record<string, unknown>)
    ),
  };
}

function normalizeReport(
  row: Record<string, unknown>,
  jobNames: Map<string, { title: string; businessName: string }>
): JobReport {
  const jobId = cleanText(row.job_id, 60);
  const reference = jobNames.get(jobId);
  const status = cleanText(row.status, 20);

  return {
    id: cleanText(row.id, 60),
    jobId,
    jobTitle: reference?.title ?? "Job posting",
    businessName: reference?.businessName ?? "Employer",
    reporterId: cleanText(row.reporter_id, 60),
    reason: cleanText(row.reason, 120),
    details: cleanLongText(row.details, 3000),
    status: (
      ["open", "resolved", "dismissed"].includes(status) ? status : "open"
    ) as JobReport["status"],
    createdAt: cleanText(row.created_at, 60) || null,
  };
}

export async function getJobsManageData(
  request: NextRequest
): Promise<JobsManageResponse> {
  const viewer = await resolveJobsViewer(request, true);
  await refreshExpiredJobs(viewer.service);
  const userId = viewer.user!.id;

  let jobsQuery = viewer.service
    .from("job_postings")
    .select(JOB_SELECT)
    .order("updated_at", { ascending: false });

  jobsQuery = viewer.isAdmin
    ? jobsQuery.eq("created_by", userId)
    : jobsQuery.eq("businesses.owner_id", userId);

  const { data: jobsData, error: jobsError } = await jobsQuery;
  if (jobsError) {
    if (missingJobsSchema(jobsError)) {
      throw new JobsDirectoryError(
        "The Jobs Directory migration has not been applied.",
        503,
        "jobs_directory_unavailable"
      );
    }

    throw new JobsDirectoryError(
      "Unable to load job management.",
      503,
      "jobs_manage_unavailable"
    );
  }

  let pendingJobs: ReturnType<typeof normalizeJob>[] = [];
  let reportRows: Record<string, unknown>[] = [];

  if (viewer.isAdmin) {
    const [pendingResult, reportsResult] = await Promise.all([
      viewer.service
        .from("job_postings")
        .select(JOB_SELECT)
        .in("status", ["pending", "rejected", "suspended"])
        .order("updated_at", { ascending: true }),
      viewer.service
        .from("job_reports")
        .select("*")
        .eq("status", "open")
        .order("created_at", { ascending: true }),
    ]);

    if (pendingResult.error || reportsResult.error) {
      const error = pendingResult.error ?? reportsResult.error;
      if (error && missingJobsSchema(error)) {
        throw new JobsDirectoryError(
          "The Jobs Directory migration has not been applied.",
          503,
          "jobs_directory_unavailable"
        );
      }

      throw new JobsDirectoryError(
        "Unable to load the Jobs moderation queue.",
        503,
        "jobs_moderation_unavailable"
      );
    }

    pendingJobs = (pendingResult.data ?? []).map((row) =>
      normalizeJob(row as Record<string, unknown>)
    );
    reportRows = (reportsResult.data ?? []) as Record<string, unknown>[];
  }

  const jobIds = [
    ...new Set(reportRows.map((row) => cleanText(row.job_id, 60)).filter(Boolean)),
  ];
  const jobNames = new Map<string, { title: string; businessName: string }>();

  if (jobIds.length > 0) {
    const { data } = await viewer.service
      .from("job_postings")
      .select(
        "id, title, businesses!inner (name)"
      )
      .in("id", jobIds);

    for (const row of data ?? []) {
      const rawBusiness = Array.isArray(row.businesses)
        ? row.businesses[0]
        : row.businesses;
      jobNames.set(cleanText(row.id, 60), {
        title: cleanText(row.title, 200) || "Job posting",
        businessName:
          cleanText(
            (rawBusiness as Record<string, unknown> | null)?.name,
            200
          ) || "Employer",
      });
    }
  }

  return {
    authenticated: true,
    isAdmin: viewer.isAdmin,
    jobs: (jobsData ?? []).map((row) =>
      normalizeJob(row as Record<string, unknown>)
    ),
    moderation: {
      pendingJobs,
      openReports: reportRows.map((row) => normalizeReport(row, jobNames)),
    },
  };
}
