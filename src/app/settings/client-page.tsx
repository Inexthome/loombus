"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  getAiUsageLabel,
  getSubscriptionDisplay,
} from "@/lib/subscription-plans";

type AiEntitlement = {
  tier: string;
  ai_assisted_enabled: boolean;
  monthly_summary_limit: number;
};

type ProfileAccount = {
  is_admin: boolean | null;
  account_status: string | null;
};

type DeletionRequest = {
  id: string;
  status: string;
  requested_at: string;
};

type AppearanceMode = "system" | "dark" | "light";

const APPEARANCE_STORAGE_KEY = "loombus:appearance";

const appearanceOptions: {
  value: AppearanceMode;
  label: string;
  description: string;
}[] = [
  {
    value: "system",
    label: "System",
    description: "Match your device appearance automatically.",
  },
  {
    value: "dark",
    label: "Dark",
    description: "Use the original dark Loombus interface.",
  },
  {
    value: "light",
    label: "Light",
    description: "Use a brighter interface where supported.",
  },
];

function applyAppearanceMode(mode: AppearanceMode) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.loombusTheme = mode;
}

function getStoredAppearanceMode(): AppearanceMode {
  if (typeof window === "undefined") {
    return "system";
  }

  const stored = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);

  if (stored === "dark" || stored === "light" || stored === "system") {
    return stored;
  }

  return "system";
}

