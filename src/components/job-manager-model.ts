import type { JobPosting } from "@/lib/jobs-directory";

export type JobDraft = {
  businessId: string;
  title: string;
  summary: string;
  description: string;
  responsibilities: string;
  qualifications: string;
  category: string;
  employmentType: string;
  workplaceType: string;
  experienceLevel: string;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
  compensationMin: string;
  compensationMax: string;
  compensationCurrency: string;
  compensationPeriod: string;
  showCompensation: boolean;
  applicationUrl: string;
  applicationEmail: string;
  skills: string;
  benefits: string;
  applicationDeadline: string;
  expiresAt: string;
  publishNow: boolean;
};

export type UpdateJobDraft = <K extends keyof JobDraft>(
  key: K,
  value: JobDraft[K]
) => void;

export const EMPTY_JOB_DRAFT: JobDraft = {
  businessId: "",
  title: "",
  summary: "",
  description: "",
  responsibilities: "",
  qualifications: "",
  category: "",
  employmentType: "full_time",
  workplaceType: "on_site",
  experienceLevel: "not_specified",
  city: "",
  region: "",
  postalCode: "",
  countryCode: "US",
  compensationMin: "",
  compensationMax: "",
  compensationCurrency: "USD",
  compensationPeriod: "year",
  showCompensation: true,
  applicationUrl: "",
  applicationEmail: "",
  skills: "",
  benefits: "",
  applicationDeadline: "",
  expiresAt: "",
  publishNow: false,
};

function dateInput(value: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

export function draftFromJob(job: JobPosting): JobDraft {
  return {
    businessId: job.businessId,
    title: job.title,
    summary: job.summary,
    description: job.description,
    responsibilities: job.responsibilities,
    qualifications: job.qualifications,
    category: job.category,
    employmentType: job.employmentType,
    workplaceType: job.workplaceType,
    experienceLevel: job.experienceLevel,
    city: job.city,
    region: job.region,
    postalCode: job.postalCode,
    countryCode: job.countryCode || "US",
    compensationMin:
      job.compensationMin === null ? "" : String(job.compensationMin),
    compensationMax:
      job.compensationMax === null ? "" : String(job.compensationMax),
    compensationCurrency: job.compensationCurrency || "USD",
    compensationPeriod: job.compensationPeriod,
    showCompensation: job.showCompensation,
    applicationUrl: job.applicationUrl,
    applicationEmail: job.applicationEmail,
    skills: job.skills.join(", "),
    benefits: job.benefits.join(", "),
    applicationDeadline: dateInput(job.applicationDeadline),
    expiresAt: dateInput(job.expiresAt),
    publishNow: job.status === "published",
  };
}
