import "server-only";

import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  JobsDirectoryError,
  type JobsInput,
  type JobsViewer,
  asBoolean,
  cleanDate,
  cleanEmail,
  cleanExpiry,
  cleanLongText,
  cleanStringArray,
  cleanText,
  cleanUrl,
  cleanUuid,
  refreshExpiredJobs,
  resolveJobsViewer,
  slugifyJob,
} from "@/lib/jobs-directory-server-shared";

const EMPLOYMENT_TYPES = [
  "full_time",
  "part_time",
  "contract",
  "temporary",
  "internship",
  "seasonal",
  "apprenticeship",
  "volunteer",
];

const WORKPLACE_TYPES = ["on_site", "hybrid", "remote"];
const EXPERIENCE_LEVELS = [
  "not_specified",
  "entry",
  "mid",
  "senior",
  "lead",
  "executive",
];
const COMPENSATION_PERIODS = [
  "hour",
  "day",
  "week",
  "month",
  "year",
  "project",
];

function cleanMoney(value: unknown, label: string) {
  if (value === null || value === undefined || value === "") return null;
  const amount =
    typeof value === "number"
      ? value
      : Number(String(value).trim());
  if (!Number.isFinite(amount) || amount < 0) {
    throw new JobsDirectoryError(
      `Enter a valid ${label}.`,
      400,
      "invalid_compensation"
    );
  }
  return Math.round(amount * 100) / 100;
}

function normalizeJobInput(input: JobsInput) {
  const title = cleanText(input.title, 200);
  const summary = cleanText(input.summary, 500);
  const description = cleanLongText(input.description, 12000);
  const responsibilities = cleanLongText(input.responsibilities, 8000);
  const qualifications = cleanLongText(input.qualifications, 8000);
  const category = cleanText(input.category, 120);
  const employmentType =
    cleanText(input.employmentType, 30) || "full_time";
  const workplaceType = cleanText(input.workplaceType, 20) || "on_site";
  const experienceLevel =
    cleanText(input.experienceLevel, 30) || "not_specified";
  const compensationPeriod =
    cleanText(input.compensationPeriod, 20) || "year";

  if (title.length < 3) {
    throw new JobsDirectoryError(
      "Add a clear job title.",
      400,
      "job_title_required"
    );
  }
  if (summary.length < 20) {
    throw new JobsDirectoryError(
      "Add a short job summary of at least 20 characters.",
      400,
      "job_summary_required"
    );
  }
  if (description.length < 60) {
    throw new JobsDirectoryError(
      "Describe the opportunity in at least 60 characters.",
      400,
      "job_description_required"
    );
  }
  if (!category) {
    throw new JobsDirectoryError(
      "Choose a job category.",
      400,
      "job_category_required"
    );
  }
  if (!EMPLOYMENT_TYPES.includes(employmentType)) {
    throw new JobsDirectoryError(
      "Choose a valid employment type.",
      400,
      "invalid_employment_type"
    );
  }
  if (!WORKPLACE_TYPES.includes(workplaceType)) {
    throw new JobsDirectoryError(
      "Choose a valid workplace type.",
      400,
      "invalid_workplace_type"
    );
  }
  if (!EXPERIENCE_LEVELS.includes(experienceLevel)) {
    throw new JobsDirectoryError(
      "Choose a valid experience level.",
      400,
      "invalid_experience_level"
    );
  }
  if (!COMPENSATION_PERIODS.includes(compensationPeriod)) {
    throw new JobsDirectoryError(
      "Choose a valid compensation period.",
      400,
      "invalid_compensation_period"
    );
  }

  const city = cleanText(input.city, 100);
  const region = cleanText(input.region, 100);
  if (workplaceType !== "remote" && !city && !region) {
    throw new JobsDirectoryError(
      "Add a city or region for an on-site or hybrid job.",
      400,
      "job_location_required"
    );
  }

  const compensationMin = cleanMoney(
    input.compensationMin,
    "minimum compensation"
  );
  const compensationMax = cleanMoney(
    input.compensationMax,
    "maximum compensation"
  );
  if (
    compensationMin !== null &&
    compensationMax !== null &&
    compensationMax < compensationMin
  ) {
    throw new JobsDirectoryError(
      "Maximum compensation cannot be below the minimum.",
      400,
      "invalid_compensation_range"
    );
  }

  const compensationCurrency = (
    cleanText(input.compensationCurrency, 3) || "USD"
  ).toUpperCase();
  if (!/^[A-Z]{3}$/.test(compensationCurrency)) {
    throw new JobsDirectoryError(
      "Use a three-letter compensation currency such as USD.",
      400,
      "invalid_compensation_currency"
    );
  }

  const applicationUrl = cleanUrl(input.applicationUrl);
  const applicationEmail = cleanEmail(input.applicationEmail);
  if (!applicationUrl && !applicationEmail) {
    throw new JobsDirectoryError(
      "Add an employer-controlled HTTPS application page or application email.",
      400,
      "application_method_required"
    );
  }

  const applicationDeadline = cleanDate(
    input.applicationDeadline,
    "application deadline"
  );
  const expiresAt = cleanExpiry(input.expiresAt);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  if (
    applicationDeadline &&
    new Date(`${applicationDeadline}T23:59:59.999Z`).getTime() <
      today.getTime()
  ) {
    throw new JobsDirectoryError(
      "The application deadline cannot be in the past.",
      400,
      "application_deadline_past"
    );
  }
  if (expiresAt && new Date(expiresAt).getTime() < today.getTime()) {
    throw new JobsDirectoryError(
      "The posting expiration date cannot be in the past.",
      400,
      "job_expiration_past"
    );
  }
  if (
    applicationDeadline &&
    expiresAt &&
    new Date(expiresAt).getTime() <
      new Date(`${applicationDeadline}T23:59:59.999Z`).getTime()
  ) {
    throw new JobsDirectoryError(
      "The posting cannot expire before its application deadline.",
      400,
      "job_expiration_before_deadline"
    );
  }

  return {
    businessId: cleanUuid(input.businessId, "business id"),
    row: {
      title,
      summary,
      description,
      responsibilities,
      qualifications,
      category,
      employment_type: employmentType,
      workplace_type: workplaceType,
      experience_level: experienceLevel,
      city,
      region,
      postal_code: cleanText(input.postalCode, 30),
      country_code: (
        cleanText(input.countryCode, 2) || "US"
      ).toUpperCase(),
      compensation_min: compensationMin,
      compensation_max: compensationMax,
      compensation_currency: compensationCurrency,
      compensation_period: compensationPeriod,
      show_compensation:
        asBoolean(input.showCompensation) &&
        (compensationMin !== null || compensationMax !== null),
      application_url: applicationUrl || null,
      application_email: applicationEmail || null,
      skills: cleanStringArray(input.skills, 120),
      benefits: cleanStringArray(input.benefits, 160),
      application_deadline: applicationDeadline,
      expires_at: expiresAt,
    },
  };
}

