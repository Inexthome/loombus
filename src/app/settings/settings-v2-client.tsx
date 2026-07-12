"use client";

import { DISCUSSION_TOPICS } from "@/lib/discussion-topics";
import { supabase } from "@/lib/supabase/client";
import {
  getAiUsageLabel,
  getSubscriptionDisplay,
} from "@/lib/subscription-plans";
import {
  Bell,
  BookOpen,
  ChevronRight,
  CreditCard,
  Eye,
  FileText,
  LifeBuoy,
  Lock,
  Mail,
  MessageCircle,
  Monitor,
  Moon,
  Shield,
  Smartphone,
  Sparkles,
  Sun,
  Trash2,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import "./settings-v2.css";

type AiEntitlement = {
  tier: string | null;
  ai_assisted_enabled: boolean | null;
  monthly_summary_limit: number | null;
};

type ProfileAccount = {
  full_name: string | null;
  username: string | null;
  is_admin: boolean | null;
  account_status: string | null;
};

type DeletionRequest = {
  id: string;
  status: string;
  requested_at: string;
};

type AppearanceMode = "system" | "dark" | "light";

type NotificationPreferences = {
  repliesEnabled: boolean;
  followsEnabled: boolean;
  mentionsEnabled: boolean;
  followedDiscussionsEnabled: boolean;
  followedRepliesEnabled: boolean;
  emailDigestEnabled: boolean;
  emailDigestFrequency: "daily" | "weekly";
  pushMessagesEnabled: boolean;
  pushRepliesEnabled: boolean;
  pushFollowsEnabled: boolean;
  pushAdminReportsEnabled: boolean;
};

type NotificationApiPayload = {
  preferences?: Partial<NotificationPreferences>;
  canUseEmailDigest?: boolean;
  isAdmin?: boolean;
  error?: string;
};

type TopicAlertPayload = {
  canUseTopicAlerts?: boolean;
  topics?: string[];
  selectedTopics?: string[];
  error?: string;
};

const APPEARANCE_STORAGE_KEY = "loombus:appearance";

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  repliesEnabled: true,
  followsEnabled: true,
  mentionsEnabled: true,
  followedDiscussionsEnabled: true,
  followedRepliesEnabled: false,
  emailDigestEnabled: false,
  emailDigestFrequency: "weekly",
  pushMessagesEnabled: true,
  pushRepliesEnabled: true,
  pushFollowsEnabled: true,
  pushAdminReportsEnabled: true,
};

const appearanceOptions: {
  value: AppearanceMode;
  label: string;
  description: string;
  Icon: LucideIcon;
}[] = [
  {
    value: "system",
    label: "System",
    description: "Match this device automatically.",
    Icon: Monitor,
  },
  {
    value: "light",
    label: "Light",
    description: "Use the Loombus Cream workspace.",
    Icon: Sun,
  },
  {
    value: "dark",
    label: "Dark",
    description: "Use the low-light workspace.",
    Icon: Moon,
  },
];

const referenceLinks = [
  {
    href: "/settings/guide",
    title: "Loombus Guide",
    description: "How the platform and its Signal workspaces fit together.",
  },
  {
    href: "/ai-usage",
    title: "AI Usage",
    description: "Monthly limits, cached outputs, and recent AI activity.",
  },
  {
    href: "/contact",
    title: "Support",
    description: "Account, accessibility, safety, and platform assistance.",
  },
  {
    href: "/about",
    title: "About Loombus",
    description: "Platform purpose, positioning, and Signal-first direction.",
  },
  {
    href: "/guidelines",
    title: "Guidelines",
    description: "Behavior, discussion quality, and community standards.",
  },
  {
    href: "/terms",
    title: "Terms",
    description: "Terms governing use of Loombus.",
  },
  {
    href: "/cookies",
    title: "Cookies",
    description: "Cookie and similar-technology information.",
  },
  {
    href: "/refunds",
    title: "Refund Policy",
    description: "Paid-feature cancellation and billing-dispute rules.",
  },
  {
    href: "/dmca",
    title: "Copyright / DMCA",
    description: "Copyright notices and rights concerns.",
  },
  {
    href: "/accessibility",
    title: "Accessibility",
    description: "Accessibility support and feedback options.",
  },
];

function applyAppearanceMode(mode: AppearanceMode) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.loombusTheme = mode;
}

function getStoredAppearanceMode(): AppearanceMode {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
  return stored === "dark" || stored === "light" || stored === "system"
    ? stored
    : "system";
}

