export type JobPostingStatus =
  | "draft"
  | "pending"
  | "published"
  | "rejected"
  | "suspended"
  | "closed"
  | "expired";

export type JobEmploymentType =
  | "full_time"
  | "part_time"
  | "contract"
  | "temporary"
  | "internship"
  | "seasonal"
  | "apprenticeship"
  | "volunteer";

export type JobWorkplaceType = "on_site" | "hybrid" | "remote";

export type JobExperienceLevel =
  | "not_specified"
  | "entry"
  | "mid"
  | "senior"
  | "lead"
  | "executive";

export type JobCompensationPeriod =
  | "hour"
  | "day"
  | "week"
  | "month"
  | "year"
  | "project";

export type JobPosting = {
  id: string;
  businessId: string;
  businessName: string;
  businessSlug: string;
  businessLogoUrl: string;
  businessVerificationStatus: string;
  businessStatus: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  responsibilities: string;
  qualifications: string;
  category: string;
  employmentType: JobEmploymentType;
  workplaceType: JobWorkplaceType;
  experienceLevel: JobExperienceLevel;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
  compensationMin: number | null;
  compensationMax: number | null;
  compensationCurrency: string;
  compensationPeriod: JobCompensationPeriod;
  showCompensation: boolean;
  applicationUrl: string;
  applicationEmail: string;
  skills: string[];
  benefits: string[];
  applicationDeadline: string | null;
  expiresAt: string | null;
  status: JobPostingStatus;
  moderationReason: string;
  publishedAt: string | null;
  closedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type JobEmployerOption = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string;
  verificationStatus: string;
  status: string;
  ownerId: string | null;
};

export type JobReport = {
  id: string;
  jobId: string;
  jobTitle: string;
  businessName: string;
  reporterId: string;
  reason: string;
  details: string;
  status: "open" | "resolved" | "dismissed";
  createdAt: string | null;
};

export type JobsDirectoryResponse = {
  jobs: JobPosting[];
  total: number;
  page: number;
  pageSize: number;
  directoryActive: boolean;
};

export type JobsManageResponse = {
  authenticated: boolean;
  isAdmin: boolean;
  jobs: JobPosting[];
  moderation: {
    pendingJobs: JobPosting[];
    openReports: JobReport[];
  };
};

export const JOB_EMPLOYMENT_TYPES: Array<{
  value: JobEmploymentType;
  label: string;
}> = [
  { value: "full_time", label: "Full time" },
  { value: "part_time", label: "Part time" },
  { value: "contract", label: "Contract" },
  { value: "temporary", label: "Temporary" },
  { value: "internship", label: "Internship" },
  { value: "seasonal", label: "Seasonal" },
  { value: "apprenticeship", label: "Apprenticeship" },
  { value: "volunteer", label: "Volunteer" },
];

export const JOB_WORKPLACE_TYPES: Array<{
  value: JobWorkplaceType;
  label: string;
}> = [
  { value: "on_site", label: "On site" },
  { value: "hybrid", label: "Hybrid" },
  { value: "remote", label: "Remote" },
];

export const JOB_EXPERIENCE_LEVELS: Array<{
  value: JobExperienceLevel;
  label: string;
}> = [
  { value: "not_specified", label: "Not specified" },
  { value: "entry", label: "Entry level" },
  { value: "mid", label: "Mid level" },
  { value: "senior", label: "Senior" },
  { value: "lead", label: "Lead or manager" },
  { value: "executive", label: "Executive" },
];

export const JOB_COMPENSATION_PERIODS: Array<{
  value: JobCompensationPeriod;
  label: string;
}> = [
  { value: "hour", label: "Per hour" },
  { value: "day", label: "Per day" },
  { value: "week", label: "Per week" },
  { value: "month", label: "Per month" },
  { value: "year", label: "Per year" },
  { value: "project", label: "Per project" },
];

export const JOB_CATEGORIES = [
  "Accounting and finance",
  "Administrative",
  "Automotive",
  "Construction and skilled trades",
  "Creative and media",
  "Customer service",
  "Education and training",
  "Engineering",
  "Food and hospitality",
  "Healthcare",
  "Home services",
  "Human resources",
  "Information technology",
  "Legal",
  "Management",
  "Manufacturing",
  "Marketing and communications",
  "Public service",
  "Real estate",
  "Retail and sales",
  "Transportation and logistics",
  "Other",
] as const;

export function employmentTypeLabel(value: JobEmploymentType) {
  return (
    JOB_EMPLOYMENT_TYPES.find((item) => item.value === value)?.label ??
    "Employment"
  );
}

export function workplaceTypeLabel(value: JobWorkplaceType) {
  return (
    JOB_WORKPLACE_TYPES.find((item) => item.value === value)?.label ??
    "Workplace"
  );
}

export function experienceLevelLabel(value: JobExperienceLevel) {
  return (
    JOB_EXPERIENCE_LEVELS.find((item) => item.value === value)?.label ??
    "Experience not specified"
  );
}

export function jobLocationLabel(job: JobPosting) {
  if (job.workplaceType === "remote") {
    const region = [job.region, job.countryCode].filter(Boolean).join(", ");
    return region ? `Remote · ${region}` : "Remote";
  }

  const location = [job.city, job.region, job.postalCode]
    .filter(Boolean)
    .join(", ");

  if (job.workplaceType === "hybrid") {
    return location ? `Hybrid · ${location}` : "Hybrid";
  }

  return location || "Location not specified";
}

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
    }).format(value);
  } catch {
    return `${currency || "USD"} ${value.toLocaleString()}`;
  }
}

export function jobCompensationLabel(job: JobPosting) {
  if (!job.showCompensation) return "";
  const minimum = job.compensationMin;
  const maximum = job.compensationMax;
  if (minimum === null && maximum === null) return "";

  const period =
    JOB_COMPENSATION_PERIODS.find(
      (item) => item.value === job.compensationPeriod
    )?.label.toLowerCase() ?? "compensation";

  if (minimum !== null && maximum !== null && minimum !== maximum) {
    return `${formatMoney(minimum, job.compensationCurrency)} – ${formatMoney(
      maximum,
      job.compensationCurrency
    )} ${period}`;
  }

  const amount = minimum ?? maximum;
  return amount === null
    ? ""
    : `${formatMoney(amount, job.compensationCurrency)} ${period}`;
}

export function formatJobDate(value: string | null) {
  if (!value) return "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00`)
    : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function jobStatusLabel(status: JobPostingStatus) {
  if (status === "pending") return "Pending review";
  if (status === "published") return "Published";
  if (status === "rejected") return "Changes requested";
  if (status === "suspended") return "Suspended";
  if (status === "closed") return "Closed";
  if (status === "expired") return "Expired";
  return "Draft";
}