async function requireBusinessControl(
  viewer: JobsViewer,
  businessId: string
) {
  const { data, error } = await viewer.service
    .from("businesses")
    .select(
      "id, owner_id, name, slug, status, verification_status, contact_email"
    )
    .eq("id", businessId)
    .maybeSingle();

  if (error) {
    throw new JobsDirectoryError(
      "Unable to verify the employer profile.",
      503,
      "employer_access_unavailable"
    );
  }
  if (!data) {
    throw new JobsDirectoryError(
      "Employer profile not found.",
      404,
      "employer_not_found"
    );
  }
  if (!viewer.isAdmin && cleanText(data.owner_id, 60) !== viewer.user!.id) {
    throw new JobsDirectoryError(
      "You do not control this employer profile.",
      403,
      "employer_forbidden"
    );
  }
  if (cleanText(data.status, 20) === "suspended") {
    throw new JobsDirectoryError(
      "This employer profile is suspended.",
      409,
      "employer_suspended"
    );
  }

  return data as Record<string, unknown>;
}

async function uniqueJobSlug(
  service: SupabaseClient,
  title: string,
  businessName: string
) {
  const base = slugifyJob(`${title}-${businessName}`);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const slug =
      attempt === 0
        ? base
        : `${base.slice(0, 63)}-${crypto.randomUUID().slice(0, 7)}`;
    const { data } = await service
      .from("job_postings")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!data) return slug;
  }
  return `${base.slice(0, 58)}-${crypto.randomUUID().slice(0, 12)}`;
}

async function requireJobControl(viewer: JobsViewer, jobId: string) {
  const { data, error } = await viewer.service
    .from("job_postings")
    .select(
      `
        *,
        businesses!inner (
          id,
          owner_id,
          name,
          slug,
          status,
          verification_status
        )
      `
    )
    .eq("id", jobId)
    .maybeSingle();

  if (error) {
    throw new JobsDirectoryError(
      "Unable to verify the job posting.",
      503,
      "job_access_unavailable"
    );
  }
  if (!data) {
    throw new JobsDirectoryError("Job not found.", 404, "job_not_found");
  }

  const rawBusiness = Array.isArray(data.businesses)
    ? data.businesses[0]
    : data.businesses;
  const business = (rawBusiness ?? {}) as Record<string, unknown>;

  if (
    !viewer.isAdmin &&
    cleanText(business.owner_id, 60) !== viewer.user!.id
  ) {
    throw new JobsDirectoryError(
      "You do not control this job posting.",
      403,
      "job_forbidden"
    );
  }

  return {
    job: data as Record<string, unknown>,
    business,
  };
}