function withSettingsTimeout<T>(
  promise: PromiseLike<T>,
  label: string,
  ms = 9000
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out. Reload settings and try again.`));
    }, ms);
  });

  return Promise.race([Promise.resolve(promise), timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

function formatAccountStatus(value: string | null | undefined) {
  if (!value || value === "active") return "Active";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function ToggleRow({
  label,
  description,
  checked,
  disabled = false,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={`settings-v2-toggle-row${disabled ? " is-disabled" : ""}`}>
      <span className="settings-v2-toggle-copy">
        <strong>{label}</strong>
        <span>{description}</span>
      </span>
      <span className="settings-v2-switch">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span aria-hidden="true" />
      </span>
    </label>
  );
}

function ResourceLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link href={href} className="settings-v2-resource-link">
      <div>
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      <ChevronRight aria-hidden="true" />
    </Link>
  );
}

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

export default function SettingsV2Client() {
  const [aiEntitlement, setAiEntitlement] = useState<AiEntitlement | null>(null);
  const [profileAccount, setProfileAccount] = useState<ProfileAccount | null>(null);
  const [deletionRequest, setDeletionRequest] = useState<DeletionRequest | null>(null);
  const [blockedCount, setBlockedCount] = useState(0);
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const [hasPasswordProvider, setHasPasswordProvider] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [appearanceMode, setAppearanceMode] = useState<AppearanceMode>("system");
  const [appearanceMessage, setAppearanceMessage] = useState("");
  const [preferences, setPreferences] = useState<NotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES
  );
  const [canUseEmailDigest, setCanUseEmailDigest] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [notificationSaving, setNotificationSaving] = useState(false);
  const [topicOptions, setTopicOptions] = useState<string[]>([
    ...DISCUSSION_TOPICS,
  ]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [savedSelectedTopics, setSavedSelectedTopics] = useState<string[]>([]);
  const [canUseTopicAlerts, setCanUseTopicAlerts] = useState(false);
  const [topicMessage, setTopicMessage] = useState("");
  const [topicSaving, setTopicSaving] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordActionMessage, setPasswordActionMessage] = useState("");
  const [passwordActionWorking, setPasswordActionWorking] = useState(false);
  const [deactivateConfirmation, setDeactivateConfirmation] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [accountActionMessage, setAccountActionMessage] = useState("");
  const [accountActionWorking, setAccountActionWorking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const storedAppearanceMode = getStoredAppearanceMode();
    setAppearanceMode(storedAppearanceMode);
    applyAppearanceMode(storedAppearanceMode);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadSettings() {
      setLoadError("");

      try {
        const { data: userData, error: userError } = await withSettingsTimeout(
          supabase.auth.getUser(),
          "Settings authentication check"
        );

        if (userError) throw userError;

        if (!userData.user) {
          window.location.replace("/login?next=/settings");
          return;
        }

        const accessToken = await getAccessToken();
        if (!accessToken) {
          window.location.replace("/login?next=/settings");
          return;
        }

        const user = userData.user;
        const identityProviders = (user.identities ?? []).map(
          (identity) => identity.provider
        );
        const appProviders = Array.isArray(user.app_metadata?.providers)
          ? user.app_metadata.providers
          : [];
        const appProvider =
          typeof user.app_metadata?.provider === "string"
            ? user.app_metadata.provider
            : "";

        if (mounted) {
          setCurrentUserEmail(user.email ?? "");
          setHasPasswordProvider(
            identityProviders.includes("email") ||
              appProviders.includes("email") ||
              appProvider === "email"
          );
        }

        const [
          entitlementResult,
          profileResult,
          deletionResult,
          blocksResult,
          notificationResponse,
          topicResponse,
        ] = await withSettingsTimeout(
          Promise.all([
            supabase
              .from("user_ai_entitlements")
              .select("tier, ai_assisted_enabled, monthly_summary_limit")
              .eq("user_id", user.id)
              .maybeSingle(),
            supabase
              .from("profiles")
              .select("full_name, username, is_admin, account_status")
              .eq("id", user.id)
              .maybeSingle(),
            supabase
              .from("account_deletion_requests")
              .select("id, status, requested_at")
              .eq("user_id", user.id)
              .in("status", ["requested", "reviewing"])
              .order("requested_at", { ascending: false })
              .limit(1)
              .maybeSingle(),
            supabase
              .from("user_blocks")
              .select("id")
              .eq("blocker_id", user.id),
            fetch("/api/settings/notification-preferences", {
              headers: { Authorization: `Bearer ${accessToken}` },
            }),
            fetch("/api/topic-alerts", {
              headers: { Authorization: `Bearer ${accessToken}` },
            }),
          ]),
          "Settings account and preference check"
        );

        if (
          entitlementResult.error ||
          profileResult.error ||
          deletionResult.error ||
          blocksResult.error
        ) {
          throw (
            entitlementResult.error ??
            profileResult.error ??
            deletionResult.error ??
            blocksResult.error
          );
        }

        const notificationPayload = (await notificationResponse
          .json()
          .catch(() => ({}))) as NotificationApiPayload;
        const topicPayload = (await topicResponse
          .json()
          .catch(() => ({}))) as TopicAlertPayload;

        if (!mounted) return;

        const profile = (profileResult.data ?? null) as ProfileAccount | null;
        setAiEntitlement((entitlementResult.data ?? null) as AiEntitlement | null);
        setProfileAccount(profile);
        setDeletionRequest(
          (deletionResult.data ?? null) as DeletionRequest | null
        );
        setBlockedCount((blocksResult.data ?? []).length);
        setIsAdmin(Boolean(profile?.is_admin || notificationPayload.isAdmin));

        if (notificationResponse.ok) {
          setPreferences({
            ...DEFAULT_NOTIFICATION_PREFERENCES,
            ...(notificationPayload.preferences ?? {}),
          });
          setCanUseEmailDigest(
            Boolean(notificationPayload.canUseEmailDigest)
          );
        } else {
          setNotificationMessage(
            notificationPayload.error ?? "Signal preferences could not load."
          );
        }

        if (topicResponse.ok) {
          const nextOptions = Array.isArray(topicPayload.topics)
            ? topicPayload.topics
            : [...DISCUSSION_TOPICS];
          const nextSelected = Array.isArray(topicPayload.selectedTopics)
            ? topicPayload.selectedTopics
            : [];
          setTopicOptions(nextOptions);
          setSelectedTopics(nextSelected);
          setSavedSelectedTopics(nextSelected);
          setCanUseTopicAlerts(Boolean(topicPayload.canUseTopicAlerts));
        } else {
          setTopicMessage(topicPayload.error ?? "Topic alerts could not load.");
        }
      } catch (error) {
        if (!mounted) return;
        setLoadError(
          error instanceof Error ? error.message : "Unable to load settings."
        );
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadSettings();

    return () => {
      mounted = false;
    };
  }, []);

  const subscriptionDisplay = getSubscriptionDisplay(aiEntitlement);
  const aiUsageLabel = getAiUsageLabel(aiEntitlement);
  const selectedTopicSet = useMemo(
    () => new Set(selectedTopics),
    [selectedTopics]
  );
  const topicAlertsDirty = useMemo(() => {
    const current = [...selectedTopics].sort().join("|");
    const saved = [...savedSelectedTopics].sort().join("|");
    return current !== saved;
  }, [savedSelectedTopics, selectedTopics]);
  const profileName =
    profileAccount?.full_name?.trim() ||
    profileAccount?.username?.trim() ||
    "Loombus member";
  const signInMethod = hasPasswordProvider ? "Email and password" : "Google";

  function updateAppearanceMode(mode: AppearanceMode) {
    setAppearanceMode(mode);
    window.localStorage.setItem(APPEARANCE_STORAGE_KEY, mode);
    applyAppearanceMode(mode);
    window.dispatchEvent(
      new CustomEvent("loombus:appearance-changed", { detail: { mode } })
    );
    setAppearanceMessage(`${mode.charAt(0).toUpperCase() + mode.slice(1)} appearance applied on this device.`);
  }

  function updatePreference<K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K]
  ) {
    setPreferences((current) => ({ ...current, [key]: value }));
    setNotificationMessage("");
  }

  async function saveNotificationPreferences() {
    if (notificationSaving) return;
    setNotificationSaving(true);
    setNotificationMessage("");

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        window.location.href = "/login?next=/settings";
        return;
      }

      const response = await fetch("/api/settings/notification-preferences", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(preferences),
      });
      const result = (await response
        .json()
        .catch(() => ({}))) as NotificationApiPayload;

      if (!response.ok) {
        setNotificationMessage(
          result.error ?? "Unable to save Signal preferences."
        );
        return;
      }

      setPreferences({
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        ...(result.preferences ?? {}),
      });
      setCanUseEmailDigest(Boolean(result.canUseEmailDigest));
      setNotificationMessage("Signal Inbox and delivery preferences saved.");
    } catch {
      setNotificationMessage("Unable to save Signal preferences. Try again.");
    } finally {
      setNotificationSaving(false);
    }
  }

  function toggleTopic(topic: string) {
    if (!canUseTopicAlerts || topicSaving) return;
    setSelectedTopics((current) =>
      current.includes(topic)
        ? current.filter((item) => item !== topic)
        : [...current, topic]
    );
    setTopicMessage("");
  }

  async function saveTopicAlerts() {
    if (!canUseTopicAlerts || topicSaving) return;
    setTopicSaving(true);
    setTopicMessage("");

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        window.location.href = "/login?next=/settings";
        return;
      }

      const response = await fetch("/api/topic-alerts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ topics: selectedTopics }),
      });
      const result = (await response
        .json()
        .catch(() => ({}))) as TopicAlertPayload;

      if (!response.ok) {
        setTopicMessage(result.error ?? "Unable to save topic alerts.");
        return;
      }

      const nextSelected = Array.isArray(result.selectedTopics)
        ? result.selectedTopics
        : selectedTopics;
      setSelectedTopics(nextSelected);
      setSavedSelectedTopics(nextSelected);
      setTopicMessage("Topic alerts saved. New-discussion alerts are active for the selected topics.");
    } catch {
      setTopicMessage("Unable to save topic alerts. Try again.");
    } finally {
      setTopicSaving(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (passwordActionWorking) return;
    setPasswordActionMessage("");

    if (!hasPasswordProvider) {
      setPasswordActionMessage(
        "This account uses Google sign-in. Manage its password through Google."
      );
      return;
    }

    if (!currentUserEmail) {
      setPasswordActionMessage("Unable to confirm your account email. Sign in again.");
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
      setPasswordActionMessage("Choose a password different from the current password.");
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
        setPasswordActionMessage(
          updateError.message || "Unable to update password."
        );
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setChangePasswordOpen(false);
      setPasswordActionMessage("Password updated successfully.");
    } catch {
      setPasswordActionMessage("Unable to update password. Try again.");
    } finally {
      setPasswordActionWorking(false);
    }
  }

  async function deactivateAccount() {
    if (accountActionWorking) return;
    setAccountActionMessage("");

    if (profileAccount?.is_admin) {
      setAccountActionMessage(
        "This admin account cannot be deactivated while required for platform operations."
      );
      return;
    }

    if (deactivateConfirmation.trim() !== "DEACTIVATE") {
      setAccountActionMessage("Type DEACTIVATE to confirm account deactivation.");
      return;
    }

    setAccountActionWorking(true);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch("/api/account/deactivate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ confirmation: deactivateConfirmation.trim() }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setAccountActionMessage(
          result.error ?? "Unable to deactivate account."
        );
        return;
      }

      setAccountActionMessage("Account deactivated. You will be signed out.");
      window.setTimeout(async () => {
        await supabase.auth.signOut();
        window.location.href = "/";
      }, 900);
    } catch {
      setAccountActionMessage("Unable to deactivate account. Try again.");
    } finally {
      setAccountActionWorking(false);
    }
  }

  async function requestAccountDeletion() {
    if (accountActionWorking) return;
    setAccountActionMessage("");

    if (profileAccount?.is_admin) {
      setAccountActionMessage(
        "This admin account cannot request deletion while required for platform operations."
      );
      return;
    }

    if (deleteConfirmation.trim() !== "DELETE") {
      setAccountActionMessage("Type DELETE to request account deletion.");
      return;
    }

    setAccountActionWorking(true);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch("/api/account/delete-request", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          confirmation: deleteConfirmation.trim(),
          reason: deleteReason,
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setAccountActionMessage(
          result.error ?? "Unable to request account deletion."
        );
        return;
      }

      const requestedAt = result.requestedAt ?? new Date().toISOString();
      setProfileAccount((current) =>
        current ? { ...current, account_status: "deletion_requested" } : current
      );
      setDeletionRequest({
        id: result.deletionRequestId,
        status: "requested",
        requested_at: requestedAt,
      });
      setAccountActionMessage(
        "Account deletion requested. Account actions are restricted while review is pending."
      );
    } catch {
      setAccountActionMessage("Unable to request account deletion. Try again.");
    } finally {
      setAccountActionWorking(false);
    }
  }

  if (loading) {
    return (
      <main className="settings-v2-page">
        <section className="settings-v2-state">
          <div>
            <Sparkles aria-hidden="true" />
            <h1>Loading Account & Signal Settings…</h1>
            <p>Checking account access, Signal preferences, topic alerts, and security controls.</p>
          </div>
        </section>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="settings-v2-page">
        <section className="settings-v2-state">
          <div>
            <Shield aria-hidden="true" />
            <h1>Settings could not load.</h1>
            <p>{loadError}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="settings-v2-primary-action"
              style={{ marginTop: "1rem" }}
            >
              Reload settings
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="settings-v2-page">
      <div className="settings-v2-shell">
        <header className="settings-v2-hero">
          <div>
            <p className="settings-v2-eyebrow">Private account workspace</p>
            <h1>Account & Signal Settings</h1>
            <p className="settings-v2-hero-copy">
              Control how Loombus looks, how Signal reaches you, which topics you track,
              and how your account is protected. Public identity editing remains in Profile.
            </p>
          </div>
          <div className="settings-v2-hero-actions">
            <Link href="/profile" className="settings-v2-primary-action">
              <User aria-hidden="true" /> Edit profile
            </Link>
            <Link href="/notifications" className="settings-v2-secondary-action">
              <Bell aria-hidden="true" /> Open Signal Inbox
            </Link>
          </div>
        </header>

        <section className="settings-v2-metrics" aria-label="Account settings overview">
          <article>
            <span>Member</span>
            <strong>{profileName}</strong>
          </article>
          <article>
            <span>Plan</span>
            <strong>{subscriptionDisplay.label}</strong>
          </article>
          <article>
            <span>Blocked members</span>
            <strong>{blockedCount}</strong>
          </article>
          <article className="is-accent">
            <span>Tracked topics</span>
            <strong>{selectedTopics.length}</strong>
          </article>
        </section>

        <div className="settings-v2-layout">
          <nav className="settings-v2-nav" aria-label="Settings sections">
            <a href="#appearance"><Eye aria-hidden="true" /> Appearance</a>
            <a href="#signal"><Bell aria-hidden="true" /> Signal delivery</a>
            <a href="#topics"><Sparkles aria-hidden="true" /> Topic alerts</a>
            <a href="#privacy"><Shield aria-hidden="true" /> Privacy</a>
            <a href="#security"><Lock aria-hidden="true" /> Security</a>
            <a href="#plan"><CreditCard aria-hidden="true" /> Plan</a>
            <a href="#reference"><BookOpen aria-hidden="true" /> Reference</a>
            <a href="#account-controls"><Trash2 aria-hidden="true" /> Account controls</a>
          </nav>

          <div className="settings-v2-main">
            <section id="appearance" className="settings-v2-card">
              <div className="settings-v2-card-header">
                <div>
                  <p className="settings-v2-eyebrow">Appearance</p>
                  <h2>Choose the workspace mode.</h2>
                  <p>Appearance is stored on this device and applied across supported Loombus pages.</p>
                </div>
                <span className="settings-v2-badge"><Eye aria-hidden="true" /> Device setting</span>
              </div>

              <div className="settings-v2-appearance-grid">
                {appearanceOptions.map(({ value, label, description, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => updateAppearanceMode(value)}
                    className={`settings-v2-appearance-option${appearanceMode === value ? " is-active" : ""}`}
                  >
                    <Icon aria-hidden="true" />
                    <strong>{label}</strong>
                    <span>{description}</span>
                  </button>
                ))}
              </div>
              {appearanceMessage && <div className="settings-v2-notice" style={{ marginTop: "0.8rem", marginBottom: 0 }}>{appearanceMessage}</div>}
            </section>

            <section id="signal" className="settings-v2-card">
              <div className="settings-v2-card-header">
                <div>
                  <p className="settings-v2-eyebrow">Signal delivery</p>
                  <h2>Decide what reaches your Signal Inbox.</h2>
                  <p>These controls preserve the existing notification-preference rules while moving their canonical management into Settings.</p>
                </div>
                <span className="settings-v2-badge"><Bell aria-hidden="true" /> Signal Inbox</span>
              </div>

              {notificationMessage && <div className="settings-v2-notice">{notificationMessage}</div>}

              <div className="settings-v2-preference-grid">
                <section className="settings-v2-preference-group">
                  <h3>In-app Signal</h3>
                  <p>Choose the activity shown in your Loombus Signal Inbox.</p>
                  <div className="settings-v2-toggle-list">
                    <ToggleRow
                      label="Replies to my discussions"
                      description="Show Signal when someone replies to a discussion you created."
                      checked={preferences.repliesEnabled}
                      onChange={(value) => updatePreference("repliesEnabled", value)}
                    />
                    <ToggleRow
                      label="New followers"
                      description="Show Signal when another member follows you."
                      checked={preferences.followsEnabled}
                      onChange={(value) => updatePreference("followsEnabled", value)}
                    />
                    <ToggleRow
                      label="Mentions"
                      description="Show Signal when your member identity is mentioned."
                      checked={preferences.mentionsEnabled}
                      onChange={(value) => updatePreference("mentionsEnabled", value)}
                    />
                    <ToggleRow
                      label="Followed members: discussions"
                      description="Show new discussions from members you follow."
                      checked={preferences.followedDiscussionsEnabled}
                      onChange={(value) => updatePreference("followedDiscussionsEnabled", value)}
                    />
                    <ToggleRow
                      label="Followed members: replies"
                      description="Optionally show replies posted by members you follow."
                      checked={preferences.followedRepliesEnabled}
                      onChange={(value) => updatePreference("followedRepliesEnabled", value)}
                    />
                  </div>
                </section>

                <section className="settings-v2-preference-group">
                  <h3>Device delivery</h3>
                  <p>Choose which supported events can reach your phone as native notifications.</p>
                  <div className="settings-v2-toggle-list">
                    <ToggleRow
                      label="Private messages"
                      description="Send a device notification for a new private message."
                      checked={preferences.pushMessagesEnabled}
                      onChange={(value) => updatePreference("pushMessagesEnabled", value)}
                    />
                    <ToggleRow
                      label="Discussion replies"
                      description="Send a device notification for replies to your discussions."
                      checked={preferences.pushRepliesEnabled}
                      onChange={(value) => updatePreference("pushRepliesEnabled", value)}
                    />
                    <ToggleRow
                      label="New followers"
                      description="Send a device notification when a member follows you."
                      checked={preferences.pushFollowsEnabled}
                      onChange={(value) => updatePreference("pushFollowsEnabled", value)}
                    />
                    {isAdmin && (
                      <ToggleRow
                        label="Admin report alerts"
                        description="Send a device notification when a report needs review."
                        checked={preferences.pushAdminReportsEnabled}
                        onChange={(value) => updatePreference("pushAdminReportsEnabled", value)}
                      />
                    )}
                  </div>
                </section>
              </div>

              <section className="settings-v2-preference-group" style={{ marginTop: "0.8rem" }}>
                <h3>Email digest</h3>
                <p>Premium and Admin accounts can receive a daily or weekly summary of recent Loombus notifications.</p>
                <ToggleRow
                  label="Email digest"
                  description={canUseEmailDigest ? "Send a summarized Signal digest by email." : "Email digest requires Premium or Admin access."}
                  checked={preferences.emailDigestEnabled}
                  disabled={!canUseEmailDigest}
                  onChange={(value) => updatePreference("emailDigestEnabled", value)}
                />
                <label className="settings-v2-field">
                  Digest frequency
                  <select
                    className="settings-v2-select"
                    value={preferences.emailDigestFrequency}
                    disabled={!canUseEmailDigest || !preferences.emailDigestEnabled}
                    onChange={(event) => updatePreference("emailDigestFrequency", event.target.value === "daily" ? "daily" : "weekly")}
                  >
                    <option value="weekly">Weekly</option>
                    <option value="daily">Daily</option>
                  </select>
                </label>
              </section>

              <div className="settings-v2-savebar">
                <p>Changes take effect after saving.</p>
                <button
                  type="button"
                  onClick={() => void saveNotificationPreferences()}
                  disabled={notificationSaving}
                  className="settings-v2-primary-action"
                >
                  {notificationSaving ? "Saving…" : "Save Signal preferences"}
                </button>
              </div>
            </section>

            <section id="topics" className="settings-v2-card">
              <div className="settings-v2-card-header">
                <div>
                  <p className="settings-v2-eyebrow">Premium topic alerts</p>
                  <h2>Track the topic lanes that matter.</h2>
                  <p>Following a topic uses the existing topic-alert system and sends Signal when a new discussion enters that topic.</p>
                </div>
                <span className="settings-v2-badge"><Sparkles aria-hidden="true" /> {selectedTopics.length} selected</span>
              </div>

              {topicMessage && (
                <div className="settings-v2-notice">
                  {topicMessage}
                  {!canUseTopicAlerts && <Link href="/premium">View Premium</Link>}
                </div>
              )}

              {!canUseTopicAlerts && (
                <div className="settings-v2-section-note">
                  Free members can browse every topic and its discussions. Selecting topic alerts requires Premium or Admin access.
                </div>
              )}

              <div className="settings-v2-topic-grid" style={{ marginTop: "0.8rem" }}>
                {topicOptions.map((topic) => (
                  <button
                    key={topic}
                    type="button"
                    disabled={!canUseTopicAlerts || topicSaving}
                    onClick={() => toggleTopic(topic)}
                    className={`settings-v2-topic-button${selectedTopicSet.has(topic) ? " is-selected" : ""}`}
                  >
                    {selectedTopicSet.has(topic) ? "✓ " : ""}{topic}
                  </button>
                ))}
              </div>

              <div className="settings-v2-savebar">
                <p>{topicAlertsDirty ? "Unsaved topic-alert changes." : "Topic alerts are synchronized."}</p>
                <button
                  type="button"
                  onClick={() => void saveTopicAlerts()}
                  disabled={!canUseTopicAlerts || topicSaving || !topicAlertsDirty}
                  className="settings-v2-primary-action"
                >
                  {topicSaving ? "Saving…" : "Save topic alerts"}
                </button>
              </div>
            </section>

            <section id="privacy" className="settings-v2-card">
              <div className="settings-v2-card-header">
                <div>
                  <p className="settings-v2-eyebrow">Privacy & access</p>
                  <h2>Control identity, blocks, and platform boundaries.</h2>
                  <p>Public profile fields remain in the Profile editor. Blocking and safety controls retain their existing routes and behavior.</p>
                </div>
                <span className="settings-v2-badge"><Shield aria-hidden="true" /> Private controls</span>
              </div>

              <div className="settings-v2-resource-grid">
                <ResourceLink href="/profile" title="Public profile" description="Edit your name, username, bio, avatar, and creator links." />
                <ResourceLink href="/blocked-users" title={`Blocked members (${blockedCount})`} description="Review blocked members and unblock them when appropriate." />
                <ResourceLink href="/privacy" title="Privacy policy" description="How account, platform, AI, and usage information is handled." />
                <ResourceLink href="/safety" title="Safety controls" description="Reporting, blocking, enforcement, and member protections." />
              </div>
            </section>

            <section id="security" className="settings-v2-card">
              <div className="settings-v2-card-header">
                <div>
                  <p className="settings-v2-eyebrow">Account security</p>
                  <h2>Review sign-in and password access.</h2>
                  <p>Password changes preserve the current reauthentication requirement before a new password is accepted.</p>
                </div>
                <span className="settings-v2-badge"><Lock aria-hidden="true" /> Protected</span>
              </div>

              {passwordActionMessage && <div className="settings-v2-notice">{passwordActionMessage}</div>}

              <div className="settings-v2-security-grid">
                <section className="settings-v2-security-panel">
                  <h3>Account identity</h3>
                  <p>The email and provider currently associated with this Loombus account.</p>
                  <div className="settings-v2-account-summary">
                    <div><span>Email</span><strong>{currentUserEmail || "Unavailable"}</strong></div>
                    <div><span>Sign-in method</span><strong>{signInMethod}</strong></div>
                    <div><span>Account status</span><strong>{formatAccountStatus(profileAccount?.account_status)}</strong></div>
                  </div>
                </section>

                <section className="settings-v2-security-panel">
                  <h3>Change password</h3>
                  <p>{hasPasswordProvider ? "Confirm the current password before saving a new one." : "Google sign-in passwords are managed through Google."}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setChangePasswordOpen((open) => !open);
                      setPasswordActionMessage("");
                    }}
                    disabled={!hasPasswordProvider}
                    className="settings-v2-secondary-action"
                  >
                    {changePasswordOpen ? "Close password form" : "Change password"}
                  </button>
                </section>
              </div>

              {changePasswordOpen && hasPasswordProvider && (
                <form onSubmit={changePassword} className="settings-v2-form">
                  <label className="settings-v2-field">
                    Current password
                    <input
                      type="password"
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                      className="settings-v2-input"
                    />
                  </label>
                  <div className="settings-v2-form-row">
                    <label className="settings-v2-field">
                      New password
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        className="settings-v2-input"
                      />
                    </label>
                    <label className="settings-v2-field">
                      Confirm new password
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={confirmNewPassword}
                        onChange={(event) => setConfirmNewPassword(event.target.value)}
                        className="settings-v2-input"
                      />
                    </label>
                  </div>
                  <div className="settings-v2-inline-actions">
                    <button type="submit" disabled={passwordActionWorking} className="settings-v2-primary-action">
                      {passwordActionWorking ? "Updating…" : "Update password"}
                    </button>
                  </div>
                </form>
              )}
            </section>

            <section id="plan" className="settings-v2-card">
              <div className="settings-v2-card-header">
                <div>
                  <p className="settings-v2-eyebrow">Plan & access</p>
                  <h2>{subscriptionDisplay.label}</h2>
                  <p>{subscriptionDisplay.description}</p>
                </div>
                <span className="settings-v2-badge"><CreditCard aria-hidden="true" /> {subscriptionDisplay.badge}</span>
              </div>

              <section className="settings-v2-plan-panel">
                <h3>Included AI usage</h3>
                <p>{aiUsageLabel}</p>
                <div className="settings-v2-inline-actions">
                  <Link href={subscriptionDisplay.href} className="settings-v2-primary-action">
                    {subscriptionDisplay.nextAction}
                  </Link>
                  <Link href="/ai-usage" className="settings-v2-secondary-action">
                    Review AI usage
                  </Link>
                </div>
              </section>
            </section>

            <section id="reference" className="settings-v2-card">
              <div className="settings-v2-card-header">
                <div>
                  <p className="settings-v2-eyebrow">Help & reference</p>
                  <h2>Platform guidance and legal reference.</h2>
                  <p>Open the exact support, policy, or reference surface needed without leaving the canonical Settings workspace structure.</p>
                </div>
                <span className="settings-v2-badge"><BookOpen aria-hidden="true" /> Reference</span>
              </div>
              <div className="settings-v2-resource-grid">
                {referenceLinks.map((item) => <ResourceLink key={item.href} {...item} />)}
              </div>
            </section>

            <section id="account-controls" className="settings-v2-card settings-v2-danger-card">
              <div className="settings-v2-card-header">
                <div>
                  <p className="settings-v2-eyebrow">Account controls</p>
                  <h2>Deactivate or request deletion.</h2>
                  <p>These actions preserve moderation, billing, audit, and public-content safeguards. Account deletion is a reviewed request, not an immediate hard delete.</p>
                </div>
                <span className="settings-v2-badge"><Trash2 aria-hidden="true" /> Confirmation required</span>
              </div>

              {profileAccount?.is_admin && (
                <div className="settings-v2-notice">This admin account cannot be deactivated or requested for deletion while required for platform operations.</div>
              )}
              {deletionRequest && (
                <div className="settings-v2-notice">
                  Open deletion request from {new Date(deletionRequest.requested_at).toLocaleString()}. Status: {deletionRequest.status}.
                </div>
              )}
              {accountActionMessage && <div className="settings-v2-notice is-danger">{accountActionMessage}</div>}

              <div className="settings-v2-danger-grid">
                <section className="settings-v2-danger-panel">
                  <h3>Deactivate account</h3>
                  <p>Disable account actions and sign out. Existing content and safety records are retained.</p>
                  <label className="settings-v2-field">
                    Type DEACTIVATE
                    <input
                      type="text"
                      value={deactivateConfirmation}
                      onChange={(event) => setDeactivateConfirmation(event.target.value)}
                      className="settings-v2-input"
                    />
                  </label>
                  <div className="settings-v2-danger-actions" style={{ marginTop: "0.8rem" }}>
                    <button
                      type="button"
                      onClick={() => void deactivateAccount()}
                      disabled={accountActionWorking || Boolean(profileAccount?.is_admin) || profileAccount?.account_status === "deactivated"}
                      className="settings-v2-danger-action"
                    >
                      {accountActionWorking ? "Working…" : "Deactivate account"}
                    </button>
                  </div>
                </section>

                <section className="settings-v2-danger-panel">
                  <h3>Request account deletion</h3>
                  <p>Submit a reviewed deletion request and restrict account actions while it is pending.</p>
                  <label className="settings-v2-field">
                    Reason optional
                    <textarea
                      rows={3}
                      maxLength={2000}
                      value={deleteReason}
                      onChange={(event) => setDeleteReason(event.target.value)}
                      className="settings-v2-textarea"
                    />
                  </label>
                  <label className="settings-v2-field">
                    Type DELETE
                    <input
                      type="text"
                      value={deleteConfirmation}
                      onChange={(event) => setDeleteConfirmation(event.target.value)}
                      className="settings-v2-input"
                    />
                  </label>
                  <div className="settings-v2-danger-actions" style={{ marginTop: "0.8rem" }}>
                    <button
                      type="button"
                      onClick={() => void requestAccountDeletion()}
                      disabled={accountActionWorking || Boolean(profileAccount?.is_admin) || Boolean(deletionRequest)}
                      className="settings-v2-danger-action"
                    >
                      {accountActionWorking ? "Working…" : "Request account deletion"}
                    </button>
                  </div>
                </section>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
