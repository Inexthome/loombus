"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Database,
  ExternalLink,
  Eye,
  FileText,
  KeyRound,
  Laptop,
  LifeBuoy,
  LockKeyhole,
  LogOut,
  Mail,
  MessageCircle,
  RefreshCw,
  Shield,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserRound,
  UserRoundX,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import "./privacy-security-v2.css";

type ProfileAccount = {
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  account_status: string | null;
  is_admin: boolean | null;
};

type DeletionRequest = {
  id: string;
  status: string;
  requested_at: string;
};

type MfaFactor = {
  id?: string;
  status?: string;
  factor_type?: string;
  friendly_name?: string;
};

type MfaEnrollment = {
  factorId: string;
  challengeId: string;
  qrCode: string;
  secret: string;
};

type MfaApi = {
  listFactors?: () => Promise<{
    data?: { all?: MfaFactor[]; totp?: MfaFactor[] };
    error?: { message?: string };
  }>;
  enroll?: (args: {
    factorType: "totp";
    friendlyName?: string;
  }) => Promise<{
    data?: { id?: string; totp?: { qr_code?: string; secret?: string } };
    error?: { message?: string };
  }>;
  challenge?: (args: { factorId: string }) => Promise<{
    data?: { id?: string };
    error?: { message?: string };
  }>;
  verify?: (args: {
    factorId: string;
    challengeId: string;
    code: string;
  }) => Promise<{ data?: unknown; error?: { message?: string } }>;
  unenroll?: (args: {
    factorId: string;
  }) => Promise<{ data?: unknown; error?: { message?: string } }>;
};

type ResourceLinkProps = {
  href: string;
  title: string;
  description: string;
  Icon: LucideIcon;
};