export async function createJob(request: NextRequest, input: JobsInput) {
  const viewer = await resolveJobsViewer(request, true);
  await refreshExpiredJobs(viewer.service);
  const normalized = normalizeJobInput(input);
  const business = await requireBusinessControl(
    viewer,
    normalized.businessId
  );
  const publishNow =
    viewer.isAdmin &&
    asBoolean(input.publishNow) &&
    cleanText(business.status, 20) === "published";
  const slug = await uniqueJobSlug(
    viewer.service,
    normalized.row.title,
    cleanText(business.name, 200)
  );

  const { data, error } = await viewer.service
    .from("job_postings")
    .insert({
      ...normalized.row,
      business_id: normalized.businessId,
      created_by: viewer.user!.id,
      slug,
      status: publishNow ? "published" : "pending",
      published_at: publishNow ? new Date().toISOString() : null,
      closed_at: null,
    })
    .select("id")
    .single();

  if (error || !data) {
    const duplicate = error?.code === "23505";
    throw new JobsDirectoryError(
      duplicate
        ? "A job posting with this web address already exists."
        : "Unable to create the job posting.",
      duplicate ? 409 : 503,
      duplicate ? "job_exists" : "job_create_failed"
    );
  }

  return {
    id: data.id,
    slug,
    status: publishNow ? "published" : "pending",
  };
}

export async function updateJob(request: NextRequest, input: JobsInput) {
  const viewer = await resolveJobsViewer(request, true);
  await refreshExpiredJobs(viewer.service);
  const jobId = cleanUuid(input.jobId, "job id");
  const current = await requireJobControl(viewer, jobId);
  const normalized = normalizeJobInput(input);
  const nextBusiness = await requireBusinessControl(
    viewer,
    normalized.businessId
  );
  const publishNow =
    viewer.isAdmin &&
    asBoolean(input.publishNow) &&
    cleanText(nextBusiness.status, 20) === "published";
  const nextStatus = publishNow
    ? "published"
    : viewer.isAdmin
      ? cleanText(input.status, 20) ||
        cleanText(current.job.status, 20) ||
        "pending"
      : "pending";

  if (
    ![
      "draft",
      "pending",
      "published",
      "rejected",
      "suspended",
      "closed",
      "expired",
    ].includes(nextStatus)
  ) {
    throw new JobsDirectoryError(
      "Invalid job status.",
      400,
      "invalid_job_status"
    );
  }

  if (
    nextStatus === "published" &&
    cleanText(nextBusiness.status, 20) !== "published"
  ) {
    throw new JobsDirectoryError(
      "Publish the employer profile before publishing this job.",
      409,
      "employer_not_published"
    );
  }

  const { error } = await viewer.service
    .from("job_postings")
    .update({
      ...normalized.row,
      business_id: normalized.businessId,
      status: nextStatus,
      moderation_reason: viewer.isAdmin
        ? cleanLongText(input.moderationReason, 2000) || null
        : null,
      published_at:
        nextStatus === "published"
          ? cleanText(current.job.published_at, 60) ||
            new Date().toISOString()
          : cleanText(current.job.published_at, 60) || null,
      closed_at:
        nextStatus === "closed" || nextStatus === "expired"
          ? cleanText(current.job.closed_at, 60) || new Date().toISOString()
          : null,
    })
    .eq("id", jobId);

  if (error) {
    throw new JobsDirectoryError(
      "Unable to update the job posting.",
      503,
      "job_update_failed"
    );
  }

  return { id: jobId, status: nextStatus };
}

export async function closeJob(request: NextRequest, input: JobsInput) {
  const viewer = await resolveJobsViewer(request, true);
  const jobId = cleanUuid(input.jobId, "job id");
  await requireJobControl(viewer, jobId);

  const { error } = await viewer.service
    .from("job_postings")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
      moderation_reason: null,
    })
    .eq("id", jobId);

  if (error) {
    throw new JobsDirectoryError(
      "Unable to close the job posting.",
      503,
      "job_close_failed"
    );
  }

  return { updated: true, status: "closed" };
}

export async function reopenJob(request: NextRequest, input: JobsInput) {
  const viewer = await resolveJobsViewer(request, true);
  const jobId = cleanUuid(input.jobId, "job id");
  const current = await requireJobControl(viewer, jobId);
  const publishNow =
    viewer.isAdmin && cleanText(current.business.status, 20) === "published";
  const nextStatus = publishNow ? "published" : "pending";

  const { error } = await viewer.service
    .from("job_postings")
    .update({
      status: nextStatus,
      closed_at: null,
      moderation_reason: null,
      published_at: publishNow
        ? cleanText(current.job.published_at, 60) || new Date().toISOString()
        : cleanText(current.job.published_at, 60) || null,
    })
    .eq("id", jobId);

  if (error) {
    throw new JobsDirectoryError(
      "Unable to reopen the job posting.",
      503,
      "job_reopen_failed"
    );
  }

  return { updated: true, status: nextStatus };
}