function withSettingsTimeout<T>(
  promise: PromiseLike<T>,
  label: string,
  ms = 8000
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out. Please reload settings.`));
    }, ms);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

const settingsSections = [
  {
    title: "Account",
    items: [
      {
        title: "Profile",
        description: "Edit your public profile, username, full name, and bio.",
        href: "/profile",
      },
      {
        title: "Notification Settings",
        description: "Choose which replies, follows, and mentions can notify you.",
        href: "/profile",
      },
      {
        title: "Blocked Users",
        description: "Review blocked members and unblock them from one place.",
        href: "/blocked-users",
      },
    ],
  },
  {
    title: "Activity",
    items: [
      {
        title: "My Activity",
        description: "See your full activity overview in one place.",
        href: "/my-activity",
      },
      {
        title: "My Discussions",
        description: "Review the discussions you started.",
        href: "/my-discussions",
      },
      {
        title: "My Replies",
        description: "Review the replies you contributed.",
        href: "/my-replies",
      },
      {
        title: "Saved",
        description: "Revisit discussions you saved for later.",
        href: "/saved",
      },
      {
        title: "Reading History",
        description: "Revisit discussions you opened recently.",
        href: "/reading-history",
      },
      {
        title: "Notifications",
        description: "Review unread and read notifications.",
        href: "/notifications",
      },
    ],
  },
  {
    title: "Platform",
    items: [
      {
        title: "About Loombus",
        description: "Read the platform purpose and positioning.",
        href: "/about",
      },
      {
        title: "Loombus Setup Guide",
        description: "Review profile setup, topic lanes, Reality Lenses, people discovery, saved learning, and first-discussion guidance.",
        href: "/onboarding",
      },
      {
        title: "Premium",
        description: "Review Loombus Premium AI subscription options and checkout access.",
        href: "/premium",
      },
      {
        title: "AI Usage",
        description: "Review your monthly AI-assisted usage, cached outputs, and recent AI activity.",
        href: "/ai-usage",
      },
      {
        title: "Guidelines",
        description: "Review community standards and contribution expectations.",
        href: "/guidelines",
      },
      {
        title: "Safety",
        description: "Review safety expectations, reporting, blocking, and enforcement.",
        href: "/safety",
      },
      {
        title: "Privacy",
        description: "Review how Loombus handles account, platform, AI, and usage information.",
        href: "/privacy",
      },
      {
        title: "Terms",
        description: "Review the terms for using Loombus.",
        href: "/terms",
      },
      {
        title: "Cookies",
        description: "Review cookie and similar technology information.",
        href: "/cookies",
      },
      {
        title: "Refund Policy",
        description: "Review paid feature cancellation, refund, and billing dispute rules.",
        href: "/refunds",
      },
      {
        title: "Copyright / DMCA",
        description: "Review copyright, rights concerns, and DMCA notice information.",
        href: "/dmca",
      },
      {
        title: "Accessibility",
        description: "Review accessibility support and feedback options.",
        href: "/accessibility",
      },
      {
        title: "Contact",
        description: "Get help with support, safety concerns, accessibility, or account questions.",
        href: "/contact",
      },
    ],
  },
];

export default function SettingsClientPage() {
  const [aiEntitlement, setAiEntitlement] = useState<AiEntitlement | null>(null);
  const [profileAccount, setProfileAccount] = useState<ProfileAccount | null>(null);
  const [deletionRequest, setDeletionRequest] = useState<DeletionRequest | null>(null);
  const [deactivateConfirmation, setDeactivateConfirmation] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [appearanceMode, setAppearanceMode] = useState<AppearanceMode>("system");
  const [accountActionMessage, setAccountActionMessage] = useState("");
  const [accountActionWorking, setAccountActionWorking] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const [hasPasswordProvider, setHasPasswordProvider] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordActionMessage, setPasswordActionMessage] = useState("");
  const [passwordActionWorking, setPasswordActionWorking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const storedAppearanceMode = getStoredAppearanceMode();
    setAppearanceMode(storedAppearanceMode);
    applyAppearanceMode(storedAppearanceMode);
  }, []);

  useEffect(() => {
    async function requireUser() {
      setLoadError("");

      try {
        const { data, error: userError } = await withSettingsTimeout(
          supabase.auth.getUser(),
          "Settings authentication check"
        );

        if (userError) {
          throw userError;
        }

        if (!data.user) {
          window.location.replace("/login");
          return;
        }

        setCurrentUserEmail(data.user.email ?? "");
        const identityProviders = (data.user.identities ?? []).map(
          (identity) => identity.provider
        );
        const appProviders = Array.isArray(data.user.app_metadata?.providers)
          ? data.user.app_metadata.providers
          : [];
        const appProvider =
          typeof data.user.app_metadata?.provider === "string"
            ? data.user.app_metadata.provider
            : "";

        setHasPasswordProvider(
          identityProviders.includes("email") ||
            appProviders.includes("email") ||
            appProvider === "email"
        );

        const [entitlementResult, profileResult, deletionRequestResult] =
          await withSettingsTimeout(
            Promise.all([
              supabase
                .from("user_ai_entitlements")
                .select("tier, ai_assisted_enabled, monthly_summary_limit")
                .eq("user_id", data.user.id)
                .maybeSingle(),
              supabase
                .from("profiles")
                .select("is_admin, account_status")
                .eq("id", data.user.id)
                .maybeSingle(),
              supabase
                .from("account_deletion_requests")
                .select("id, status, requested_at")
                .eq("user_id", data.user.id)
                .in("status", ["requested", "reviewing"])
                .order("requested_at", { ascending: false })
                .limit(1)
                .maybeSingle(),
            ]),
            "Settings account check"
          );

        if (entitlementResult.error || profileResult.error || deletionRequestResult.error) {
          throw entitlementResult.error ?? profileResult.error ?? deletionRequestResult.error;
        }

        setAiEntitlement(entitlementResult.data ?? null);
        setProfileAccount((profileResult.data ?? null) as ProfileAccount | null);
        setDeletionRequest((deletionRequestResult.data ?? null) as DeletionRequest | null);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to load settings.";
        setLoadError(message);
      } finally {
        setLoading(false);
      }
    }

    requireUser();
  }, []);

  const subscriptionDisplay = getSubscriptionDisplay(aiEntitlement);
  const aiUsageLabel = getAiUsageLabel(aiEntitlement);

  function updateAppearanceMode(mode: AppearanceMode) {
    setAppearanceMode(mode);
    window.localStorage.setItem(APPEARANCE_STORAGE_KEY, mode);
    applyAppearanceMode(mode);
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordActionMessage("");

    if (passwordActionWorking) {
      return;
    }

    if (!hasPasswordProvider) {
      setPasswordActionMessage(
        "This account uses Google sign-in. Manage your Google password through Google."
      );
      return;
    }

    if (!currentUserEmail) {
      setPasswordActionMessage("Unable to confirm your account email. Please sign in again.");
      return;
    }

    if (!currentPassword.trim()) {
      setPasswordActionMessage("Enter your current password.");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordActionMessage("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordActionMessage("New passwords do not match.");
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordActionMessage("Choose a new password that is different from your current password.");
      return;
    }

    setPasswordActionWorking(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: currentUserEmail,
        password: currentPassword,
      });

      if (signInError) {
        setPasswordActionMessage("Current password is incorrect.");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setPasswordActionMessage(updateError.message || "Unable to update password.");
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setPasswordActionMessage("Password updated successfully.");
      setChangePasswordOpen(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to update password.";
      setPasswordActionMessage(message);
    } finally {
      setPasswordActionWorking(false);
    }
  }

  async function deactivateAccount() {
    setAccountActionMessage("");

    if (accountActionWorking) {
      return;
    }

    if (deactivateConfirmation.trim() !== "DEACTIVATE") {
      setAccountActionMessage("Type DEACTIVATE to confirm account deactivation.");
      return;
    }

    setAccountActionWorking(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch("/api/account/deactivate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          confirmation: deactivateConfirmation.trim(),
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setAccountActionMessage(result.error ?? "Unable to deactivate account.");
        return;
      }

      setAccountActionMessage("Account deactivated. You will be signed out.");
      setTimeout(async () => {
        await supabase.auth.signOut();
        window.location.href = "/";
      }, 900);
    } finally {
      setAccountActionWorking(false);
    }
  }

  async function requestAccountDeletion() {
    setAccountActionMessage("");

    if (accountActionWorking) {
      return;
    }

    if (deleteConfirmation.trim() !== "DELETE") {
      setAccountActionMessage("Type DELETE to request account deletion.");
      return;
    }

    setAccountActionWorking(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch("/api/account/delete-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          confirmation: deleteConfirmation.trim(),
          reason: deleteReason,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setAccountActionMessage(result.error ?? "Unable to request account deletion.");
        return;
      }

      setProfileAccount((current) =>
        current ? { ...current, account_status: "deletion_requested" } : current
      );
      setDeletionRequest({
        id: result.deletionRequestId,
        status: "requested",
        requested_at: result.requestedAt ?? new Date().toISOString(),
      });
      setAccountActionMessage("Account deletion requested. Your account actions are now restricted while the request is pending.");
    } finally {
      setAccountActionWorking(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-4 pb-24 pt-4 text-white sm:px-6 sm:py-12 lg:py-16">
        <div className="mx-auto max-w-6xl text-zinc-400">
          Loading settings...
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="min-h-screen bg-black px-4 pb-24 pt-4 text-white sm:px-6 sm:py-12 lg:py-16">
        <div className="mx-auto max-w-6xl rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black/30 sm:rounded-3xl sm:p-7">
          <h1 className="mb-3 text-2xl font-medium">
            Settings could not load.
          </h1>

          <p className="mb-5 text-sm leading-relaxed text-zinc-500">
            {loadError}
          </p>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex w-full justify-center rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white sm:w-fit"
          >
            Reload settings
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 pb-24 pt-4 text-white sm:px-6 sm:py-12 lg:py-16">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/dashboard"
          className="mb-5 inline-block text-sm text-zinc-500 hover:text-white sm:mb-10"
        >
          ← Back to dashboard
        </Link>

        <div className="mb-5 sm:mb-10">
          <p className="mb-2 text-xs uppercase tracking-[0.22em] text-zinc-500 sm:mb-3 sm:text-sm sm:tracking-[0.3em]">
            Account
          </p>

          <h1 className="text-2xl font-semibold tracking-tight sm:text-4xl md:text-6xl">
            Settings
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500 sm:mt-4 sm:text-base">
            Manage your profile, activity, notifications, saved items,
            and platform reference pages from one place.
          </p>
        </div>

        <section className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl shadow-black/30 sm:mb-10 sm:rounded-3xl sm:p-7">
          <div className="mb-4 sm:mb-5">
            <p className="mb-2 text-xs uppercase tracking-[0.22em] text-zinc-500 sm:text-sm sm:tracking-[0.25em]">
              Appearance
            </p>

            <h2 className="text-xl font-medium sm:text-2xl">
              Display mode
            </h2>

            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-500">
              Choose how Loombus looks on this device. System follows your browser or operating system setting.
            </p>
          </div>

          <div className="grid gap-2 sm:gap-3 md:grid-cols-3">
            {appearanceOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => updateAppearanceMode(option.value)}
                className={`rounded-2xl border p-3.5 text-left transition sm:p-4 ${
                  appearanceMode === option.value
                    ? "border-zinc-400 bg-black text-white"
                    : "border-zinc-800 bg-black text-zinc-400 hover:border-zinc-600 hover:text-white"
                }`}
              >
                <span className="block text-sm font-medium">
                  {option.label}
                </span>

                <span className="mt-2 block text-sm leading-6 text-zinc-500">
                  {option.description}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl shadow-black/30 sm:mb-10 sm:rounded-3xl sm:p-7">
          <div className="mb-4 flex flex-col items-start gap-3 sm:mb-5 sm:flex-row sm:justify-between sm:gap-4">
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.22em] text-zinc-500 sm:text-sm sm:tracking-[0.25em]">
                Current plan
              </p>

              <h2 className="text-xl font-medium sm:text-2xl">
                {subscriptionDisplay.label}
              </h2>
            </div>

            <span className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300">
              {subscriptionDisplay.badge}
            </span>
          </div>

          <p className="mb-3 text-sm leading-relaxed text-zinc-400 sm:text-base">
            {subscriptionDisplay.description}
          </p>

          <p className="mb-5 text-sm text-zinc-500">
            Included AI usage: {aiUsageLabel}
          </p>

          <Link
            href={subscriptionDisplay.href}
            className="inline-flex w-full justify-center rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white sm:w-fit"
          >
            {subscriptionDisplay.nextAction}
          </Link>
        </section>

        <div className="space-y-5 sm:space-y-8">
          {settingsSections.map((section) => (
            <section key={section.title}>
              <h2 className="mb-3 text-lg font-medium sm:mb-4 sm:text-2xl">
                {section.title}
              </h2>

              <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
                {section.items.map((item) => (
                  <Link
                    key={item.title}
                    href={item.href}
                    className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 transition hover:border-zinc-700 sm:p-6"
                  >
                    <h3 className="mb-2 text-base font-medium sm:mb-3 sm:text-xl">
                      {item.title}
                    </h3>

                    <p className="text-sm leading-relaxed text-zinc-400 sm:text-base">
                      {item.description}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>

        <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl shadow-black/30 sm:mt-10 sm:rounded-3xl sm:p-7">
          <p className="mb-2 text-sm uppercase tracking-[0.25em] text-zinc-500">
            Account security
          </p>

          <h2 className="mb-3 text-lg font-medium sm:mb-4 sm:text-2xl">
            Password security.
          </h2>

          <p className="mb-5 max-w-3xl text-sm leading-relaxed text-zinc-500">
            Change the password used for email login. For your protection, Loombus asks
            for your current password before saving a new one.
          </p>

          <div className="rounded-2xl border border-zinc-900 bg-black p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="mb-2 text-lg font-medium sm:mb-3 sm:text-xl">
                  Change password
                </h3>

                <p className="text-sm leading-relaxed text-zinc-500">
                  Use this if you can already sign in and want to update your password.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setChangePasswordOpen((open) => !open);
                  setPasswordActionMessage("");
                }}
                disabled={!hasPasswordProvider}
                className="w-full rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700 sm:w-fit"
              >
                {changePasswordOpen ? "Hide password form" : "Change password"}
              </button>
            </div>

            {!hasPasswordProvider && (
              <div className="mt-5 rounded-2xl border border-zinc-900 bg-zinc-950/70 p-4 text-sm leading-relaxed text-zinc-500">
                This account appears to use Google sign-in. Manage your Google password
                through Google. Email password recovery depends on Loombus Auth email delivery.
              </div>
            )}

            {changePasswordOpen && hasPasswordProvider && (
              <form onSubmit={changePassword} className="mt-5 grid gap-4">
                <label className="block text-sm text-zinc-500">
                  <span className="mb-2 block">Current password</span>
                  <input
                    type="password"
                    value={currentPassword}
                    autoComplete="current-password"
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-base text-zinc-300 outline-none focus:border-zinc-600"
                  />
                </label>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block text-sm text-zinc-500">
                    <span className="mb-2 block">New password</span>
                    <input
                      type="password"
                      value={newPassword}
                      autoComplete="new-password"
                      onChange={(event) => setNewPassword(event.target.value)}
                      className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-base text-zinc-300 outline-none focus:border-zinc-600"
                    />
                  </label>

                  <label className="block text-sm text-zinc-500">
                    <span className="mb-2 block">Confirm new password</span>
                    <input
                      type="password"
                      value={confirmNewPassword}
                      autoComplete="new-password"
                      onChange={(event) => setConfirmNewPassword(event.target.value)}
                      className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-base text-zinc-300 outline-none focus:border-zinc-600"
                    />
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={passwordActionWorking}
                  className="w-full rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700 sm:w-fit"
                >
                  {passwordActionWorking ? "Updating..." : "Update password"}
                </button>
              </form>
            )}

            {passwordActionMessage && (
              <p className="mt-5 text-sm text-zinc-400">
                {passwordActionMessage}
              </p>
            )}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-red-950 bg-red-950/10 p-4 shadow-2xl shadow-black/30 sm:mt-10 sm:rounded-3xl sm:p-7">
          <p className="mb-2 text-sm uppercase tracking-[0.25em] text-red-400">
            Account controls
          </p>

          <h2 className="mb-3 text-lg font-medium sm:mb-4 sm:text-2xl">
            Deactivate or request deletion.
          </h2>

          <p className="mb-5 max-w-3xl text-sm leading-relaxed text-zinc-500">
            Deactivation disables your account and signs you out. Account deletion
            creates a deletion request for review and future processing. Loombus
            does not hard-delete accounts immediately because moderation records,
            billing state, audit logs, and public content need careful handling.
          </p>

          {profileAccount?.is_admin && (
            <div className="mb-5 rounded-2xl border border-amber-900 bg-amber-950/20 p-4 text-sm leading-relaxed text-amber-200">
              This account cannot be deactivated or requested for deletion while it is required for platform operations.
            </div>
          )}

          {deletionRequest && (
            <div className="mb-5 rounded-2xl border border-violet-900 bg-violet-950/20 p-4 text-sm leading-relaxed text-violet-200">
              You already have an open deletion request from{" "}
              {new Date(deletionRequest.requested_at).toLocaleString()}.
              Status: {deletionRequest.status}.
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
            <div className="rounded-2xl border border-zinc-900 bg-black p-4 sm:p-5">
              <h3 className="mb-2 text-lg font-medium sm:mb-3 sm:text-xl">
                Deactivate account
              </h3>

              <p className="mb-4 text-sm leading-relaxed text-zinc-500">
                This disables your account actions and signs you out. Existing
                content and safety records are not deleted.
              </p>

              <label className="mb-4 block text-sm text-zinc-500">
                <span className="mb-2 block">Type DEACTIVATE</span>
                <input
                  type="text"
                  value={deactivateConfirmation}
                  onChange={(event) => setDeactivateConfirmation(event.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-base text-zinc-300 outline-none focus:border-zinc-600"
                />
              </label>

              <button
                type="button"
                onClick={deactivateAccount}
                disabled={accountActionWorking || profileAccount?.account_status === "deactivated"}
                className="w-full rounded-full border border-red-900 px-5 py-3 text-sm text-red-300 transition hover:border-red-700 hover:text-red-200 disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700 sm:w-fit"
              >
                {accountActionWorking ? "Working..." : "Deactivate account"}
              </button>
            </div>

            <div className="rounded-2xl border border-zinc-900 bg-black p-4 sm:p-5">
              <h3 className="mb-2 text-lg font-medium sm:mb-3 sm:text-xl">
                Request account deletion
              </h3>

              <p className="mb-4 text-sm leading-relaxed text-zinc-500">
                This submits a deletion request and restricts account actions
                while the request is pending.
              </p>

              <label className="mb-4 block text-sm text-zinc-500">
                <span className="mb-2 block">Reason optional</span>
                <textarea
                  value={deleteReason}
                  onChange={(event) => setDeleteReason(event.target.value)}
                  rows={3}
                  maxLength={2000}
                  className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-base text-zinc-300 outline-none focus:border-zinc-600"
                />
              </label>

              <label className="mb-4 block text-sm text-zinc-500">
                <span className="mb-2 block">Type DELETE</span>
                <input
                  type="text"
                  value={deleteConfirmation}
                  onChange={(event) => setDeleteConfirmation(event.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-base text-zinc-300 outline-none focus:border-zinc-600"
                />
              </label>

              <button
                type="button"
                onClick={requestAccountDeletion}
                disabled={accountActionWorking || Boolean(deletionRequest)}
                className="w-full rounded-full border border-red-900 px-5 py-3 text-sm text-red-300 transition hover:border-red-700 hover:text-red-200 disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700 sm:w-fit"
              >
                {accountActionWorking ? "Working..." : "Request account deletion"}
              </button>
            </div>
          </div>

          {accountActionMessage && (
            <p className="mt-5 text-sm text-zinc-400">
              {accountActionMessage}
            </p>
          )}
        </section>

      </div>
    </main>
  );
}
