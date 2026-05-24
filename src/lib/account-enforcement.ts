type AccountStatus = "active" | "warned" | "suspended" | "banned";

type AccountEnforcementProfile = {
  account_status: string | null;
  enforcement_reason: string | null;
  suspended_until: string | null;
};

export type AccountEnforcementResult = {
  allowed: boolean;
  status: AccountStatus;
  errorMessage?: string;
  code?: "account_suspended" | "account_banned";
};

function normalizeAccountStatus(status: string | null | undefined): AccountStatus {
  if (
    status === "active" ||
    status === "warned" ||
    status === "suspended" ||
    status === "banned"
  ) {
    return status;
  }

  return "active";
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

export function getAccountEnforcementResult(
  profile: AccountEnforcementProfile | null
): AccountEnforcementResult {
  const status = normalizeAccountStatus(profile?.account_status);

  if (!profile || status === "active" || status === "warned") {
    return {
      allowed: true,
      status,
    };
  }

  if (status === "suspended") {
    const suspendedUntil = profile.suspended_until
      ? new Date(profile.suspended_until).getTime()
      : null;

    if (suspendedUntil && Number.isFinite(suspendedUntil) && suspendedUntil <= Date.now()) {
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

  return {
    allowed: false,
    status,
    code: "account_banned",
    errorMessage: formatBanMessage(profile),
  };
}
