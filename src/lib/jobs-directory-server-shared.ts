import "server-only";

import type { NextRequest } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getAccountEnforcementResult } from "@/lib/account-enforcement";
import {
  asBoolean,
  asNumber,
  asString,
  createRequestSupabase,
  createRoomServiceSupabase,
} from "@/lib/room-operations";
import type {
  JobCompensationPeriod,
  JobEmployerOption,
  JobEmploymentType,
  JobExperienceLevel,
  JobPosting,
  JobPostingStatus,
  JobWorkplaceType,
} from "@/lib/jobs-directory";

export { asBoolean, asNumber, asString };

export type JobsViewer = {
  user: User | null;
  isAdmin: boolean;
  service: SupabaseClient;
};

export type JobsInput = Record<string, unknown>;

export class JobsDirectoryError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 500, code = "jobs_directory_error") {
    super(message);
    this.name = "JobsDirectoryError";
    this.status = status;
    this.code = code;
  }
}

export function cleanText(value: unknown, max = 500) {
  return asString(value).replace(/\s+/g, " ").trim().slice(0, max);
}

export function cleanLongText(value: unknown, max = 12000) {
  return asString(value).replace(/\r\n/g, "\n").trim().slice(0, max);
}

export function cleanEmail(value: unknown) {
  const email = cleanText(value, 254).toLowerCase();
  if (!email) return "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new JobsDirectoryError(
      "Enter a valid application email address.",
      400,
      "invalid_application_email"
    );
  }
  return email;
}

export function cleanUrl(value: unknown) {
  const url = cleanText(value, 2048);
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") throw new Error("protocol");
    return parsed.toString();
  } catch {
    throw new JobsDirectoryError(
      "Use a complete HTTPS application address.",
      400,
      "invalid_application_url"
    );
  }
}

export function cleanUuid(value: unknown, label = "id") {
  const id = cleanText(value, 60);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id
    )
  ) {
    throw new JobsDirectoryError(`Invalid ${label}.`, 400, "invalid_id");
  }
  return id;
}

export function cleanStringArray(value: unknown, maxLength = 120) {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .map((item) => cleanText(item, maxLength))
        .filter(Boolean)
    ),
  ];
}

export function cleanDate(value: unknown, label: string) {
  const date = cleanText(value, 10);
  if (!date) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new JobsDirectoryError(
      `Enter a valid ${label}.`,
      400,
      "invalid_job_date"
    );
  }

  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  ) {
    throw new JobsDirectoryError(
      `Enter a valid ${label}.`,
      400,
      "invalid_job_date"
    );
  }

  return date;
}

export function cleanExpiry(value: unknown) {
  const date = cleanDate(value, "expiration date");
  return date ? `${date}T23:59:59.999Z` : null;
}

export function slugifyJob(value: string) {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "job"
  );
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function nestedBusiness(row: Record<string, unknown>) {
  const raw = row.businesses;
  if (Array.isArray(raw)) {
    return (raw[0] ?? {}) as Record<string, unknown>;
  }
  return (raw ?? {}) as Record<string, unknown>;
}

export function normalizeEmployer(
  row: Record<string, unknown>
): JobEmployerOption {
  return {
    id: cleanText(row.id, 60),
    name: cleanText(row.name, 200),
    slug: cleanText(row.slug, 100),
    logoUrl: cleanText(row.logo_url, 2048),
    verificationStatus: cleanText(row.verification_status, 20),
    status: cleanText(row.status, 20),
    ownerId: cleanText(row.owner_id, 60) || null,
  };
}