function getMfaApi() {
  return (
    (supabase.auth as unknown as { mfa?: MfaApi }).mfa ?? null
  );
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatAccountStatus(value: string | null | undefined) {
  if (!value || value === "active") return "Active";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDeletionStatus(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getProviderNames(user: User | null) {
  if (!user) return [];

  const identityProviders = (user.identities ?? [])
    .map((identity) => identity.provider)
    .filter((provider): provider is string => Boolean(provider));
  const metadataProviders = Array.isArray(user.app_metadata?.providers)
    ? user.app_metadata.providers.filter(
        (provider): provider is string => typeof provider === "string"
      )
    : [];
  const primaryProvider =
    typeof user.app_metadata?.provider === "string"
      ? [user.app_metadata.provider]
      : [];
  const providers = [...new Set([
    ...identityProviders,
    ...metadataProviders,
    ...primaryProvider,
  ])];

  if (providers.length === 0 && user.email) providers.push("email");

  return providers.map((provider) => {
    if (provider === "email") return "Email & password";
    if (provider === "google") return "Google";
    if (provider === "apple") return "Apple";
    return provider.charAt(0).toUpperCase() + provider.slice(1);
  });
}

function getQrSource(value: string) {
  const clean = value.trim();
  if (!clean) return "";
  if (clean.startsWith("data:") || clean.startsWith("https://")) return clean;
  if (clean.startsWith("<svg")) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(clean)}`;
  }
  return clean;
}

function ResourceLink({ href, title, description, Icon }: ResourceLinkProps) {
  return (
    <Link href={href} className="privacy-security-v2-link-card">
      <div>
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      <Icon aria-hidden="true" />
    </Link>
  );
}

export default function PrivacySecurityV2Client() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileAccount | null>(null);
  const [deletionRequest, setDeletionRequest] =
    useState<DeletionRequest | null>(null);
  const [blockedCount, setBlockedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [noticeIsError, setNoticeIsError] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);
  const [signingOutAll, setSigningOutAll] = useState(false);
  const [mfaSupported, setMfaSupported] = useState(true);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaFactorIds, setMfaFactorIds] = useState<string[]>([]);
  const [mfaWorking, setMfaWorking] = useState(false);
  const [mfaEnrollment, setMfaEnrollment] =
    useState<MfaEnrollment | null>(null);
  const [mfaCode, setMfaCode] = useState("");

  function showNotice(message: string, isError = false) {
    setNotice(message);
    setNoticeIsError(isError);
  }

  async function loadMfaState() {
    const mfa = getMfaApi();
    if (!mfa?.listFactors) {
      setMfaSupported(false);
      setMfaEnabled(false);
      setMfaFactorIds([]);
      return;
    }

    const result = await mfa.listFactors();
    if (result.error) {
      setMfaSupported(false);
      setMfaEnabled(false);
      setMfaFactorIds([]);
      return;
    }

    const allFactors = [
      ...(result.data?.all ?? []),
      ...(result.data?.totp ?? []),
    ];
    const verifiedIds = [
      ...new Set(
        allFactors
          .filter((factor) => factor.status === "verified" && factor.id)
          .map((factor) => factor.id as string)
      ),
    ];

    setMfaSupported(true);
    setMfaFactorIds(verifiedIds);
    setMfaEnabled(verifiedIds.length > 0);
  }

  async function loadCenter() {
    setLoading(true);
    setLoadError("");
    setNotice("");

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      if (!userData.user) {
        window.location.replace("/login?next=/privacy-security");
        return;
      }

      const currentUser = userData.user;
      setUser(currentUser);

      const [profileResult, blockResult, deletionResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, username, avatar_url, account_status, is_admin")
          .eq("id", currentUser.id)
          .maybeSingle(),
        supabase
          .from("user_blocks")
          .select("id", { count: "exact", head: true })
          .eq("blocker_id", currentUser.id),
        supabase
          .from("account_deletion_requests")
          .select("id, status, requested_at")
          .eq("user_id", currentUser.id)
          .in("status", ["requested", "reviewing"])
          .order("requested_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (profileResult.error) throw profileResult.error;
      if (blockResult.error) throw blockResult.error;
      if (deletionResult.error) throw deletionResult.error;

      setProfile((profileResult.data ?? null) as ProfileAccount | null);
      setBlockedCount(blockResult.count ?? 0);
      setDeletionRequest(
        (deletionResult.data ?? null) as DeletionRequest | null
      );
      await loadMfaState();
    } catch (error) {
      console.error("Unable to load Privacy & Account Security.", error);
      setLoadError(
        "Privacy and security details could not be loaded. Refresh and try again."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCenter();
  }, []);

  async function resendVerificationEmail() {
    if (!user?.email || resendingVerification) return;

    setResendingVerification(true);
    showNotice("");

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: user.email,
      });

      if (error) {
        showNotice(error.message || "Unable to send verification email.", true);
        return;
      }

      showNotice("Verification email sent. Check your inbox and spam folder.");
    } catch {
      showNotice("Unable to send verification email.", true);
    } finally {
      setResendingVerification(false);
    }
  }

  async function startMfaEnrollment() {
    if (mfaWorking || mfaEnabled) return;

    const mfa = getMfaApi();
    if (!mfa?.enroll || !mfa.challenge) {
      setMfaSupported(false);
      showNotice(
        "Authenticator setup is not available for this authentication configuration.",
        true
      );
      return;
    }

    setMfaWorking(true);
    setMfaEnrollment(null);
    setMfaCode("");
    showNotice("");

    try {
      const enrollment = await mfa.enroll({
        factorType: "totp",
        friendlyName: "Loombus Authenticator",
      });

      if (enrollment.error || !enrollment.data?.id) {
        showNotice(
          enrollment.error?.message || "Unable to start authenticator setup.",
          true
        );
        return;
      }

      const challenge = await mfa.challenge({ factorId: enrollment.data.id });
      if (challenge.error || !challenge.data?.id) {
        if (mfa.unenroll) {
          await mfa.unenroll({ factorId: enrollment.data.id });
        }
        showNotice(
          challenge.error?.message ||
            "Unable to start authenticator verification.",
          true
        );
        return;
      }

      setMfaEnrollment({
        factorId: enrollment.data.id,
        challengeId: challenge.data.id,
        qrCode: enrollment.data.totp?.qr_code ?? "",
        secret: enrollment.data.totp?.secret ?? "",
      });
      showNotice(
        "Scan the QR code with an authenticator app, then enter the six-digit code."
      );
    } catch {
      showNotice("Unable to start authenticator setup.", true);
    } finally {
      setMfaWorking(false);
    }
  }

  async function cancelMfaEnrollment() {
    if (!mfaEnrollment || mfaWorking) return;

    setMfaWorking(true);
    const mfa = getMfaApi();

    try {
      if (mfa?.unenroll) {
        await mfa.unenroll({ factorId: mfaEnrollment.factorId });
      }
    } finally {
      setMfaEnrollment(null);
      setMfaCode("");
      setMfaWorking(false);
      showNotice("Authenticator setup canceled.");
    }
  }

  async function verifyMfaEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mfaEnrollment || mfaWorking) return;

    const cleanCode = mfaCode.trim();
    if (!/^\d{6}$/.test(cleanCode)) {
      showNotice("Enter the six-digit code from your authenticator app.", true);
      return;
    }

    const mfa = getMfaApi();
    if (!mfa?.verify) {
      setMfaSupported(false);
      showNotice("Authenticator verification is not available.", true);
      return;
    }

    setMfaWorking(true);
    showNotice("");

    try {
      const result = await mfa.verify({
        factorId: mfaEnrollment.factorId,
        challengeId: mfaEnrollment.challengeId,
        code: cleanCode,
      });

      if (result.error) {
        showNotice(
          result.error.message || "Unable to verify authenticator code.",
          true
        );
        return;
      }

      setMfaEnrollment(null);
      setMfaCode("");
      await loadMfaState();
      showNotice("Two-factor authentication is now enabled.");
    } catch {
      showNotice("Unable to verify authenticator code.", true);
    } finally {
      setMfaWorking(false);
    }
  }

  async function disableMfa() {
    if (!mfaEnabled || mfaWorking) return;

    const mfa = getMfaApi();
    if (!mfa?.unenroll) {
      setMfaSupported(false);
      showNotice("Authenticator removal is not available.", true);
      return;
    }

    setMfaWorking(true);
    showNotice("");

    try {
      for (const factorId of mfaFactorIds) {
        const result = await mfa.unenroll({ factorId });
        if (result.error) {
          throw new Error(
            result.error.message || "Unable to remove authenticator factor."
          );
        }
      }

      await loadMfaState();
      showNotice("Two-factor authentication is disabled.");
    } catch (error) {
      showNotice(
        error instanceof Error
          ? error.message
          : "Unable to disable two-factor authentication.",
        true
      );
    } finally {
      setMfaWorking(false);
    }
  }

  async function signOutAllSessions() {
    if (signingOutAll) return;

    setSigningOutAll(true);
    showNotice("");

    try {
      const { error } = await supabase.auth.signOut({ scope: "global" });
      if (error) {
        showNotice(error.message || "Unable to sign out all sessions.", true);
        setSigningOutAll(false);
        return;
      }
      window.location.href = "/login";
    } catch {
      showNotice("Unable to sign out all sessions.", true);
      setSigningOutAll(false);
    }
  }

  const providerNames = useMemo(() => getProviderNames(user), [user]);
  const emailVerified = Boolean(user?.email_confirmed_at);
  const hasPasswordProvider = providerNames.includes("Email & password");
  const qrSource = useMemo(
    () => getQrSource(mfaEnrollment?.qrCode ?? ""),
    [mfaEnrollment]
  );

  if (loading) {
    return (
      <main className="privacy-security-v2-page">
        <section className="privacy-security-v2-state">
          <p className="privacy-security-v2-eyebrow">Account protection</p>
          <h1>Checking privacy and security…</h1>
          <p>Loading the account values and controls available to this member.</p>
        </section>
      </main>
    );
  }

  if (loadError || !user) {
    return (
      <main className="privacy-security-v2-page">
        <section className="privacy-security-v2-state">
          <p className="privacy-security-v2-eyebrow">Unable to load</p>
          <h1>Privacy and security are temporarily unavailable.</h1>
          <p>{loadError || "Sign in again to continue."}</p>
          <div className="privacy-security-v2-inline-actions">
            <button
              type="button"
              onClick={() => void loadCenter()}
              className="privacy-security-v2-primary"
            >
              <RefreshCw aria-hidden="true" />
              Retry
            </button>
            <Link href="/settings" className="privacy-security-v2-secondary">
              Open Settings
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="privacy-security-v2-page">
      <div className="privacy-security-v2-shell">
        <nav
          aria-label="Privacy and security breadcrumbs"
          className="privacy-security-v2-breadcrumbs"
        >
          <Link href="/settings">Settings</Link>
          <ChevronRight aria-hidden="true" size={14} />
          <span>Privacy & Account Security</span>
        </nav>

        <header className="privacy-security-v2-hero">
          <div>
            <p className="privacy-security-v2-eyebrow">Account protection</p>
            <h1>Privacy & Account Security</h1>
            <p>
              Review real account values, current platform privacy boundaries,
              two-factor authentication, blocked-member controls, session
              access, and the existing account-action paths. This center does
              not fabricate devices, locations, sign-ins, or protection scores.
            </p>
          </div>
          <div className="privacy-security-v2-hero-actions">
            <Link href="/settings" className="privacy-security-v2-primary">
              <KeyRound aria-hidden="true" size={16} />
              Account Settings
            </Link>
            <Link href="/support" className="privacy-security-v2-secondary">
              <LifeBuoy aria-hidden="true" size={16} />
              Get support
            </Link>
          </div>
        </header>

        <section
          className="privacy-security-v2-metrics"
          aria-label="Account security overview"
        >
          <article className="privacy-security-v2-metric">
            <span>Email</span>
            <strong>{emailVerified ? "Verified" : "Not verified"}</strong>
          </article>
          <article className="privacy-security-v2-metric">
            <span>Sign-in methods</span>
            <strong>{providerNames.length}</strong>
          </article>
          <article className="privacy-security-v2-metric">
            <span>Two-factor</span>
            <strong>
              {mfaSupported ? (mfaEnabled ? "Enabled" : "Disabled") : "Unavailable"}
            </strong>
          </article>
          <article className="privacy-security-v2-metric">
            <span>Blocked members</span>
            <strong>{blockedCount}</strong>
          </article>
        </section>

        {notice && (
          <div
            className={`privacy-security-v2-notice${
              noticeIsError ? " is-error" : ""
            }`}
            role="status"
          >
            {notice}
          </div>
        )}

        <div className="privacy-security-v2-layout">
          <section className="privacy-security-v2-main">
            <article className="privacy-security-v2-card">
              <header className="privacy-security-v2-card-header">
                <div className="privacy-security-v2-card-header-copy">
                  <span className="privacy-security-v2-icon">
                    <UserRound aria-hidden="true" />
                  </span>
                  <div>
                    <h2>Account identity and sign-in</h2>
                    <p>
                      These values come from the current authenticated account
                      and profile record.
                    </p>
                  </div>
                </div>
                <span
                  className={`privacy-security-v2-badge${
                    emailVerified ? " is-good" : ""
                  }`}
                >
                  {emailVerified ? (
                    <CheckCircle2 aria-hidden="true" size={14} />
                  ) : (
                    <Mail aria-hidden="true" size={14} />
                  )}
                  {emailVerified ? "Email verified" : "Verification needed"}
                </span>
              </header>

              <div className="privacy-security-v2-summary-grid">
                <div className="privacy-security-v2-summary-item">
                  <span>Account email</span>
                  <strong>{user.email || "Unavailable"}</strong>
                </div>
                <div className="privacy-security-v2-summary-item">
                  <span>Sign-in methods</span>
                  <strong>{providerNames.join(", ") || "Unavailable"}</strong>
                </div>
                <div className="privacy-security-v2-summary-item">
                  <span>Account status</span>
                  <strong>{formatAccountStatus(profile?.account_status)}</strong>
                </div>
                <div className="privacy-security-v2-summary-item">
                  <span>Member identity</span>
                  <strong>
                    {profile?.username
                      ? `@${profile.username}`
                      : profile?.full_name || "Profile incomplete"}
                  </strong>
                </div>
                <div className="privacy-security-v2-summary-item">
                  <span>Account created</span>
                  <strong>{formatDateTime(user.created_at)}</strong>
                </div>
                <div className="privacy-security-v2-summary-item">
                  <span>Last sign-in</span>
                  <strong>{formatDateTime(user.last_sign_in_at)}</strong>
                </div>
              </div>

              <div className="privacy-security-v2-inline-actions">
                <Link
                  href="/settings#security"
                  className="privacy-security-v2-primary"
                >
                  <KeyRound aria-hidden="true" size={16} />
                  {hasPasswordProvider
                    ? "Manage password"
                    : "Review sign-in method"}
                </Link>
                <Link href="/profile" className="privacy-security-v2-secondary">
                  <UserRound aria-hidden="true" size={16} />
                  Edit profile
                </Link>
                {!emailVerified && user.email && (
                  <button
                    type="button"
                    onClick={() => void resendVerificationEmail()}
                    disabled={resendingVerification}
                    className="privacy-security-v2-secondary"
                  >
                    <Mail aria-hidden="true" size={16} />
                    {resendingVerification
                      ? "Sending…"
                      : "Resend verification"}
                  </button>
                )}
              </div>
            </article>

            <article className="privacy-security-v2-card">
              <header className="privacy-security-v2-card-header">
                <div className="privacy-security-v2-card-header-copy">
                  <span className="privacy-security-v2-icon">
                    <ShieldCheck aria-hidden="true" />
                  </span>
                  <div>
                    <h2>Two-factor authentication</h2>
                    <p>
                      Add a time-based authenticator code to the existing
                      Supabase account when this auth configuration supports it.
                    </p>
                  </div>
                </div>
                <span
                  className={`privacy-security-v2-badge${
                    mfaEnabled ? " is-good" : ""
                  }`}
                >
                  <Shield aria-hidden="true" size={14} />
                  {mfaSupported
                    ? mfaEnabled
                      ? "Enabled"
                      : "Available"
                    : "Unavailable"}
                </span>
              </header>

              <div className="privacy-security-v2-mfa-state">
                <p className="privacy-security-v2-copy">
                  {mfaSupported
                    ? mfaEnabled
                      ? "A verified authenticator factor is attached to this account."
                      : "No verified authenticator factor is attached to this account."
                    : "The current authentication configuration did not expose authenticator management."}
                </p>

                {!mfaEnabled && !mfaEnrollment && mfaSupported && (
                  <div className="privacy-security-v2-inline-actions">
                    <button
                      type="button"
                      onClick={() => void startMfaEnrollment()}
                      disabled={mfaWorking}
                      className="privacy-security-v2-primary"
                    >
                      <ShieldCheck aria-hidden="true" size={16} />
                      {mfaWorking ? "Starting…" : "Set up authenticator"}
                    </button>
                  </div>
                )}

                {mfaEnabled && (
                  <div className="privacy-security-v2-inline-actions">
                    <button
                      type="button"
                      onClick={() => void disableMfa()}
                      disabled={mfaWorking}
                      className="privacy-security-v2-danger-action"
                    >
                      <Shield aria-hidden="true" size={16} />
                      {mfaWorking ? "Removing…" : "Disable two-factor"}
                    </button>
                  </div>
                )}

                {mfaEnrollment && (
                  <form
                    onSubmit={verifyMfaEnrollment}
                    className="privacy-security-v2-mfa-setup"
                  >
                    <h3>Finish authenticator setup</h3>
                    <p className="privacy-security-v2-copy">
                      Scan the code or enter the secret manually. Then submit the
                      current six-digit code from the authenticator app.
                    </p>
                    {qrSource && (
                      <img src={qrSource} alt="Loombus authenticator QR code" />
                    )}
                    {mfaEnrollment.secret && (
                      <div className="privacy-security-v2-secret">
                        {mfaEnrollment.secret}
                      </div>
                    )}
                    <label className="privacy-security-v2-field">
                      Six-digit authenticator code
                      <input
                        value={mfaCode}
                        onChange={(event) => setMfaCode(event.target.value)}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        className="privacy-security-v2-input"
                        placeholder="000000"
                      />
                    </label>
                    <div className="privacy-security-v2-inline-actions">
                      <button
                        type="submit"
                        disabled={mfaWorking || !/^\d{6}$/.test(mfaCode.trim())}
                        className="privacy-security-v2-primary"
                      >
                        Verify and enable
                      </button>
                      <button
                        type="button"
                        onClick={() => void cancelMfaEnrollment()}
                        disabled={mfaWorking}
                        className="privacy-security-v2-secondary"
                      >
                        Cancel setup
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </article>

            <article className="privacy-security-v2-card">
              <header className="privacy-security-v2-card-header">
                <div className="privacy-security-v2-card-header-copy">
                  <span className="privacy-security-v2-icon">
                    <Eye aria-hidden="true" />
                  </span>
                  <div>
                    <h2>Current privacy boundaries</h2>
                    <p>
                      These are current enforced platform behaviors, not display-only
                      preference switches.
                    </p>
                  </div>
                </div>
                <span className="privacy-security-v2-badge">
                  <LockKeyhole aria-hidden="true" size={14} />
                  Existing rules
                </span>
              </header>

              <div className="privacy-security-v2-boundary-grid">
                <section className="privacy-security-v2-boundary">
                  <span>Member profile access</span>
                  <strong>Signed-in members</strong>
                  <p>
                    Member profiles and Signal history require a Loombus account
                    session.
                  </p>
                </section>
                <section className="privacy-security-v2-boundary">
                  <span>New direct messages</span>
                  <strong>Mutual connections</strong>
                  <p>
                    A new private conversation requires both members to follow one
                    another and pass account-safety checks.
                  </p>
                </section>
                <section className="privacy-security-v2-boundary">
                  <span>Reading History</span>
                  <strong>Private per member</strong>
                  <p>
                    History is scoped to the signed-in viewer and can be removed from
                    the Reading History hub.
                  </p>
                </section>
                <section className="privacy-security-v2-boundary">
                  <span>Saved and Signal Board</span>
                  <strong>Private workspace</strong>
                  <p>
                    Saved notes, folders, and Signal Board organization remain tied to
                    the member account.
                  </p>
                </section>
              </div>

              <div className="privacy-security-v2-link-grid" style={{ marginTop: "0.8rem" }}>
                <ResourceLink
                  href="/blocked-users"
                  title={`Blocked members (${blockedCount})`}
                  description="Review and unblock members using the existing block API."
                  Icon={UserRoundX}
                />
                <ResourceLink
                  href="/settings#signal"
                  title="Signal delivery"
                  description="Manage in-app, push, and supported email notification preferences."
                  Icon={Bell}
                />
                <ResourceLink
                  href="/reading-history"
                  title="Reading History"
                  description="Review or clear private discussion-view history."
                  Icon={Clock3}
                />
                <ResourceLink
                  href="/profile"
                  title="Public identity"
                  description="Control the profile fields visible to other members."
                  Icon={Users}
                />
              </div>
            </article>

            <article className="privacy-security-v2-card">
              <header className="privacy-security-v2-card-header">
                <div className="privacy-security-v2-card-header-copy">
                  <span className="privacy-security-v2-icon">
                    <Database aria-hidden="true" />
                  </span>
                  <div>
                    <h2>Data and account controls</h2>
                    <p>
                      Use the existing reviewed account workflows rather than a
                      separate destructive-action implementation.
                    </p>
                  </div>
                </div>
                <span className="privacy-security-v2-badge">
                  <FileText aria-hidden="true" size={14} />
                  Account record
                </span>
              </header>

              <div className="privacy-security-v2-summary-grid">
                <div className="privacy-security-v2-summary-item">
                  <span>Current account status</span>
                  <strong>{formatAccountStatus(profile?.account_status)}</strong>
                </div>
                <div className="privacy-security-v2-summary-item">
                  <span>Open deletion request</span>
                  <strong>
                    {deletionRequest
                      ? formatDeletionStatus(deletionRequest.status)
                      : "None"}
                  </strong>
                </div>
              </div>

              {deletionRequest && (
                <div className="privacy-security-v2-notice">
                  Request opened {formatDateTime(deletionRequest.requested_at)}.
                  Account Settings contains the authoritative request state and
                  prevents duplicate requests.
                </div>
              )}

              {profile?.is_admin && (
                <div className="privacy-security-v2-notice">
                  Admin accounts retain the existing restriction on deactivation
                  and deletion requests while required for platform operations.
                </div>
              )}

              <div className="privacy-security-v2-link-grid" style={{ marginTop: "0.8rem" }}>
                <ResourceLink
                  href="/settings#account-controls"
                  title="Account controls"
                  description="Deactivate the account or submit a reviewed deletion request."
                  Icon={Trash2}
                />
                <ResourceLink
                  href="/privacy"
                  title="Privacy Policy"
                  description="Review how Loombus handles account and platform information."
                  Icon={FileText}
                />
                <ResourceLink
                  href="/support"
                  title="Data or privacy help"
                  description="Submit a structured request to the existing Admin support queue."
                  Icon={LifeBuoy}
                />
                <ResourceLink
                  href="/safety"
                  title="Safety and reporting"
                  description="Review reporting, blocking, and enforcement guidance."
                  Icon={ShieldCheck}
                />
              </div>
            </article>
          </section>

          <aside className="privacy-security-v2-aside">
            <article className="privacy-security-v2-card">
              <header className="privacy-security-v2-card-header">
                <div className="privacy-security-v2-card-header-copy">
                  <span className="privacy-security-v2-icon">
                    <Laptop aria-hidden="true" />
                  </span>
                  <div>
                    <h2>Current session</h2>
                    <p>Verified values available from this authenticated account.</p>
                  </div>
                </div>
              </header>

              <div className="privacy-security-v2-session-list">
                <div className="privacy-security-v2-session-row">
                  <Smartphone aria-hidden="true" />
                  <div>
                    <strong>Current authenticated session</strong>
                    <span>{user.email || "Account email unavailable"}</span>
                  </div>
                </div>
                <div className="privacy-security-v2-session-row">
                  <Clock3 aria-hidden="true" />
                  <div>
                    <strong>Last account sign-in</strong>
                    <span>{formatDateTime(user.last_sign_in_at)}</span>
                  </div>
                </div>
              </div>

              <p className="privacy-security-v2-copy">
                Loombus does not currently expose a verified device-by-device session
                list, IP history, or location history on this page.
              </p>

              {!signOutConfirmOpen ? (
                <div className="privacy-security-v2-inline-actions">
                  <button
                    type="button"
                    onClick={() => setSignOutConfirmOpen(true)}
                    className="privacy-security-v2-danger-action"
                  >
                    <LogOut aria-hidden="true" size={16} />
                    Sign out all sessions
                  </button>
                </div>
              ) : (
                <div className="privacy-security-v2-confirmation">
                  <p>
                    This revokes the account sessions Supabase can revoke and signs
                    this device out. You will need to authenticate again.
                  </p>
                  <div className="privacy-security-v2-inline-actions">
                    <button
                      type="button"
                      onClick={() => void signOutAllSessions()}
                      disabled={signingOutAll}
                      className="privacy-security-v2-danger-action"
                    >
                      {signingOutAll ? "Signing out…" : "Confirm global sign-out"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSignOutConfirmOpen(false)}
                      disabled={signingOutAll}
                      className="privacy-security-v2-secondary"
                    >
                      Keep sessions
                    </button>
                  </div>
                </div>
              )}
            </article>

            <article className="privacy-security-v2-card">
              <header className="privacy-security-v2-card-header">
                <div className="privacy-security-v2-card-header-copy">
                  <span className="privacy-security-v2-icon">
                    <Shield aria-hidden="true" />
                  </span>
                  <div>
                    <h2>Security scope</h2>
                    <p>What this page does and does not claim.</p>
                  </div>
                </div>
              </header>
              <div className="privacy-security-v2-session-list">
                <div className="privacy-security-v2-session-row">
                  <CheckCircle2 aria-hidden="true" />
                  <div>
                    <strong>Real values only</strong>
                    <span>Email, providers, MFA factors, account status, block count, and request state.</span>
                  </div>
                </div>
                <div className="privacy-security-v2-session-row">
                  <LockKeyhole aria-hidden="true" />
                  <div>
                    <strong>No fabricated score</strong>
                    <span>No invented protection percentage, risk level, devices, or sign-in events.</span>
                  </div>
                </div>
                <div className="privacy-security-v2-session-row">
                  <MessageCircle aria-hidden="true" />
                  <div>
                    <strong>Existing enforcement</strong>
                    <span>Messaging, blocking, session, and account-status rules remain on their current APIs.</span>
                  </div>
                </div>
              </div>
            </article>

            <article className="privacy-security-v2-card">
              <header className="privacy-security-v2-card-header">
                <div className="privacy-security-v2-card-header-copy">
                  <span className="privacy-security-v2-icon">
                    <LifeBuoy aria-hidden="true" />
                  </span>
                  <div>
                    <h2>Help and policy</h2>
                    <p>Open the canonical support and policy surfaces.</p>
                  </div>
                </div>
              </header>
              <div className="privacy-security-v2-link-grid" style={{ gridTemplateColumns: "1fr" }}>
                <ResourceLink
                  href="/support"
                  title="Help & Support Center"
                  description="Submit account, privacy, safety, accessibility, or bug requests."
                  Icon={ArrowRight}
                />
                <ResourceLink
                  href="/guidelines"
                  title="Community Guidelines"
                  description="Review platform behavior and discussion expectations."
                  Icon={ExternalLink}
                />
                <ResourceLink
                  href="/terms"
                  title="Terms of Service"
                  description="Review the terms governing account and platform use."
                  Icon={ExternalLink}
                />
              </div>
            </article>
          </aside>
        </div>
      </div>
    </main>
  );
}