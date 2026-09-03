"use client";

import { createPortal } from "react-dom";
import Link from "next/link";
import {
  Accessibility,
  BellRing,
  Captions,
  Download,
  Eye,
  Globe2,
  Languages,
  Link2,
  LockKeyhole,
  Mail,
  MapPin,
  MessageCircleMore,
  MonitorSmartphone,
  Palette,
  PhoneCall,
  Radio,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserRoundCog,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  DEFAULT_MEMBER_SETTINGS,
  type MemberSettings,
} from "@/lib/member-settings";

type Identity = {
  id: string;
  provider: string;
  createdAt: string | null;
  lastSignInAt: string | null;
  email: string | null;
};

type AccountPayload = {
  email: string | null;
  phone: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  identities: Identity[];
};

type ProfilePayload = {
  full_name?: string | null;
  username?: string | null;
  identity_verification_status?: string | null;
  identity_verification_provider?: string | null;
  identity_verified_at?: string | null;
  legal_name_verified?: boolean | null;
} | null;

type SettingsPayload = {
  preferences?: Partial<MemberSettings>;
  account?: AccountPayload;
  profile?: ProfilePayload;
  updatedAt?: string | null;
  error?: string;
};

type TotpEnrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
};

const TARGET_IDS = [
  "account-security",
  "profile",
  "privacy-safety",
  "messages",
  "notifications-alerts",
  "appearance",
  "plan",
  "data-activity",
] as const;

type TargetId = (typeof TARGET_IDS)[number];

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

