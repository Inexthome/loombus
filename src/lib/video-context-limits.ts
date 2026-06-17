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

export const VIDEO_CONTEXT_LIMITS: Record<VideoContextTier, VideoContextLimits> = {
  free: {
    tier: "free",
    label: "Free",
    monthlyUploadLimit: 5,
    maxDurationSeconds: 60,
    maxFileSizeBytes: 75 * 1024 * 1024,
  },
  premium: {
    tier: "premium",
    label: "Premium",
    monthlyUploadLimit: 25,
    maxDurationSeconds: 120,
    maxFileSizeBytes: 150 * 1024 * 1024,
  },
  premium_plus: {
    tier: "premium_plus",
    label: "Premium Plus",
    monthlyUploadLimit: 50,
    maxDurationSeconds: 180,
    maxFileSizeBytes: 250 * 1024 * 1024,
  },
  admin: {
    tier: "admin",
    label: "Admin",
    monthlyUploadLimit: 999999,
    maxDurationSeconds: 180,
    maxFileSizeBytes: 250 * 1024 * 1024,
  },
};

export function getVideoContextTier(
  entitlement: VideoContextEntitlement,
  isAdmin = false
): VideoContextTier {
  if (isAdmin || entitlement?.tier === "admin") {
    return "admin";
  }

  if (
    entitlement?.ai_assisted_enabled === true &&
    entitlement.tier === "premium" &&
    (entitlement.monthly_summary_limit ?? 0) > 50
  ) {
    return "premium_plus";
  }

  if (
    entitlement?.ai_assisted_enabled === true &&
    entitlement.tier === "premium"
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
  return `${limits.label}: ${limits.monthlyUploadLimit.toLocaleString()} videos/month, up to ${formatVideoContextDuration(limits.maxDurationSeconds)} each.`;
}

export function formatVideoContextFileSizeLimit(limits: VideoContextLimits) {
  return `${Math.round(limits.maxFileSizeBytes / (1024 * 1024))} MB`;
}
