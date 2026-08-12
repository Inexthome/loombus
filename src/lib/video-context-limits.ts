import {
  VIDEO_CONTEXT_LIMITS as PLAN_VIDEO_CONTEXT_LIMITS,
} from "@/lib/subscription-entitlements";

export type VideoContextTier = "free" | "premium" | "premium_plus" | "admin";

export type VideoContextEntitlement = {
  tier: string | null;
  ai_assisted_enabled: boolean | null;
  monthly_summary_limit: number | null;
} | null;

export type VideoContextLimits = {
  tier: VideoContextTier;
  label: string;
  monthlyUploadLimit: number;
  maxDurationSeconds: number;
  monthlyProcessedSecondsLimit: number;
  maxFileSizeBytes: number;
};

export const NON_VIDEO_ATTACHMENT_MAX_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_DISCUSSION_ATTACHMENTS = 3;
export const MAX_VIDEO_CONTEXTS_PER_DISCUSSION = 1;

export const NON_VIDEO_ATTACHMENT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
] as const;

export const VIDEO_CONTEXT_ALLOWED_MIME_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const;

export const DISCUSSION_ATTACHMENT_ACCEPT = [
  ...NON_VIDEO_ATTACHMENT_MIME_TYPES,
  ...VIDEO_CONTEXT_ALLOWED_MIME_TYPES,
].join(",");

const free = PLAN_VIDEO_CONTEXT_LIMITS.free;
const premium = PLAN_VIDEO_CONTEXT_LIMITS.premium;
const pro = PLAN_VIDEO_CONTEXT_LIMITS.pro;

export const VIDEO_CONTEXT_LIMITS: Record<VideoContextTier, VideoContextLimits> = {
  free: {
    tier: "free",
    label: "Free trial",
    monthlyUploadLimit: free.uploadsPerMonth,
    maxDurationSeconds: free.maxMinutesPerUpload * 60,
    monthlyProcessedSecondsLimit: free.totalMinutesPerMonth * 60,
    maxFileSizeBytes: 150 * 1024 * 1024,
  },
  premium: {
    tier: "premium",
    label: "Premium",
    monthlyUploadLimit: premium.uploadsPerMonth,
    maxDurationSeconds: premium.maxMinutesPerUpload * 60,
    monthlyProcessedSecondsLimit: premium.totalMinutesPerMonth * 60,
    maxFileSizeBytes: 1024 * 1024 * 1024,
  },
  premium_plus: {
    tier: "premium_plus",
    label: "Premium Pro",
    monthlyUploadLimit: pro.uploadsPerMonth,
    maxDurationSeconds: pro.maxMinutesPerUpload * 60,
    monthlyProcessedSecondsLimit: pro.totalMinutesPerMonth * 60,
    maxFileSizeBytes: 2 * 1024 * 1024 * 1024,
  },
  admin: {
    tier: "admin",
    label: "Admin",
    monthlyUploadLimit: 999999,
    maxDurationSeconds: 60 * 60,
    monthlyProcessedSecondsLimit: 999999 * 60,
    maxFileSizeBytes: 2 * 1024 * 1024 * 1024,
  },
};

export function getVideoContextTier(
  entitlement: VideoContextEntitlement,
  isAdmin = false
): VideoContextTier {
  if (isAdmin || entitlement?.tier === "admin") {
    return "admin";
  }

  const normalizedTier = entitlement?.tier?.trim().toLowerCase().replaceAll("-", "_");

  if (
    entitlement?.ai_assisted_enabled === true &&
    (normalizedTier === "premium_plus" ||
      normalizedTier === "premium_pro" ||
      normalizedTier === "pro")
  ) {
    return "premium_plus";
  }

  if (
    entitlement?.ai_assisted_enabled === true &&
    normalizedTier === "premium" &&
    (entitlement.monthly_summary_limit ?? 0) >= 150
  ) {
    return "premium_plus";
  }

  if (
    entitlement?.ai_assisted_enabled === true &&
    normalizedTier === "premium"
  ) {
    return "premium";
  }

  return "free";
}

export function getVideoContextLimitsForEntitlement(
  entitlement: VideoContextEntitlement,
  isAdmin = false
) {
  return VIDEO_CONTEXT_LIMITS[getVideoContextTier(entitlement, isAdmin)];
}

export function isVideoContextMimeType(mimeType: string) {
  return (VIDEO_CONTEXT_ALLOWED_MIME_TYPES as readonly string[]).includes(
    mimeType.trim().toLowerCase()
  );
}

export function getAttachmentKindForMimeType(mimeType: string) {
  const normalizedMimeType = mimeType.trim().toLowerCase();

  if (normalizedMimeType.startsWith("image/")) {
    return "image";
  }

  if (normalizedMimeType === "application/pdf") {
    return "pdf";
  }

  if (isVideoContextMimeType(normalizedMimeType)) {
    return "video";
  }

  return null;
}

export function formatVideoContextDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

export function formatVideoContextLimitSummary(limits: VideoContextLimits) {
  return `${limits.label}: ${limits.monthlyUploadLimit.toLocaleString()} videos/month, up to ${formatVideoContextDuration(limits.maxDurationSeconds)} each, and ${Math.floor(limits.monthlyProcessedSecondsLimit / 60).toLocaleString()} processed minutes/month.`;
}

export function formatVideoContextFileSizeLimit(limits: VideoContextLimits) {
  const megabytes = limits.maxFileSizeBytes / (1024 * 1024);
  return megabytes >= 1024
    ? `${Number((megabytes / 1024).toFixed(1))} GB`
    : `${Math.round(megabytes)} MB`;
}
