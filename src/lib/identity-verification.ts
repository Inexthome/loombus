export type IdentityVerificationStatus =
  | "unverified"
  | "pending"
  | "verified"
  | "failed"
  | "restricted";

export const IDENTITY_VERIFICATION_REMINDER_TYPE =
  "identity_verification_reminder";

export const IDENTITY_VERIFICATION_TARGET_TYPE = "identity_verification";

export const IDENTITY_VERIFICATION_REMINDER_MESSAGE =
  "Complete identity verification so your account is ready for posting and replies.";

const IDENTITY_VERIFICATION_STATUSES = new Set<IdentityVerificationStatus>([
  "unverified",
  "pending",
  "verified",
  "failed",
  "restricted",
]);

export function normalizeIdentityVerificationStatus(
  value: string | null | undefined
): IdentityVerificationStatus {
  if (IDENTITY_VERIFICATION_STATUSES.has(value as IdentityVerificationStatus)) {
    return value as IdentityVerificationStatus;
  }

  return "unverified";
}

export function shouldSendIdentityVerificationReminder(
  status: IdentityVerificationStatus
) {
  return status === "unverified" || status === "failed";
}

export function getIdentityVerificationDisplay(
  status: IdentityVerificationStatus
) {
  if (status === "verified") {
    return {
      label: "Verified",
      badgeClassName: "border-emerald-900 text-emerald-300",
      cardClassName: "border-emerald-900 bg-emerald-950/10",
      description:
        "Your identity verification is complete. This helps keep Loombus accountable as participation grows.",
      nextAction: "No action needed.",
    };
  }

  if (status === "pending") {
    return {
      label: "Pending",
      badgeClassName: "border-amber-900 text-amber-300",
      cardClassName: "border-amber-900 bg-amber-950/10",
      description:
        "Your identity verification is pending. Posting and reply limits will not change until Loombus turns on verification gates.",
      nextAction: "Check back later for verification status updates.",
    };
  }

  if (status === "failed") {
    return {
      label: "Needs review",
      badgeClassName: "border-orange-900 text-orange-300",
      cardClassName: "border-orange-900 bg-orange-950/10",
      description:
        "Identity verification was not completed. You may need to try again or contact support once verification opens.",
      nextAction: "Prepare to verify with an approved identity provider.",
    };
  }

  if (status === "restricted") {
    return {
      label: "Restricted",
      badgeClassName: "border-red-900 text-red-300",
      cardClassName: "border-red-900 bg-red-950/10",
      description:
        "Identity verification is restricted for this account. Contact support if you believe this is a mistake.",
      nextAction: "Contact support for help.",
    };
  }

  return {
    label: "Not verified",
    badgeClassName: "border-zinc-800 text-zinc-400",
    cardClassName: "border-zinc-800 bg-zinc-950",
    description:
      "Identity verification is not complete yet. Loombus will use verification to support accountable posting and replies.",
    nextAction:
      "You will be notified when verification is ready to complete.",
  };
}
