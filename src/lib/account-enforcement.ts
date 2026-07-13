export type AccountStatus =
  | "active"
  | "warned"
  | "suspended"
  | "banned"
  | "deactivated"
  | "deletion_requested";

export type AccountEnforcementCode =
  | "account_suspended"
  | "account_banned"
  | "account_deactivated"
  | "account_deletion_requested"
  | "account_access_unverified";

type AccountEnforcementProfile = {
  account_status: string | null;
  enforcement_reason: string | null;
  suspended_until: string | null;
};

export type AccountEnforcementResult = {
  allowed: boolean;
  status: AccountStatus;
  errorMessage?: string;
  code?: AccountEnforcementCode;
};

function normalizeAccountStatus(
  status: string | null | undefined
): AccountStatus | null {
  if (status === null || status === undefined || status === "") {
    return "active";
  }

  if (
    status === "active" ||
    status === "warned" ||
    status === "suspended" ||
    status === "banned" ||
    status === "deactivated" ||
    status === "deletion_requested"
  ) {
    return status;
  }

  return null;
}

function formatSuspensionMessage(profile: AccountEnforcementProfile) {
  const reason = profile.enforcement_reason?.trim();
  const until = profile.suspended_until
    ? new Date(profile.suspended_until).toLocaleString()
    : null;

  if (until && reason) {
    return `Your Loombus account is suspended until ${until}. Reason: ${reason}`;
  }

  if (until) {
    return `Your Loombus account is suspended until ${until}.`;
  }

  if (reason) {
    return `Your Loombus account is suspended. Reason: ${reason}`;
  }

  return "Your Loombus account is suspended.";
}

function formatBanMessage(profile: AccountEnforcementProfile) {
  const reason = profile.enforcement_reason?.trim();

  if (reason) {
    return `Your Loombus account is banned. Reason: ${reason}`;
  }

  return "Your Loombus account is banned.";
}

function formatDeactivatedMessage(profile: AccountEnforcementProfile) {
  const reason = profile.enforcement_reason?.trim();

  if (reason) {
    return `Your Loombus account is deactivated. Reason: ${reason}`;
  }

  return "Your Loombus account is deactivated.";
}

function formatDeletionRequestedMessage() {
  return "Your Loombus account has an open deletion request. Account actions are restricted while the request is pending.";
}

function getUnverifiedAccountResult(): AccountEnforcementResult {
  return {
    allowed: false,
    status: "active",
    code: "account_access_unverified",
    errorMessage: "Account access could not be verified.",
  };
}

export function getAccountEnforcementResult(
  profile: AccountEnforcementProfile | null
): AccountEnforcementResult {
  if (!profile) {
    return getUnverifiedAccountResult();
  }

  const status = normalizeAccountStatus(profile.account_status);

  if (!status) {
    return getUnverifiedAccountResult();
  }

  if (status === "active" || status === "warned") {
    return {
      allowed: true,
      status,
    };
  }

  if (status === "suspended") {
    const suspendedUntil = profile.suspended_until
      ? new Date(profile.suspended_until).getTime()
      : null;

    if (
      suspendedUntil &&
      Number.isFinite(suspendedUntil) &&
      suspendedUntil <= Date.now()
    ) {
      return {
        allowed: true,
        status,
      };
    }

    return {
      allowed: false,
      status,
      code: "account_suspended",
      errorMessage: formatSuspensionMessage(profile),
    };
  }

  if (status === "deactivated") {
    return {
      allowed: false,
      status,
      code: "account_deactivated",
      errorMessage: formatDeactivatedMessage(profile),
    };
  }

  if (status === "deletion_requested") {
    return {
      allowed: false,
      status,
      code: "account_deletion_requested",
      errorMessage: formatDeletionRequestedMessage(),
    };
  }

  return {
    allowed: false,
    status,
    code: "account_banned",
    errorMessage: formatBanMessage(profile),
  };
}