export async function reportJob(request: NextRequest, input: JobsInput) {
  const viewer = await resolveJobsViewer(request, true);
  await refreshExpiredJobs(viewer.service);
  const jobId = cleanUuid(input.jobId, "job id");
  const reason = cleanText(input.reason, 120);
  const details = cleanLongText(input.details, 3000);

  if (!reason || details.length < 10) {
    throw new JobsDirectoryError(
      "Choose a reason and explain the concern.",
      400,
      "job_report_details_required"
    );
  }

  const { data: job } = await viewer.service
    .from("job_postings")
    .select("id")
    .eq("id", jobId)
    .eq("status", "published")
    .maybeSingle();

  if (!job) {
    throw new JobsDirectoryError("Job not found.", 404, "job_not_found");
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await viewer.service
    .from("job_reports")
    .select("id", { count: "exact", head: true })
    .eq("reporter_id", viewer.user!.id)
    .gte("created_at", oneHourAgo);

  if ((count ?? 0) >= 10) {
    throw new JobsDirectoryError(
      "You have reached the job report limit for this hour.",
      429,
      "job_report_rate_limited"
    );
  }

  const { error } = await viewer.service.from("job_reports").insert({
    job_id: jobId,
    reporter_id: viewer.user!.id,
    reason,
    details,
    status: "open",
  });

  if (error) {
    throw new JobsDirectoryError(
      "Unable to submit the job report.",
      503,
      "job_report_failed"
    );
  }

  return { submitted: true };
}

async function requireAdmin(request: NextRequest) {
  const viewer = await resolveJobsViewer(request, true);
  if (!viewer.isAdmin) {
    throw new JobsDirectoryError(
      "Administrator access is required.",
      403,
      "admin_required"
    );
  }
  return viewer;
}

export async function moderateJob(request: NextRequest, input: JobsInput) {
  const viewer = await requireAdmin(request);
  const jobId = cleanUuid(input.jobId, "job id");
  const decision = cleanText(input.decision, 30);
  const note = cleanLongText(input.note, 2000);
  const current = await requireJobControl(viewer, jobId);
  const updates: Record<string, unknown> = {
    moderation_reason: note || null,
  };

  if (decision === "approve") {
    if (cleanText(current.business.status, 20) !== "published") {
      throw new JobsDirectoryError(
        "Publish the employer profile before approving this job.",
        409,
        "employer_not_published"
      );
    }
    updates.status = "published";
    updates.published_at =
      cleanText(current.job.published_at, 60) || new Date().toISOString();
    updates.closed_at = null;
  } else if (decision === "reject") {
    updates.status = "rejected";
  } else if (decision === "suspend") {
    updates.status = "suspended";
  } else if (decision === "close") {
    updates.status = "closed";
    updates.closed_at = new Date().toISOString();
  } else if (decision === "expire") {
    updates.status = "expired";
    updates.closed_at = new Date().toISOString();
  } else {
    throw new JobsDirectoryError(
      "Invalid moderation decision.",
      400,
      "invalid_job_moderation_decision"
    );
  }

  const { error } = await viewer.service
    .from("job_postings")
    .update(updates)
    .eq("id", jobId);

  if (error) {
    throw new JobsDirectoryError(
      "Unable to moderate the job posting.",
      503,
      "job_moderation_failed"
    );
  }

  return { updated: true };
}

export async function reviewJobReport(
  request: NextRequest,
  input: JobsInput
) {
  const viewer = await requireAdmin(request);
  const reportId = cleanUuid(input.reportId, "report id");
  const decision = cleanText(input.decision, 20);
  const note = cleanLongText(input.note, 2000);

  if (!["resolve", "dismiss"].includes(decision)) {
    throw new JobsDirectoryError(
      "Invalid report decision.",
      400,
      "invalid_job_report_decision"
    );
  }

  const { error } = await viewer.service
    .from("job_reports")
    .update({
      status: decision === "resolve" ? "resolved" : "dismissed",
      reviewed_by: viewer.user!.id,
      reviewed_at: new Date().toISOString(),
      decision_note: note || null,
    })
    .eq("id", reportId)
    .eq("status", "open");

  if (error) {
    throw new JobsDirectoryError(
      "Unable to review the job report.",
      503,
      "job_report_review_failed"
    );
  }

  return { updated: true };
}