export function normalizeJob(row: Record<string, unknown>): JobPosting {
  const business = nestedBusiness(row);
  const employmentType = cleanText(row.employment_type, 30);
  const workplaceType = cleanText(row.workplace_type, 20);
  const experienceLevel = cleanText(row.experience_level, 30);
  const compensationPeriod = cleanText(row.compensation_period, 20);
  const status = cleanText(row.status, 20);

  return {
    id: cleanText(row.id, 60),
    businessId: cleanText(row.business_id, 60),
    businessName:
      cleanText(row.business_name, 200) ||
      cleanText(business.name, 200) ||
      "Employer",
    businessSlug:
      cleanText(row.business_slug, 100) || cleanText(business.slug, 100),
    businessLogoUrl:
      cleanText(row.business_logo_url, 2048) ||
      cleanText(business.logo_url, 2048),
    businessVerificationStatus:
      cleanText(row.business_verification_status, 20) ||
      cleanText(business.verification_status, 20),
    businessStatus:
      cleanText(row.business_status, 20) || cleanText(business.status, 20),
    slug: cleanText(row.slug, 100),
    title: cleanText(row.title, 200),
    summary: cleanText(row.summary, 500),
    description: cleanLongText(row.description, 12000),
    responsibilities: cleanLongText(row.responsibilities, 8000),
    qualifications: cleanLongText(row.qualifications, 8000),
    category: cleanText(row.category, 120),
    employmentType: (
      [
        "full_time",
        "part_time",
        "contract",
        "temporary",
        "internship",
        "seasonal",
        "apprenticeship",
        "volunteer",
      ].includes(employmentType)
        ? employmentType
        : "full_time"
    ) as JobEmploymentType,
    workplaceType: (
      ["on_site", "hybrid", "remote"].includes(workplaceType)
        ? workplaceType
        : "on_site"
    ) as JobWorkplaceType,
    experienceLevel: (
      ["not_specified", "entry", "mid", "senior", "lead", "executive"].includes(
        experienceLevel
      )
        ? experienceLevel
        : "not_specified"
    ) as JobExperienceLevel,
    city: cleanText(row.city, 100),
    region: cleanText(row.region, 100),
    postalCode: cleanText(row.postal_code, 30),
    countryCode: cleanText(row.country_code, 2) || "US",
    compensationMin: nullableNumber(row.compensation_min),
    compensationMax: nullableNumber(row.compensation_max),
    compensationCurrency:
      cleanText(row.compensation_currency, 3).toUpperCase() || "USD",
    compensationPeriod: (
      ["hour", "day", "week", "month", "year", "project"].includes(
        compensationPeriod
      )
        ? compensationPeriod
        : "year"
    ) as JobCompensationPeriod,
    showCompensation: asBoolean(row.show_compensation),
    applicationUrl: cleanText(row.application_url, 2048),
    applicationEmail: cleanText(row.application_email, 254),
    skills: Array.isArray(row.skills)
      ? row.skills.map((item) => cleanText(item, 120)).filter(Boolean)
      : [],
    benefits: Array.isArray(row.benefits)
      ? row.benefits.map((item) => cleanText(item, 160)).filter(Boolean)
      : [],
    applicationDeadline:
      cleanText(row.application_deadline, 10) || null,
    expiresAt: cleanText(row.expires_at, 60) || null,
    status: (
      [
        "draft",
        "pending",
        "published",
        "rejected",
        "suspended",
        "closed",
        "expired",
      ].includes(status)
        ? status
        : "pending"
    ) as JobPostingStatus,
    moderationReason: cleanLongText(row.moderation_reason, 2000),
    publishedAt: cleanText(row.published_at, 60) || null,
    closedAt: cleanText(row.closed_at, 60) || null,
    createdAt: cleanText(row.created_at, 60) || null,
    updatedAt: cleanText(row.updated_at, 60) || null,
  };
}

export const JOB_SELECT = `
  id,
  business_id,
  created_by,
  slug,
  title,
  summary,
  description,
  responsibilities,
  qualifications,
  category,
  employment_type,
  workplace_type,
  experience_level,
  city,
  region,
  postal_code,
  country_code,
  compensation_min,
  compensation_max,
  compensation_currency,
  compensation_period,
  show_compensation,
  application_url,
  application_email,
  skills,
  benefits,
  application_deadline,
  expires_at,
  status,
  moderation_reason,
  published_at,
  closed_at,
  created_at,
  updated_at,
  businesses!inner (
    id,
    owner_id,
    slug,
    name,
    logo_url,
    verification_status,
    status
  )
`;

export async function resolveJobsViewer(
  request: NextRequest,
  requireUser = false
): Promise<JobsViewer> {
  const requestClient = createRequestSupabase(request);
  const service = createRoomServiceSupabase();
  const {
    data: { user },
  } = await requestClient.auth.getUser();

  if (!user) {
    if (requireUser) {
      throw new JobsDirectoryError(
        "Sign in to manage a job posting.",
        401,
        "authentication_required"
      );
    }
    return { user: null, isAdmin: false, service };
  }

  const { data: profile, error } = await service
    .from("profiles")
    .select("is_admin, account_status, enforcement_reason, suspended_until")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile) {
    throw new JobsDirectoryError(
      "Unable to verify Jobs Directory access.",
      503,
      "jobs_access_unavailable"
    );
  }

  const enforcement = getAccountEnforcementResult(profile);
  if (!enforcement.allowed) {
    throw new JobsDirectoryError(
      enforcement.errorMessage ?? "Account access is restricted.",
      403,
      enforcement.code ?? "account_restricted"
    );
  }

  return { user, isAdmin: Boolean(profile.is_admin), service };
}

export async function refreshExpiredJobs(service: SupabaseClient) {
  const { error } = await service.rpc("expire_local_job_postings");
  if (!error) return;

  const missing =
    error.code === "42883" ||
    /expire_local_job_postings|schema cache|could not find the function/i.test(
      error.message ?? ""
    );

  if (!missing) {
    console.error("Unable to refresh expired job postings:", error);
  }
}

export function missingJobsSchema(error: {
  code?: string | null;
  message?: string | null;
}) {
  return (
    error.code === "42P01" ||
    /job_postings|job_reports|search_public_jobs.*does not exist/i.test(
      error.message ?? ""
    )
  );
}