function Toggle({
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
  onChange: (next: boolean) => void;
}) {
  return (
    <label className={`settings-expansion-toggle${disabled ? " is-disabled" : ""}`}>
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
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

function SelectRow({
  label,
  description,
  value,
  disabled = false,
  onChange,
  children,
}: {
  label: string;
  description: string;
  value: string | number;
  disabled?: boolean;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="settings-expansion-select-row">
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="settings-v2-select"
      >
        {children}
      </select>
    </label>
  );
}

function Panel({
  icon: Icon,
  eyebrow,
  title,
  description,
  children,
}: {
  icon: typeof Eye;
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="settings-expansion-panel">
      <div className="settings-expansion-panel-heading">
        <span className="settings-expansion-panel-icon"><Icon aria-hidden="true" /></span>
        <div>
          <p>{eyebrow}</p>
          <h3>{title}</h3>
          <span>{description}</span>
        </div>
      </div>
      {children}
    </section>
  );
}

function formatProvider(provider: string) {
  if (provider === "email") return "Email & password";
  if (provider === "google") return "Google";
  if (provider === "apple") return "Apple";
  if (provider === "phone") return "Phone";
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unavailable" : date.toLocaleString();
}

export function SettingsEditorialExpansion() {
  const [targets, setTargets] = useState<Partial<Record<TargetId, HTMLElement>>>({});
  const [settings, setSettings] = useState<MemberSettings>(DEFAULT_MEMBER_SETTINGS);
  const [account, setAccount] = useState<AccountPayload>({
    email: null,
    phone: null,
    createdAt: null,
    lastSignInAt: null,
    identities: [],
  });
  const [profile, setProfile] = useState<ProfilePayload>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [emailWorking, setEmailWorking] = useState(false);
  const [mfaFactors, setMfaFactors] = useState<Array<{ id: string; friendly_name?: string | null; status?: string }>>([]);
  const [totpEnrollment, setTotpEnrollment] = useState<TotpEnrollment | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [mfaWorking, setMfaWorking] = useState(false);
  const [sessionWorking, setSessionWorking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    let timer: number | null = null;

    function locate() {
      const found: Partial<Record<TargetId, HTMLElement>> = {};
      for (const id of TARGET_IDS) {
        const node = document.getElementById(id);
        if (node) found[id] = node;
      }
      if (!cancelled) setTargets(found);
      attempts += 1;
      if (!cancelled && Object.keys(found).length < TARGET_IDS.length && attempts < 80) {
        timer = window.setTimeout(locate, 100);
      }
    }

    locate();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      const token = await getToken();
      if (!token) {
        window.location.href = "/login?next=/settings";
        return;
      }

      const [response, factorsResult] = await Promise.all([
        fetch("/api/settings/member-preferences", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }),
        supabase.auth.mfa.listFactors(),
      ]);
      const payload = (await response.json().catch(() => ({}))) as SettingsPayload;
      if (!alive) return;

      if (response.ok) {
        setSettings({ ...DEFAULT_MEMBER_SETTINGS, ...(payload.preferences ?? {}) });
        if (payload.account) setAccount(payload.account);
        setProfile(payload.profile ?? null);
        setNewEmail(payload.account?.email ?? "");
      } else {
        setMessage(payload.error ?? "Expanded member settings could not load.");
      }

      if (!factorsResult.error) {
        const verified = factorsResult.data?.totp ?? [];
        setMfaFactors(verified.map((factor) => ({
          id: factor.id,
          friendly_name: factor.friendly_name,
          status: factor.status,
        })));
      }
      setLoading(false);
    }

    void load();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.loombusReduceMotion = String(settings.reduceMotion);
    document.documentElement.dataset.loombusHighContrast = String(settings.highContrast);
    document.documentElement.dataset.loombusUnderlineLinks = String(settings.underlineLinks);
    document.documentElement.dataset.loombusTextScale = settings.textScale;
    window.localStorage.setItem(
      "loombus:member-presentation-preferences",
      JSON.stringify({
        autoplayMedia: settings.autoplayMedia,
        autoplayAnimatedMedia: settings.autoplayAnimatedMedia,
        captionsByDefault: settings.captionsByDefault,
        reduceMotion: settings.reduceMotion,
        highContrast: settings.highContrast,
        underlineLinks: settings.underlineLinks,
        textScale: settings.textScale,
        keyboardShortcuts: settings.keyboardShortcuts,
        defaultFeed: settings.defaultFeed,
        feedDensity: settings.feedDensity,
        rememberDiscussionFilters: settings.rememberDiscussionFilters,
        aiSummariesEnabled: settings.aiSummariesEnabled,
        autoExpandDiscussionState: settings.autoExpandDiscussionState,
      })
    );
    window.dispatchEvent(
      new CustomEvent("loombus:member-settings-changed", { detail: settings })
    );
  }, [settings]);

  async function savePatch<K extends keyof MemberSettings>(key: K, value: MemberSettings[K]) {
    if (savingKey) return;
    const previous = settings;
    const next = { ...settings, [key]: value };
    setSettings(next);
    setSavingKey(String(key));
    setMessage("");

    const token = await getToken();
    if (!token) {
      window.location.href = "/login?next=/settings";
      return;
    }

    const response = await fetch("/api/settings/member-preferences", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ [key]: value }),
    });
    const payload = (await response.json().catch(() => ({}))) as SettingsPayload;

    if (!response.ok) {
      setSettings(previous);
      setMessage(payload.error ?? "This setting could not be saved.");
    } else {
      setSettings({ ...DEFAULT_MEMBER_SETTINGS, ...(payload.preferences ?? next) });
      setMessage("Settings saved.");
    }
    setSavingKey(null);
  }

  async function changeEmail() {
    const email = newEmail.trim().toLowerCase();
    if (!email || email === account.email) return;
    setEmailWorking(true);
    setMessage("");
    const { error } = await supabase.auth.updateUser({ email });
    if (error) {
      setMessage(error.message || "Email address could not be changed.");
    } else {
      setMessage("Confirmation sent. Your email changes after the verification link is completed.");
    }
    setEmailWorking(false);
  }

  async function linkProvider(provider: "google" | "apple") {
    setMessage("");
    const { error } = await supabase.auth.linkIdentity({
      provider,
      options: { redirectTo: window.location.href },
    });
    if (error) setMessage(error.message || `Unable to connect ${formatProvider(provider)}.`);
  }

  async function unlinkProvider(identityId: string) {
    setMessage("");
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      setMessage("Unable to reload account identities.");
      return;
    }
    if ((data.user.identities ?? []).length <= 1) {
      setMessage("Keep at least one sign-in method connected to your account.");
      return;
    }
    const identity = (data.user.identities ?? []).find((item) => item.id === identityId);
    if (!identity) {
      setMessage("That sign-in method is no longer connected.");
      return;
    }
    const result = await supabase.auth.unlinkIdentity(identity);
    if (result.error) {
      setMessage(result.error.message || "Unable to disconnect sign-in method.");
      return;
    }
    setAccount((current) => ({
      ...current,
      identities: current.identities.filter((item) => item.id !== identityId),
    }));
    setMessage("Sign-in method disconnected.");
  }

  async function startTotpEnrollment() {
    setMfaWorking(true);
    setMessage("");
    const result = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Loombus authenticator",
    });
    if (result.error || !result.data?.totp) {
      setMessage(result.error?.message ?? "Authenticator setup could not start.");
      setMfaWorking(false);
      return;
    }
    setTotpEnrollment({
      factorId: result.data.id,
      qrCode: result.data.totp.qr_code,
      secret: result.data.totp.secret,
    });
    setMfaWorking(false);
  }

  async function verifyTotpEnrollment() {
    if (!totpEnrollment || !/^\d{6}$/.test(totpCode.trim())) {
      setMessage("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setMfaWorking(true);
    setMessage("");
    const challenge = await supabase.auth.mfa.challenge({ factorId: totpEnrollment.factorId });
    if (challenge.error || !challenge.data) {
      setMessage(challenge.error?.message ?? "Authenticator challenge failed.");
      setMfaWorking(false);
      return;
    }
    const verified = await supabase.auth.mfa.verify({
      factorId: totpEnrollment.factorId,
      challengeId: challenge.data.id,
      code: totpCode.trim(),
    });
    if (verified.error) {
      setMessage(verified.error.message || "Authenticator code could not be verified.");
      setMfaWorking(false);
      return;
    }
    setMfaFactors((current) => [
      ...current.filter((factor) => factor.id !== totpEnrollment.factorId),
      { id: totpEnrollment.factorId, friendly_name: "Loombus authenticator", status: "verified" },
    ]);
    setTotpEnrollment(null);
    setTotpCode("");
    setMessage("Two-factor authentication enabled.");
    setMfaWorking(false);
  }

  async function removeTotpFactor(factorId: string) {
    setMfaWorking(true);
    setMessage("");
    const result = await supabase.auth.mfa.unenroll({ factorId });
    if (result.error) {
      setMessage(result.error.message || "Authenticator factor could not be removed.");
    } else {
      setMfaFactors((current) => current.filter((factor) => factor.id !== factorId));
      setMessage("Authenticator factor removed.");
    }
    setMfaWorking(false);
  }

  async function signOutOtherSessions() {
    setSessionWorking(true);
    setMessage("");
    const result = await supabase.auth.signOut({ scope: "others" });
    if (result.error) {
      setMessage(result.error.message || "Other sessions could not be signed out.");
    } else {
      setMessage("Other active Loombus sessions were signed out.");
    }
    setSessionWorking(false);
  }

  const connectedProviders = useMemo(
    () => new Set(account.identities.map((identity) => identity.provider)),
    [account.identities]
  );

  const accountPortal = targets["account-security"]
    ? createPortal(
        <div className="settings-expansion-stack">
          {message ? <div className="settings-v2-notice" role="status">{message}</div> : null}

          <Panel
            icon={UserRoundCog}
            eyebrow="Account details"
            title="Private account information"
            description="Manage private account metadata without changing your public Loombus identity."
          >
            <div className="settings-expansion-grid two">
              <label className="settings-v2-field">
                Birthday
                <input
                  type="date"
                  value={settings.birthDate}
                  disabled={loading || Boolean(savingKey)}
                  onChange={(event) => void savePatch("birthDate", event.target.value)}
                  className="settings-v2-input"
                />
                <small>Private account metadata. Required age-safety gates remain authoritative.</small>
              </label>
              <label className="settings-v2-field">
                Country / region
                <input
                  value={settings.country}
                  disabled={loading || Boolean(savingKey)}
                  onBlur={(event) => void savePatch("country", event.currentTarget.value)}
                  onChange={(event) => setSettings((current) => ({ ...current, country: event.target.value }))}
                  className="settings-v2-input"
                  placeholder="US"
                  maxLength={64}
                />
              </label>
              <label className="settings-v2-field">
                Time zone
                <input
                  value={settings.timezone}
                  disabled={loading || Boolean(savingKey)}
                  onBlur={(event) => void savePatch("timezone", event.currentTarget.value)}
                  onChange={(event) => setSettings((current) => ({ ...current, timezone: event.target.value }))}
                  className="settings-v2-input"
                  placeholder={Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York"}
                  maxLength={80}
                />
              </label>
              <div className="settings-expansion-summary-card">
                <span>Account created</span>
                <strong>{formatDate(account.createdAt)}</strong>
                <small>Last sign-in: {formatDate(account.lastSignInAt)}</small>
              </div>
            </div>
          </Panel>

          <Panel
            icon={Mail}
            eyebrow="Email"
            title="Change account email"
            description="Supabase sends a verification link before the account address changes."
          >
            <div className="settings-expansion-inline-form">
              <input
                type="email"
                value={newEmail}
                disabled={emailWorking}
                onChange={(event) => setNewEmail(event.target.value)}
                className="settings-v2-input"
                autoComplete="email"
              />
              <button
                type="button"
                className="settings-v2-secondary-action"
                disabled={emailWorking || !newEmail.trim() || newEmail.trim().toLowerCase() === (account.email ?? "").toLowerCase()}
                onClick={() => void changeEmail()}
              >
                {emailWorking ? "Sending…" : "Change email"}
              </button>
            </div>
          </Panel>

          <Panel
            icon={Link2}
            eyebrow="Connected accounts"
            title="Sign-in methods"
            description="Connect Google or Apple so you are not dependent on only one authentication method."
          >
            <div className="settings-expansion-identity-list">
              {account.identities.map((identity) => (
                <article key={identity.id}>
                  <div>
                    <strong>{formatProvider(identity.provider)}</strong>
                    <span>{identity.email ?? "Connected identity"}</span>
                  </div>
                  <button
                    type="button"
                    className="settings-v2-quiet-button"
                    disabled={account.identities.length <= 1}
                    onClick={() => void unlinkProvider(identity.id)}
                  >
                    Disconnect
                  </button>
                </article>
              ))}
            </div>
            <div className="settings-v2-inline-actions" style={{ marginTop: "0.8rem" }}>
              {!connectedProviders.has("google") ? (
                <button type="button" className="settings-v2-secondary-action" onClick={() => void linkProvider("google")}>Connect Google</button>
              ) : null}
              {!connectedProviders.has("apple") ? (
                <button type="button" className="settings-v2-secondary-action" onClick={() => void linkProvider("apple")}>Connect Apple</button>
              ) : null}
            </div>
          </Panel>

          <Panel
            icon={ShieldCheck}
            eyebrow="Two-factor authentication"
            title="Authenticator protection"
            description="Use a TOTP authenticator app as a second factor for supported Loombus sign-ins."
          >
            {mfaFactors.length ? (
              <div className="settings-expansion-identity-list">
                {mfaFactors.map((factor) => (
                  <article key={factor.id}>
                    <div>
                      <strong>{factor.friendly_name || "Authenticator app"}</strong>
                      <span>{factor.status || "verified"}</span>
                    </div>
                    <button
                      type="button"
                      className="settings-v2-quiet-button"
                      disabled={mfaWorking}
                      onClick={() => void removeTotpFactor(factor.id)}
                    >
                      Remove
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <div className="settings-v2-section-note">No authenticator factor is enrolled.</div>
            )}

            {!totpEnrollment ? (
              <button
                type="button"
                className="settings-v2-secondary-action"
                style={{ marginTop: "0.8rem" }}
                disabled={mfaWorking}
                onClick={() => void startTotpEnrollment()}
              >
                {mfaWorking ? "Starting…" : "Set up authenticator"}
              </button>
            ) : (
              <div className="settings-expansion-totp">
                {/* Supabase returns the QR code as a data URI or URL for the enrolled secret. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={totpEnrollment.qrCode} alt="Authenticator QR code" />
                <div>
                  <strong>Scan the QR code</strong>
                  <span>Or enter this secret manually: <code>{totpEnrollment.secret}</code></span>
                  <div className="settings-expansion-inline-form">
                    <input
                      value={totpCode}
                      onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="6-digit code"
                      className="settings-v2-input"
                    />
                    <button type="button" className="settings-v2-primary-action" disabled={mfaWorking} onClick={() => void verifyTotpEnrollment()}>
                      {mfaWorking ? "Verifying…" : "Verify & enable"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </Panel>

          <Panel
            icon={MonitorSmartphone}
            eyebrow="Sessions"
            title="Device and session security"
            description="Keep the current session and invalidate other active Loombus sessions."
          >
            <div className="settings-expansion-summary-card">
              <span>Current browser/device</span>
              <strong>{typeof navigator !== "undefined" ? navigator.userAgent : "Current device"}</strong>
              <small>Loombus does not expose raw session tokens in Settings.</small>
            </div>
            <button
              type="button"
              className="settings-v2-secondary-action"
              style={{ marginTop: "0.8rem" }}
              disabled={sessionWorking}
              onClick={() => void signOutOtherSessions()}
            >
              {sessionWorking ? "Signing out…" : "Sign out other sessions"}
            </button>
          </Panel>
        </div>,
        targets["account-security"]!
      )
    : null;

  const profilePortal = targets.profile
    ? createPortal(
        <div className="settings-expansion-stack">
          <Panel
            icon={ShieldCheck}
            eyebrow="Identity verification"
            title="Verification status"
            description="Your legal-name verification remains private; only supported verification indicators are public."
          >
            <div className="settings-expansion-grid two">
              <div className="settings-expansion-summary-card">
                <span>Status</span>
                <strong>{profile?.identity_verification_status || "unverified"}</strong>
                <small>Provider: {profile?.identity_verification_provider || "Not set"}</small>
              </div>
              <div className="settings-expansion-summary-card">
                <span>Legal name verified</span>
                <strong>{profile?.legal_name_verified ? "Yes" : "No"}</strong>
                <small>{profile?.identity_verified_at ? `Verified ${formatDate(profile.identity_verified_at)}` : "No verification date"}</small>
              </div>
            </div>
            <div className="settings-v2-inline-actions" style={{ marginTop: "0.8rem" }}>
              <Link href="/verification" className="settings-v2-secondary-action">Manage verification</Link>
              <Link href="/profile" className="settings-v2-secondary-action">Edit public profile</Link>
            </div>
          </Panel>
        </div>,
        targets.profile
      )
    : null;

  const privacyPortal = targets["privacy-safety"]
    ? createPortal(
        <div className="settings-expansion-stack">
          <Panel
            icon={Eye}
            eyebrow="Discoverability"
            title="Control how people can find and see you"
            description="These controls are private member preferences; existing private-account and Loombus-search controls above remain authoritative."
          >
            <div className="settings-expansion-toggle-list">
              <Toggle label="Allow external search indexing" description="Permit supported public profile pages to be indexed by external search engines." checked={settings.externalSearchIndexing} disabled={loading || Boolean(savingKey)} onChange={(value) => void savePatch("externalSearchIndexing", value)} />
              <Toggle label="Recommend my profile" description="Allow Loombus to recommend your profile to other members when relevant." checked={settings.profileRecommendations} disabled={loading || Boolean(savingKey)} onChange={(value) => void savePatch("profileRecommendations", value)} />
              <Toggle label="Show follower count" description="Allow your public profile to display follower totals when that surface supports it." checked={settings.showFollowerCount} disabled={loading || Boolean(savingKey)} onChange={(value) => void savePatch("showFollowerCount", value)} />
              <Toggle label="Show online status" description="Allow supported Loombus surfaces to show that you are currently active." checked={settings.showOnlineStatus} disabled={loading || Boolean(savingKey)} onChange={(value) => void savePatch("showOnlineStatus", value)} />
              <Toggle label="Show last active" description="Allow supported messaging/member surfaces to show recent activity time." checked={settings.showLastActive} disabled={loading || Boolean(savingKey)} onChange={(value) => void savePatch("showLastActive", value)} />
            </div>
          </Panel>

          <Panel
            icon={UsersRound}
            eyebrow="Interaction permissions"
            title="Choose who can reach you"
            description="Set default permission boundaries for follows, mentions, Rooms, and private messages."
          >
            <div className="settings-expansion-select-list">
              <SelectRow label="Who can follow me" description="Choose whether follows are open, verified-only, approval-based, or disabled." value={settings.followPermission} onChange={(value) => void savePatch("followPermission", value as MemberSettings["followPermission"])}>
                <option value="everyone">Everyone</option>
                <option value="verified">Verified members</option>
                <option value="approval">Require approval</option>
                <option value="nobody">Nobody</option>
              </SelectRow>
              <SelectRow label="Who can mention me" description="Control @mentions and supported identity mentions." value={settings.mentionPermission} onChange={(value) => void savePatch("mentionPermission", value as MemberSettings["mentionPermission"])}>
                <option value="everyone">Everyone</option>
                <option value="followers">People I follow / followers</option>
                <option value="nobody">Nobody</option>
              </SelectRow>
              <SelectRow label="Who can invite me to Rooms" description="Default invitation boundary for Rooms and community spaces." value={settings.roomInvitePermission} onChange={(value) => void savePatch("roomInvitePermission", value as MemberSettings["roomInvitePermission"])}>
                <option value="everyone">Everyone</option>
                <option value="followers">People connected to me</option>
                <option value="nobody">Nobody</option>
              </SelectRow>
              <SelectRow label="Who can message me" description="Default private-message permission. Marketplace and safety exceptions remain separately enforced." value={settings.messagePermission} onChange={(value) => void savePatch("messagePermission", value as MemberSettings["messagePermission"])}>
                <option value="mutual">Mutual connections</option>
                <option value="followers">People who follow me</option>
                <option value="verified">Verified members</option>
                <option value="nobody">Nobody</option>
              </SelectRow>
            </div>
          </Panel>

          <Panel
            icon={MapPin}
            eyebrow="Location"
            title="Location customization"
            description="Keep precise device location opt-in and use a local area when you prefer not to share device coordinates."
          >
            <div className="settings-expansion-select-list">
              <SelectRow label="Location mode" description="Choose approximate IP location, device location when permitted, or no automatic location." value={settings.locationMode} onChange={(value) => void savePatch("locationMode", value as MemberSettings["locationMode"])}>
                <option value="approximate">Approximate (IP)</option>
                <option value="device">Device location</option>
                <option value="off">Off</option>
              </SelectRow>
              <label className="settings-v2-field">
                Default Local area
                <input
                  value={settings.localArea}
                  onChange={(event) => setSettings((current) => ({ ...current, localArea: event.target.value }))}
                  onBlur={(event) => void savePatch("localArea", event.currentTarget.value)}
                  placeholder="Jacksonville, FL"
                  className="settings-v2-input"
                  maxLength={160}
                />
              </label>
            </div>
          </Panel>
        </div>,
        targets["privacy-safety"]!
      )
    : null;

  const messagesPortal = targets.messages
    ? createPortal(
        <div className="settings-expansion-stack">
          <Panel
            icon={MessageCircleMore}
            eyebrow="Message experience"
            title="Conversation privacy and media"
            description="Control supported messaging behavior without changing conversation-specific mute, archive, report, or delete actions."
          >
            <div className="settings-expansion-toggle-list">
              <Toggle label="Read receipts" description="Allow supported conversations to show when you have read a message." checked={settings.readReceipts} disabled={loading || Boolean(savingKey)} onChange={(value) => void savePatch("readReceipts", value)} />
              <Toggle label="Typing indicators" description="Allow supported conversations to show when you are composing a reply." checked={settings.typingIndicators} disabled={loading || Boolean(savingKey)} onChange={(value) => void savePatch("typingIndicators", value)} />
              <Toggle label="Allow message attachments" description="Allow supported private conversations to receive file and media attachments." checked={settings.allowMessageAttachments} disabled={loading || Boolean(savingKey)} onChange={(value) => void savePatch("allowMessageAttachments", value)} />
              <Toggle label="Link previews" description="Create previews for supported links in private conversations." checked={settings.messageLinkPreviews} disabled={loading || Boolean(savingKey)} onChange={(value) => void savePatch("messageLinkPreviews", value)} />
              <Toggle label="Auto-download message media" description="Automatically load message media instead of waiting for an explicit action." checked={settings.autoDownloadMessageMedia} disabled={loading || Boolean(savingKey)} onChange={(value) => void savePatch("autoDownloadMessageMedia", value)} />
            </div>
          </Panel>

          <Panel
            icon={PhoneCall}
            eyebrow="Calls"
            title="Audio and video call defaults"
            description="Set whether supported Loombus calling surfaces may ring this account. Device camera and microphone permissions remain controlled by the operating system."
          >
            <div className="settings-expansion-toggle-list">
              <Toggle label="Incoming audio calls" description="Allow supported Loombus audio calls." checked={settings.incomingAudioCalls} disabled={loading || Boolean(savingKey)} onChange={(value) => void savePatch("incomingAudioCalls", value)} />
              <Toggle label="Incoming video calls" description="Allow supported Loombus video calls." checked={settings.incomingVideoCalls} disabled={loading || Boolean(savingKey)} onChange={(value) => void savePatch("incomingVideoCalls", value)} />
              <Toggle label="Ring on this device" description="Allow supported native/web clients to ring when an incoming call is permitted." checked={settings.ringOnDevice} disabled={loading || Boolean(savingKey)} onChange={(value) => void savePatch("ringOnDevice", value)} />
            </div>
          </Panel>
        </div>,
        targets.messages
      )
    : null;

  const notificationsPortal = targets["notifications-alerts"]
    ? createPortal(
        <div className="settings-expansion-stack">
          <Panel
            icon={BellRing}
            eyebrow="Additional push delivery"
            title="Granular device notifications"
            description="Extend the existing Signal and push preferences with Loombus-specific member events."
          >
            <div className="settings-expansion-toggle-list">
              <Toggle label="Mentions" description="Push when your member identity is mentioned." checked={settings.pushMentions} disabled={loading || Boolean(savingKey)} onChange={(value) => void savePatch("pushMentions", value)} />
              <Toggle label="Message requests" description="Push when a supported new conversation request needs attention." checked={settings.pushMessageRequests} disabled={loading || Boolean(savingKey)} onChange={(value) => void savePatch("pushMessageRequests", value)} />
              <Toggle label="Room invitations" description="Push for supported Room or community invitations." checked={settings.pushRoomInvites} disabled={loading || Boolean(savingKey)} onChange={(value) => void savePatch("pushRoomInvites", value)} />
              <Toggle label="Events" description="Push for selected event reminders and changes." checked={settings.pushEvents} disabled={loading || Boolean(savingKey)} onChange={(value) => void savePatch("pushEvents", value)} />
              <Toggle label="Appointments" description="Push for appointment reminders and schedule changes." checked={settings.pushAppointments} disabled={loading || Boolean(savingKey)} onChange={(value) => void savePatch("pushAppointments", value)} />
              <Toggle label="Security alerts" description="Push important account and security events when supported." checked={settings.pushSecurity} disabled={loading || Boolean(savingKey)} onChange={(value) => void savePatch("pushSecurity", value)} />
              <Toggle label="Library activity" description="Push selected Library publication and reading events when supported." checked={settings.pushLibrary} disabled={loading || Boolean(savingKey)} onChange={(value) => void savePatch("pushLibrary", value)} />
            </div>
          </Panel>

          <Panel
            icon={Mail}
            eyebrow="Email"
            title="Email preferences"
            description="Separate optional member email from account, billing, security, and legally required transactional delivery."
          >
            <div className="settings-expansion-toggle-list">
              <Toggle label="Replies" description="Email selected replies to your discussions." checked={settings.emailReplies} disabled={loading || Boolean(savingKey) || settings.emailOptionalPaused} onChange={(value) => void savePatch("emailReplies", value)} />
              <Toggle label="Mentions" description="Email selected mentions of your member identity." checked={settings.emailMentions} disabled={loading || Boolean(savingKey) || settings.emailOptionalPaused} onChange={(value) => void savePatch("emailMentions", value)} />
              <Toggle label="Message requests" description="Email new supported message requests." checked={settings.emailMessageRequests} disabled={loading || Boolean(savingKey) || settings.emailOptionalPaused} onChange={(value) => void savePatch("emailMessageRequests", value)} />
              <Toggle label="Room invitations" description="Email invitations to supported Rooms and communities." checked={settings.emailRoomInvites} disabled={loading || Boolean(savingKey) || settings.emailOptionalPaused} onChange={(value) => void savePatch("emailRoomInvites", value)} />
              <Toggle label="Events" description="Email selected event reminders and changes." checked={settings.emailEvents} disabled={loading || Boolean(savingKey) || settings.emailOptionalPaused} onChange={(value) => void savePatch("emailEvents", value)} />
              <Toggle label="Appointments" description="Email appointment reminders and schedule changes." checked={settings.emailAppointments} disabled={loading || Boolean(savingKey) || settings.emailOptionalPaused} onChange={(value) => void savePatch("emailAppointments", value)} />
              <Toggle label="Security and verification" description="Keep security and verification notices enabled. Critical transactional email may still be required even if this preference is changed." checked={settings.emailVerificationSecurity} disabled={loading || Boolean(savingKey)} onChange={(value) => void savePatch("emailVerificationSecurity", value)} />
              <Toggle label="Community announcements" description="Email selected Room/community announcements." checked={settings.emailCommunityAnnouncements} disabled={loading || Boolean(savingKey) || settings.emailOptionalPaused} onChange={(value) => void savePatch("emailCommunityAnnouncements", value)} />
              <Toggle label="Loombus product announcements" description="Email important product education and feature announcements." checked={settings.emailProductAnnouncements} disabled={loading || Boolean(savingKey) || settings.emailOptionalPaused} onChange={(value) => void savePatch("emailProductAnnouncements", value)} />
              <Toggle label="Creator activity" description="Email creator/supporter activity when those features apply to your account." checked={settings.emailCreatorActivity} disabled={loading || Boolean(savingKey) || settings.emailOptionalPaused} onChange={(value) => void savePatch("emailCreatorActivity", value)} />
              <Toggle label="Library updates" description="Email selected Library publication and reading updates." checked={settings.emailLibraryUpdates} disabled={loading || Boolean(savingKey) || settings.emailOptionalPaused} onChange={(value) => void savePatch("emailLibraryUpdates", value)} />
              <Toggle label="Pause optional emails" description="Pause optional Loombus email categories while leaving essential transactional delivery available." checked={settings.emailOptionalPaused} disabled={loading || Boolean(savingKey)} onChange={(value) => void savePatch("emailOptionalPaused", value)} />
            </div>
          </Panel>

          <Panel
            icon={Radio}
            eyebrow="Rooms, events & appointments"
            title="Default reminder behavior"
            description="Set defaults that supported Room, event, and appointment surfaces can consume."
          >
            <div className="settings-expansion-select-list">
              <SelectRow label="New Room notification default" description="Default delivery level when you join a new supported Room." value={settings.roomNotificationDefault} onChange={(value) => void savePatch("roomNotificationDefault", value as MemberSettings["roomNotificationDefault"])}>
                <option value="all">All activity</option>
                <option value="important">Important only</option>
                <option value="mentions">Mentions only</option>
                <option value="off">Off</option>
              </SelectRow>
              <SelectRow label="Event reminder" description="Default lead time for selected event reminders." value={settings.eventReminderMinutes} onChange={(value) => void savePatch("eventReminderMinutes", Number(value) as MemberSettings["eventReminderMinutes"])}>
                <option value="10">10 minutes</option>
                <option value="30">30 minutes</option>
                <option value="60">1 hour</option>
                <option value="1440">1 day</option>
              </SelectRow>
              <SelectRow label="Appointment reminder" description="Default lead time for selected appointment reminders." value={settings.appointmentReminderMinutes} onChange={(value) => void savePatch("appointmentReminderMinutes", Number(value) as MemberSettings["appointmentReminderMinutes"])}>
                <option value="10">10 minutes</option>
                <option value="30">30 minutes</option>
                <option value="60">1 hour</option>
                <option value="1440">1 day</option>
              </SelectRow>
            </div>
          </Panel>
        </div>,
        targets["notifications-alerts"]!
      )
    : null;

  const appearancePortal = targets.appearance
    ? createPortal(
        <div className="settings-expansion-stack">
          <Panel
            icon={Accessibility}
            eyebrow="Accessibility"
            title="Reading and motion preferences"
            description="Accessibility preferences are synchronized to your member settings and mirrored locally for immediate presentation."
          >
            <div className="settings-expansion-toggle-list">
              <Toggle label="Reduce motion" description="Reduce non-essential animation and transitions across supported Loombus surfaces." checked={settings.reduceMotion} disabled={loading || Boolean(savingKey)} onChange={(value) => void savePatch("reduceMotion", value)} />
              <Toggle label="High contrast" description="Increase supported surface and control contrast." checked={settings.highContrast} disabled={loading || Boolean(savingKey)} onChange={(value) => void savePatch("highContrast", value)} />
              <Toggle label="Underline links" description="Underline supported text links to make them easier to distinguish." checked={settings.underlineLinks} disabled={loading || Boolean(savingKey)} onChange={(value) => void savePatch("underlineLinks", value)} />
              <Toggle label="Keyboard shortcuts" description="Enable supported Loombus keyboard shortcuts." checked={settings.keyboardShortcuts} disabled={loading || Boolean(savingKey)} onChange={(value) => void savePatch("keyboardShortcuts", value)} />
            </div>
            <SelectRow label="Text size" description="Adjust supported Loombus editorial text sizing." value={settings.textScale} onChange={(value) => void savePatch("textScale", value as MemberSettings["textScale"])}>
              <option value="small">Small</option>
              <option value="standard">Standard</option>
              <option value="large">Large</option>
              <option value="xlarge">Extra large</option>
            </SelectRow>
          </Panel>

          <Panel
            icon={Captions}
            eyebrow="Media"
            title="Media playback defaults"
            description="Choose how supported media behaves before you interact with it."
          >
            <div className="settings-expansion-toggle-list">
              <Toggle label="Autoplay media" description="Allow supported videos and media to autoplay." checked={settings.autoplayMedia} disabled={loading || Boolean(savingKey)} onChange={(value) => void savePatch("autoplayMedia", value)} />
              <Toggle label="Autoplay animated media" description="Allow supported GIF-like and animated media to autoplay." checked={settings.autoplayAnimatedMedia} disabled={loading || Boolean(savingKey)} onChange={(value) => void savePatch("autoplayAnimatedMedia", value)} />
              <Toggle label="Captions by default" description="Prefer captions when supported video captions are available." checked={settings.captionsByDefault} disabled={loading || Boolean(savingKey)} onChange={(value) => void savePatch("captionsByDefault", value)} />
            </div>
          </Panel>

          <Panel
            icon={Languages}
            eyebrow="Language & region"
            title="Language preferences"
            description="Prepare Loombus for multilingual discussion, translation, and region-aware presentation without changing your public identity."
          >
            <div className="settings-expansion-grid two">
              <label className="settings-v2-field">
                Display locale
                <input
                  value={settings.locale}
                  onChange={(event) => setSettings((current) => ({ ...current, locale: event.target.value }))}
                  onBlur={(event) => void savePatch("locale", event.currentTarget.value)}
                  className="settings-v2-input"
                  placeholder="en-US"
                  maxLength={24}
                />
              </label>
              <label className="settings-v2-field">
                Content languages
                <input
                  value={settings.contentLanguages.join(", ")}
                  onChange={(event) => setSettings((current) => ({ ...current, contentLanguages: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) }))}
                  onBlur={(event) => void savePatch("contentLanguages", event.currentTarget.value.split(",").map((value) => value.trim()).filter(Boolean))}
                  className="settings-v2-input"
                  placeholder="en, fr, ht"
                />
              </label>
            </div>
            <div className="settings-expansion-toggle-list" style={{ marginTop: "0.7rem" }}>
              <Toggle label="Automatically translate supported discussions" description="Allow supported Loombus translation features to translate content outside your preferred languages." checked={settings.autoTranslate} disabled={loading || Boolean(savingKey)} onChange={(value) => void savePatch("autoTranslate", value)} />
            </div>
          </Panel>
        </div>,
        targets.appearance
      )
    : null;

  const planPortal = targets.plan
    ? createPortal(
        <div className="settings-expansion-stack">
          <Panel
            icon={Sparkles}
            eyebrow="Creator & earnings"
            title="Creator delivery preferences"
            description="These controls appear for every member but only affect creator/supporter features when your account uses them."
          >
            <div className="settings-expansion-toggle-list">
              <Toggle label="Earnings email" description="Receive creator earnings summaries when applicable." checked={settings.creatorEarningsEmail} disabled={loading || Boolean(savingKey)} onChange={(value) => void savePatch("creatorEarningsEmail", value)} />
              <Toggle label="Supporter alerts" description="Receive supported supporter/member activity alerts." checked={settings.creatorSupporterAlerts} disabled={loading || Boolean(savingKey)} onChange={(value) => void savePatch("creatorSupporterAlerts", value)} />
              <Toggle label="Sales alerts" description="Receive supported Library or creator sales alerts." checked={settings.creatorSalesAlerts} disabled={loading || Boolean(savingKey)} onChange={(value) => void savePatch("creatorSalesAlerts", value)} />
            </div>
            <div className="settings-v2-inline-actions" style={{ marginTop: "0.8rem" }}>
              <Link href="/profile?section=creator" className="settings-v2-secondary-action">Creator settings</Link>
            </div>
          </Panel>
        </div>,
        targets.plan
      )
    : null;

  const dataPortal = targets["data-activity"]
    ? createPortal(
        <div className="settings-expansion-stack">
          <Panel
            icon={SlidersHorizontal}
            eyebrow="Content & feed"
            title="Discussion and recommendation defaults"
            description="Control supported default feed presentation and AI-assisted personalization."
          >
            <div className="settings-expansion-select-list">
              <SelectRow label="Default discussion view" description="Choose which discussion lane opens by default on supported feed surfaces." value={settings.defaultFeed} onChange={(value) => void savePatch("defaultFeed", value as MemberSettings["defaultFeed"])}>
                <option value="all">All</option>
                <option value="following">Following</option>
                <option value="active">Active</option>
              </SelectRow>
              <SelectRow label="Display density" description="Choose comfortable or compact supported discussion presentation." value={settings.feedDensity} onChange={(value) => void savePatch("feedDensity", value as MemberSettings["feedDensity"])}>
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact</option>
              </SelectRow>
            </div>
            <div className="settings-expansion-toggle-list">
              <Toggle label="Show recommendations" description="Allow recommended discussions and member suggestions on supported surfaces." checked={settings.showRecommendations} disabled={loading || Boolean(savingKey)} onChange={(value) => void savePatch("showRecommendations", value)} />
              <Toggle label="Show followed-member activity" description="Include supported activity from members you follow." checked={settings.showFollowedMemberActivity} disabled={loading || Boolean(savingKey)} onChange={(value) => void savePatch("showFollowedMemberActivity", value)} />
              <Toggle label="Remember discussion filters" description="Remember supported discussion filter choices on this member account." checked={settings.rememberDiscussionFilters} disabled={loading || Boolean(savingKey)} onChange={(value) => void savePatch("rememberDiscussionFilters", value)} />
              <Toggle label="AI summaries" description="Allow supported Loombus AI summary presentation in discussion surfaces." checked={settings.aiSummariesEnabled} disabled={loading || Boolean(savingKey)} onChange={(value) => void savePatch("aiSummariesEnabled", value)} />
              <Toggle label="Auto-expand State of the Discussion" description="Automatically expand supported State of the Discussion intelligence when available." checked={settings.autoExpandDiscussionState} disabled={loading || Boolean(savingKey)} onChange={(value) => void savePatch("autoExpandDiscussionState", value)} />
              <Toggle label="Personalized recommendations" description="Use eligible Loombus activity to improve recommendations. This does not authorize advertising profiling." checked={settings.personalizedRecommendations} disabled={loading || Boolean(savingKey)} onChange={(value) => void savePatch("personalizedRecommendations", value)} />
            </div>
          </Panel>

          <Panel
            icon={Globe2}
            eyebrow="Data controls"
            title="History and personalization"
            description="Keep activity and AI-history controls next to the existing private activity workspaces."
          >
            <div className="settings-expansion-toggle-list">
              <Toggle label="Use eligible activity for personalization" description="Allow Loombus to use eligible on-platform activity for member recommendations and defaults." checked={settings.dataPersonalizationEnabled} disabled={loading || Boolean(savingKey)} onChange={(value) => void savePatch("dataPersonalizationEnabled", value)} />
              <Toggle label="AI activity history" description="Retain eligible AI-usage history needed for supported usage and history surfaces." checked={settings.aiActivityHistoryEnabled} disabled={loading || Boolean(savingKey)} onChange={(value) => void savePatch("aiActivityHistoryEnabled", value)} />
            </div>
            <div className="settings-v2-inline-actions" style={{ marginTop: "0.8rem" }}>
              <Link href="/reading-history" className="settings-v2-secondary-action">Reading history</Link>
              <Link href="/ai-usage" className="settings-v2-secondary-action">AI usage</Link>
              <a href="/api/settings/export" className="settings-v2-secondary-action"><Download aria-hidden="true" /> Download my data</a>
            </div>
          </Panel>
        </div>,
        targets["data-activity"]!
      )
    : null;

  return (
    <>
      {accountPortal}
      {profilePortal}
      {privacyPortal}
      {messagesPortal}
      {notificationsPortal}
      {appearancePortal}
      {planPortal}
      {dataPortal}
    </>
  );
}
