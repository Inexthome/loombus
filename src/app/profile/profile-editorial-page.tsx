"use client";

import Link from "next/link";
import {
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Eye, Link2, Sparkles, User, Users, Wrench } from "lucide-react";
import { ProfileAvatar } from "@/components/profile-avatar";
import { CreatorHubPhaseOne } from "@/components/creator-hub-phase-one";
import { CreatorPaidSupporterManager } from "@/components/creator-paid-supporter-manager";
import { CreatorSupporterProgramManagerPhase2 } from "@/components/creator-supporter-program-manager-phase2";
import { ProfileViewersPanel } from "@/components/profile-viewers-panel";
import "@/components/creator-hub-phase-one.css";
import { supabase } from "@/lib/supabase/client";
import {
  getIdentityVerificationDisplay,
  normalizeIdentityVerificationStatus,
  type IdentityVerificationStatus,
} from "@/lib/identity-verification";
import { validatePublicProfileCompletion } from "@/lib/profile-completion";

type Section = "overview" | "public" | "creator" | "viewers" | "preview";

type AiEntitlement = {
  tier: string | null;
  ai_assisted_enabled: boolean | null;
  monthly_summary_limit: number | null;
} | null;

type ProfileSnapshot = {
  fullName: string;
  username: string;
  bio: string;
  perspectiveMarker: string;
  avatarUrl: string;
  creatorWebsiteUrl: string;
  creatorSupportUrl: string;
  creatorSupportLabel: string;
  repliesEnabled: boolean;
  followsEnabled: boolean;
  mentionsEnabled: boolean;
  followedDiscussionsEnabled: boolean;
  followedRepliesEnabled: boolean;
  emailDigestEnabled: boolean;
  emailDigestFrequency: string;
  pushMessagesEnabled: boolean;
  pushRepliesEnabled: boolean;
  pushFollowsEnabled: boolean;
  pushAdminReportsEnabled: boolean;
};

const MAX_AVATAR_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_FILE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const PERSPECTIVE_MARKERS = [
  "",
  "Lived experience",
  "Professional experience",
  "Research-based",
  "Builder / operator",
  "Student / learner",
  "Question / exploring",
] as const;
const sections = [
  { key: "overview" as const, label: "Overview", Icon: Sparkles },
  { key: "public" as const, label: "Public profile", Icon: User },
  { key: "creator" as const, label: "Creator", Icon: Wrench },
  { key: "viewers" as const, label: "Viewers", Icon: Users },
  { key: "preview" as const, label: "Preview & sharing", Icon: Eye },
];

function hasCreatorToolsAccess(entitlement: AiEntitlement, isAdmin: boolean) {
  if (isAdmin) return true;
  return (
    entitlement?.ai_assisted_enabled === true &&
    entitlement.tier === "premium" &&
    (entitlement.monthly_summary_limit ?? 0) > 50
  );
}

function profileSnapshotToString(snapshot: ProfileSnapshot) {
  return JSON.stringify(snapshot);
}

function parseProfileSnapshot(snapshot: string): ProfileSnapshot | null {
  try {
    return JSON.parse(snapshot) as ProfileSnapshot;
  } catch {
    return null;
  }
}

function isValidOptionalUrl(value: string) {
  const clean = value.trim();
  return !clean || /^https?:\/\//i.test(clean);
}

export default function ProfileEditorialPage() {
  const [activeSection, setActiveSection] = useState<Section>("overview");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [perspectiveMarker, setPerspectiveMarker] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [creatorWebsiteUrl, setCreatorWebsiteUrl] = useState("");
  const [creatorSupportUrl, setCreatorSupportUrl] = useState("");
  const [creatorSupportLabel, setCreatorSupportLabel] = useState("");
  const [aiEntitlement, setAiEntitlement] = useState<AiEntitlement>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [identityVerificationStatus, setIdentityVerificationStatus] =
    useState<IdentityVerificationStatus>("unverified");
  const [identityVerificationProvider, setIdentityVerificationProvider] = useState<string | null>(null);
  const [identityVerifiedAt, setIdentityVerifiedAt] = useState<string | null>(null);
  const [legalNameVerified, setLegalNameVerified] = useState(false);
  const [repliesEnabled, setRepliesEnabled] = useState(true);
  const [followsEnabled, setFollowsEnabled] = useState(true);
  const [mentionsEnabled, setMentionsEnabled] = useState(true);
  const [followedDiscussionsEnabled, setFollowedDiscussionsEnabled] = useState(true);
  const [followedRepliesEnabled, setFollowedRepliesEnabled] = useState(false);
  const [emailDigestEnabled, setEmailDigestEnabled] = useState(false);
  const [emailDigestFrequency, setEmailDigestFrequency] = useState("weekly");
  const [pushMessagesEnabled, setPushMessagesEnabled] = useState(true);
  const [pushRepliesEnabled, setPushRepliesEnabled] = useState(true);
  const [pushFollowsEnabled, setPushFollowsEnabled] = useState(true);
  const [pushAdminReportsEnabled, setPushAdminReportsEnabled] = useState(true);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savedProfileSnapshot, setSavedProfileSnapshot] = useState("");
  const [pendingNavigationHref, setPendingNavigationHref] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("section") as Section | null;
    if (requested && sections.some((section) => section.key === requested)) {
      setActiveSection(requested);
    }
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("section", activeSection);
    window.history.replaceState({}, "", url);
  }, [activeSection]);

  useEffect(() => {
    async function loadProfile() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        window.location.href = "/login";
        return;
      }

      const [{ data }, { data: entitlementData }, { data: preferences }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userData.user.id).single(),
        supabase
          .from("user_ai_entitlements")
          .select("tier, ai_assisted_enabled, monthly_summary_limit")
          .eq("user_id", userData.user.id)
          .maybeSingle(),
        supabase
          .from("notification_preferences")
          .select(
            "replies_enabled, follows_enabled, mentions_enabled, followed_discussions_enabled, followed_replies_enabled, email_digest_enabled, email_digest_frequency, push_messages_enabled, push_replies_enabled, push_follows_enabled, push_admin_reports_enabled"
          )
          .eq("user_id", userData.user.id)
          .maybeSingle(),
      ]);

      const nextFullName = data?.full_name ?? "";
      const nextUsername = data?.username ?? "";
      const nextBio = data?.bio ?? "";
      const nextPerspective = data?.perspective_marker ?? "";
      const nextAvatar = data?.avatar_url ?? "";
      const nextWebsite = data?.creator_website_url ?? "";
      const nextSupport = data?.creator_support_url ?? "";
      const nextSupportLabel = data?.creator_support_label ?? "";

      setFullName(nextFullName);
      setUsername(nextUsername);
      setBio(nextBio);
      setPerspectiveMarker(nextPerspective);
      setAvatarUrl(nextAvatar);
      setCreatorWebsiteUrl(nextWebsite);
      setCreatorSupportUrl(nextSupport);
      setCreatorSupportLabel(nextSupportLabel);
      setIsAdmin(Boolean(data?.is_admin));
      setIdentityVerificationStatus(
        normalizeIdentityVerificationStatus(data?.identity_verification_status)
      );
      setIdentityVerificationProvider(data?.identity_verification_provider ?? null);
      setIdentityVerifiedAt(data?.identity_verified_at ?? null);
      setLegalNameVerified(Boolean(data?.legal_name_verified));
      setAiEntitlement((entitlementData ?? null) as AiEntitlement);

      const nextPreferences = {
        repliesEnabled: preferences?.replies_enabled ?? true,
        followsEnabled: preferences?.follows_enabled ?? true,
        mentionsEnabled: preferences?.mentions_enabled ?? true,
        followedDiscussionsEnabled: preferences?.followed_discussions_enabled ?? true,
        followedRepliesEnabled: preferences?.followed_replies_enabled ?? false,
        emailDigestEnabled: preferences?.email_digest_enabled ?? false,
        emailDigestFrequency: preferences?.email_digest_frequency === "daily" ? "daily" : "weekly",
        pushMessagesEnabled: preferences?.push_messages_enabled ?? true,
        pushRepliesEnabled: preferences?.push_replies_enabled ?? true,
        pushFollowsEnabled: preferences?.push_follows_enabled ?? true,
        pushAdminReportsEnabled: preferences?.push_admin_reports_enabled ?? true,
      };

      setRepliesEnabled(nextPreferences.repliesEnabled);
      setFollowsEnabled(nextPreferences.followsEnabled);
      setMentionsEnabled(nextPreferences.mentionsEnabled);
      setFollowedDiscussionsEnabled(nextPreferences.followedDiscussionsEnabled);
      setFollowedRepliesEnabled(nextPreferences.followedRepliesEnabled);
      setEmailDigestEnabled(nextPreferences.emailDigestEnabled);
      setEmailDigestFrequency(nextPreferences.emailDigestFrequency);
      setPushMessagesEnabled(nextPreferences.pushMessagesEnabled);
      setPushRepliesEnabled(nextPreferences.pushRepliesEnabled);
      setPushFollowsEnabled(nextPreferences.pushFollowsEnabled);
      setPushAdminReportsEnabled(nextPreferences.pushAdminReportsEnabled);

      setSavedProfileSnapshot(
        profileSnapshotToString({
          fullName: nextFullName,
          username: nextUsername,
          bio: nextBio,
          perspectiveMarker: nextPerspective,
          avatarUrl: nextAvatar,
          creatorWebsiteUrl: nextWebsite,
          creatorSupportUrl: nextSupport,
          creatorSupportLabel: nextSupportLabel,
          ...nextPreferences,
        })
      );
      setLoading(false);
    }

    void loadProfile();
  }, []);

  const cleanUsernamePreview = username.replace(/^@+/, "").trim().toLowerCase();
  const profileCompletionGate = validatePublicProfileCompletion({
    fullName,
    username: cleanUsernamePreview,
    bio,
  });
  const safeUsernameForPath = /^[a-z0-9_]{3,30}$/.test(cleanUsernamePreview)
    ? cleanUsernamePreview
    : "";
  const publicProfilePath =
    profileCompletionGate.ok && safeUsernameForPath ? `/u/${safeUsernameForPath}` : "";
  const canUseCreatorTools = hasCreatorToolsAccess(aiEntitlement, isAdmin);
  const identityVerificationDisplay = getIdentityVerificationDisplay(identityVerificationStatus);

  const profileCompletionItems = useMemo(
    () => [
      {
        label: "Public name",
        complete:
          Boolean(fullName.trim()) &&
          fullName.trim().replace(/[^\p{L}]/gu, "").length >= 4,
      },
      {
        label: "Public username",
        complete:
          /^[a-z0-9_]{3,30}$/.test(cleanUsernamePreview) &&
          !/^\d+$/.test(cleanUsernamePreview) &&
          !/^user_[a-f0-9]{16,}$/.test(cleanUsernamePreview),
      },
      { label: "Bio", complete: bio.trim().length >= 20 },
    ],
    [bio, cleanUsernamePreview, fullName]
  );

  const completedProfileItems = profileCompletionItems.filter((item) => item.complete).length;
  const profileCompletionPercent = Math.round(
    (completedProfileItems / profileCompletionItems.length) * 100
  );
  const missingProfileItems = profileCompletionItems
    .filter((item) => !item.complete)
    .map((item) => item.label.toLowerCase());

  const currentProfileSnapshot = profileSnapshotToString({
    fullName,
    username,
    bio,
    perspectiveMarker,
    avatarUrl,
    creatorWebsiteUrl,
    creatorSupportUrl,
    creatorSupportLabel,
    repliesEnabled,
    followsEnabled,
    mentionsEnabled,
    followedDiscussionsEnabled,
    followedRepliesEnabled,
    emailDigestEnabled,
    emailDigestFrequency,
    pushMessagesEnabled,
    pushRepliesEnabled,
    pushFollowsEnabled,
    pushAdminReportsEnabled,
  });
  const hasUnsavedProfileChanges =
    !loading && Boolean(savedProfileSnapshot) && currentProfileSnapshot !== savedProfileSnapshot;

  function restoreSavedProfileSnapshot() {
    const snapshot = parseProfileSnapshot(savedProfileSnapshot);
    if (!snapshot) return;
    setFullName(snapshot.fullName);
    setUsername(snapshot.username);
    setBio(snapshot.bio);
    setPerspectiveMarker(snapshot.perspectiveMarker);
    setAvatarUrl(snapshot.avatarUrl);
    setCreatorWebsiteUrl(snapshot.creatorWebsiteUrl);
    setCreatorSupportUrl(snapshot.creatorSupportUrl);
    setCreatorSupportLabel(snapshot.creatorSupportLabel);
    setRepliesEnabled(snapshot.repliesEnabled);
    setFollowsEnabled(snapshot.followsEnabled);
    setMentionsEnabled(snapshot.mentionsEnabled);
    setFollowedDiscussionsEnabled(snapshot.followedDiscussionsEnabled);
    setFollowedRepliesEnabled(snapshot.followedRepliesEnabled);
    setEmailDigestEnabled(snapshot.emailDigestEnabled);
    setEmailDigestFrequency(snapshot.emailDigestFrequency);
    setPushMessagesEnabled(snapshot.pushMessagesEnabled);
    setPushRepliesEnabled(snapshot.pushRepliesEnabled);
    setPushFollowsEnabled(snapshot.pushFollowsEnabled);
    setPushAdminReportsEnabled(snapshot.pushAdminReportsEnabled);
    setMessage("Unsaved profile changes discarded.");
  }

  useEffect(() => {
    if (!hasUnsavedProfileChanges) return;
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedProfileChanges]);

  useEffect(() => {
    if (!hasUnsavedProfileChanges || saving) return;
    function handleDocumentClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const destination = new URL(anchor.href);
      if (destination.origin !== window.location.origin) return;
      const currentUrl = new URL(window.location.href);
      if (
        destination.pathname === currentUrl.pathname &&
        destination.search === currentUrl.search
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setPendingNavigationHref(destination.href);
    }
    document.addEventListener("click", handleDocumentClick, true);
    return () => document.removeEventListener("click", handleDocumentClick, true);
  }, [hasUnsavedProfileChanges, saving]);

  async function copyPublicProfileLink() {
    if (!publicProfilePath) {
      setMessage("Complete your public profile before sharing your member link.");
      return;
    }
    try {
      await navigator.clipboard.writeText(`https://loombus.com${publicProfilePath}`);
      setMessage("Public profile link copied.");
    } catch {
      setMessage("Unable to copy link. Your public profile path is shown below.");
    }
  }

  async function handleAvatarUpload(event: ChangeEvent<HTMLInputElement>) {
    setMessage("");
    const file = event.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_AVATAR_FILE_TYPES.has(file.type)) {
      setMessage("Profile image must be a JPG, PNG, or WebP file.");
      event.currentTarget.value = "";
      return;
    }
    if (file.size > MAX_AVATAR_FILE_SIZE_BYTES) {
      setMessage("Profile image must be 2 MB or smaller.");
      event.currentTarget.value = "";
      return;
    }

    setUploadingAvatar(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        window.location.href = "/login";
        return;
      }
      const rawExtension = file.name.split(".").pop()?.toLowerCase() || "png";
      const extension = rawExtension.replace(/[^a-z0-9]/g, "") || "png";
      const filePath = `${userData.user.id}/avatar-${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { cacheControl: "3600", upsert: true });
      if (uploadError) {
        setMessage(`Avatar upload failed: ${uploadError.message}`);
        return;
      }
      const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        window.location.href = "/login";
        return;
      }
      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ avatarUrl: publicUrlData.publicUrl }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(result.error ?? "Avatar uploaded, but profile update failed.");
        return;
      }
      const uploadedAvatarUrl = result.avatarUrl ?? publicUrlData.publicUrl;
      setAvatarUrl(uploadedAvatarUrl);
      setSavedProfileSnapshot((current) => {
        const snapshot = parseProfileSnapshot(current);
        return snapshot
          ? profileSnapshotToString({ ...snapshot, avatarUrl: uploadedAvatarUrl })
          : current;
      });
      setMessage("Avatar updated successfully.");
    } finally {
      setUploadingAvatar(false);
      event.target.value = "";
    }
  }

  async function saveProfile(
    event?: FormEvent<HTMLFormElement> | KeyboardEvent<HTMLFormElement>
  ): Promise<boolean> {
    event?.preventDefault();
    if (saving) return false;
    setMessage("");
    setSaving(true);

    const cleanUsername = username.replace(/^@+/, "").trim().toLowerCase();
    const profileGate = validatePublicProfileCompletion({ fullName, username: cleanUsername, bio });
    if (!profileGate.ok) {
      setSaving(false);
      setMessage(profileGate.message);
      return false;
    }

    const cleanCreatorWebsiteUrl = creatorWebsiteUrl.trim();
    const cleanCreatorSupportUrl = creatorSupportUrl.trim();
    const cleanCreatorSupportLabel = creatorSupportLabel.trim();
    const hasCreatorFields = Boolean(
      cleanCreatorWebsiteUrl || cleanCreatorSupportUrl || cleanCreatorSupportLabel
    );
    if (hasCreatorFields && !canUseCreatorTools) {
      setSaving(false);
      setMessage(
        "Creator/supporter profile tools require Premium Plus access. Clear those fields to save your basic profile."
      );
      return false;
    }
    if (!isValidOptionalUrl(cleanCreatorWebsiteUrl)) {
      setSaving(false);
      setMessage("Creator website URL must start with http:// or https://.");
      return false;
    }
    if (!isValidOptionalUrl(cleanCreatorSupportUrl)) {
      setSaving(false);
      setMessage("Support URL must start with http:// or https://.");
      return false;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      setSaving(false);
      window.location.href = "/login";
      return false;
    }

    try {
      const response = await fetch("/api/profile/public", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          fullName,
          username: cleanUsername,
          bio,
          perspectiveMarker: perspectiveMarker || null,
          avatarUrl: avatarUrl || null,
          creatorWebsiteUrl: cleanCreatorWebsiteUrl,
          creatorSupportUrl: cleanCreatorSupportUrl,
          creatorSupportLabel: cleanCreatorSupportLabel,
          repliesEnabled,
          followsEnabled,
          mentionsEnabled,
          followedDiscussionsEnabled,
          followedRepliesEnabled,
          emailDigestEnabled,
          emailDigestFrequency,
          pushMessagesEnabled,
          pushRepliesEnabled,
          pushFollowsEnabled,
          pushAdminReportsEnabled,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSaving(false);
        setMessage(result.error ?? "Unable to save profile.");
        return false;
      }

      const savedUsername = result.profile?.username ?? cleanUsername;
      setUsername(savedUsername);
      setSavedProfileSnapshot(
        profileSnapshotToString({
          fullName,
          username: savedUsername,
          bio,
          perspectiveMarker,
          avatarUrl,
          creatorWebsiteUrl: cleanCreatorWebsiteUrl,
          creatorSupportUrl: cleanCreatorSupportUrl,
          creatorSupportLabel: cleanCreatorSupportLabel,
          repliesEnabled,
          followsEnabled,
          mentionsEnabled,
          followedDiscussionsEnabled,
          followedRepliesEnabled,
          emailDigestEnabled,
          emailDigestFrequency,
          pushMessagesEnabled,
          pushRepliesEnabled,
          pushFollowsEnabled,
          pushAdminReportsEnabled,
        })
      );
      setCreatorWebsiteUrl(cleanCreatorWebsiteUrl);
      setCreatorSupportUrl(cleanCreatorSupportUrl);
      setCreatorSupportLabel(cleanCreatorSupportLabel);
      setSaving(false);
      setMessage("Profile updated successfully.");
      return true;
    } catch {
      setSaving(false);
      setMessage("Unable to save profile.");
      return false;
    }
  }

  function handleProfileFormKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void saveProfile(event);
  }

  async function saveAndContinueNavigation() {
    const destination = pendingNavigationHref;
    const saved = await saveProfile();
    if (saved && destination) {
      setPendingNavigationHref(null);
      window.location.href = destination;
    }
  }

  function discardAndContinueNavigation() {
    const destination = pendingNavigationHref;
    restoreSavedProfileSnapshot();
    setPendingNavigationHref(null);
    if (destination) window.location.href = destination;
  }

  if (loading) {
    return (
      <main className="profile-editorial-page profile-editorial-loading">
        <p>Loading profile…</p>
      </main>
    );
  }

  return (
    <main className="profile-editorial-page">
      <div className="profile-editorial-shell">
        <header className="profile-editorial-header">
          <div>
            <p className="profile-editorial-eyebrow">PROFILE</p>
            <h1>{fullName.trim() || "Your Loombus identity"}</h1>
            <p className="profile-editorial-deck">
              Shape how your identity, perspective, creator presence, and public profile appear across Loombus.
            </p>
          </div>
          <div className="profile-editorial-header-actions">
            {publicProfilePath ? (
              <Link href={publicProfilePath} target="_blank">
                View public profile
              </Link>
            ) : null}
            <Link href="/settings?section=profile">Settings</Link>
          </div>
        </header>

        <nav className="profile-editorial-tabs" aria-label="Profile workspace sections">
          {sections.map(({ key, label, Icon }) => (
            <button
              type="button"
              key={key}
              onClick={() => setActiveSection(key)}
              className={activeSection === key ? "is-active" : ""}
              aria-current={activeSection === key ? "page" : undefined}
            >
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        {message ? <p className="profile-editorial-message">{message}</p> : null}

        {activeSection === "overview" ? (
          <section className="profile-editorial-section" aria-labelledby="profile-overview-title">
            <div className="profile-editorial-section-heading">
              <p className="profile-editorial-kicker">Identity at a glance</p>
              <h2 id="profile-overview-title">Your public foundation</h2>
              <p>Completion, verification, and the public address people use to find you.</p>
            </div>

            <div className="profile-editorial-facts">
              <article>
                <span>Completion</span>
                <strong>{profileCompletionPercent}%</strong>
                <p>
                  {missingProfileItems.length
                    ? `Still needed: ${missingProfileItems.join(", ")}.`
                    : "Your public profile is complete."}
                </p>
                <div className="profile-editorial-progress" aria-hidden="true">
                  <span style={{ width: `${profileCompletionPercent}%` }} />
                </div>
              </article>
              <article>
                <span>Identity verification</span>
                <strong>{identityVerificationDisplay.label}</strong>
                <p>{identityVerificationDisplay.description}</p>
                {identityVerificationProvider ? (
                  <small>Provider: {identityVerificationProvider}</small>
                ) : null}
                {identityVerifiedAt ? (
                  <small>Verified {new Date(identityVerifiedAt).toLocaleDateString()}</small>
                ) : null}
                {legalNameVerified ? <small>Legal name verified</small> : null}
              </article>
              <article>
                <span>Public member link</span>
                <strong>{publicProfilePath || "Not active yet"}</strong>
                <p>
                  {publicProfilePath
                    ? "Ready to share anywhere you want people to find your Loombus identity."
                    : "Complete your public name, username, and bio to activate sharing."}
                </p>
                <div className="profile-editorial-inline-actions">
                  <button type="button" onClick={() => void copyPublicProfileLink()} disabled={!publicProfilePath}>
                    <Link2 aria-hidden="true" /> Copy link
                  </button>
                  <button type="button" onClick={() => setActiveSection("public")}>
                    Edit identity
                  </button>
                </div>
              </article>
            </div>
          </section>
        ) : null}

        {activeSection === "public" ? (
          <form
            className="profile-editorial-section profile-editorial-form"
            onSubmit={saveProfile}
            onKeyDown={handleProfileFormKeyDown}
          >
            <div className="profile-editorial-section-heading">
              <p className="profile-editorial-kicker">Public profile</p>
              <h2>Edit your identity</h2>
              <p>Name, username, bio, perspective, and profile image appear across Loombus.</p>
            </div>

            <div className="profile-editorial-avatar-row">
              <ProfileAvatar
                profile={{ full_name: fullName, username, avatar_url: avatarUrl }}
                size="xl"
              />
              <div>
                <strong>Profile image</strong>
                <p>JPG, PNG, or WebP. Maximum 2 MB.</p>
              </div>
              <label className="profile-editorial-upload">
                {uploadingAvatar ? "Uploading…" : "Change image"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={uploadingAvatar}
                  onChange={handleAvatarUpload}
                />
              </label>
            </div>

            <div className="profile-editorial-field-grid">
              <label>
                <span>Full name</span>
                <input type="text" value={fullName} onChange={(event) => setFullName(event.target.value)} />
              </label>
              <label>
                <span>Username</span>
                <input
                  type="text"
                  value={username}
                  onChange={(event) =>
                    setUsername(
                      event.target.value
                        .replace(/^@+/, "")
                        .replace(/[^a-zA-Z0-9_]/g, "")
                        .toLowerCase()
                    )
                  }
                  placeholder="username"
                />
              </label>
              <label className="profile-editorial-field-wide">
                <span>Bio</span>
                <textarea
                  rows={5}
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  placeholder="Write a short introduction…"
                />
                <small>Use at least 20 characters so people have enough context about you.</small>
              </label>
              <label className="profile-editorial-field-wide">
                <span>Perspective marker</span>
                <select value={perspectiveMarker} onChange={(event) => setPerspectiveMarker(event.target.value)}>
                  {PERSPECTIVE_MARKERS.map((marker) => (
                    <option key={marker || "none"} value={marker}>
                      {marker || "No perspective marker"}
                    </option>
                  ))}
                </select>
                <small>Optional context for where you are speaking from. It is not a trust score or expertise badge.</small>
              </label>
            </div>

            <div className="profile-editorial-save-row">
              <button type="submit" className="profile-editorial-primary-action" disabled={saving}>
                {saving ? "Saving…" : "Save profile"}
              </button>
              <span>{hasUnsavedProfileChanges ? "Unsaved changes" : "All changes saved"}</span>
            </div>
          </form>
        ) : null}

        {activeSection === "creator" ? (
          <section className="profile-editorial-section profile-editorial-creator" aria-labelledby="profile-creator-title">
            <div className="profile-editorial-section-heading">
              <p className="profile-editorial-kicker">Creator presence</p>
              <h2 id="profile-creator-title">Build the public layer around your work</h2>
              <p>Manage creator links, supporter tools, and the Creator Hub without turning your profile into a dashboard.</p>
            </div>

            <form className="profile-editorial-creator-links" onSubmit={saveProfile} onKeyDown={handleProfileFormKeyDown}>
              <div className="profile-editorial-subheading">
                <h3>Public creator links</h3>
                {!canUseCreatorTools ? <Link href="/premium">Premium Plus required</Link> : null}
              </div>
              {!canUseCreatorTools ? (
                <p className="profile-editorial-note">
                  Creator website links, support links, and custom support labels require Premium Plus. Your basic profile remains available.
                </p>
              ) : null}
              <div className="profile-editorial-field-grid">
                <label className="profile-editorial-field-wide">
                  <span>Creator website URL</span>
                  <input
                    type="url"
                    value={creatorWebsiteUrl}
                    disabled={!canUseCreatorTools}
                    onChange={(event) => setCreatorWebsiteUrl(event.target.value)}
                    placeholder="https://example.com"
                    maxLength={240}
                  />
                </label>
                <label>
                  <span>Support URL</span>
                  <input
                    type="url"
                    value={creatorSupportUrl}
                    disabled={!canUseCreatorTools}
                    onChange={(event) => setCreatorSupportUrl(event.target.value)}
                    placeholder="https://…"
                    maxLength={240}
                  />
                </label>
                <label>
                  <span>Support label</span>
                  <input
                    type="text"
                    value={creatorSupportLabel}
                    disabled={!canUseCreatorTools}
                    onChange={(event) => setCreatorSupportLabel(event.target.value)}
                    placeholder="Support my work"
                    maxLength={40}
                  />
                </label>
              </div>
              <div className="profile-editorial-save-row">
                <button type="submit" className="profile-editorial-primary-action" disabled={saving}>
                  {saving ? "Saving…" : "Save creator links"}
                </button>
              </div>
            </form>

            <div className="profile-editorial-creator-runtime">
              <CreatorHubPhaseOne />
              <CreatorSupporterProgramManagerPhase2 />
              <CreatorPaidSupporterManager />
            </div>
          </section>
        ) : null}

        {activeSection === "viewers" ? (
          <section className="profile-editorial-section" aria-labelledby="profile-viewers-title">
            <div className="profile-editorial-section-heading">
              <p className="profile-editorial-kicker">Profile viewers</p>
              <h2 id="profile-viewers-title">Who is finding your profile</h2>
              <p>Review profile-view activity through the same restrained Editorial workspace.</p>
            </div>
            <div className="profile-editorial-viewers-runtime">
              <ProfileViewersPanel />
            </div>
          </section>
        ) : null}

        {activeSection === "preview" ? (
          <section className="profile-editorial-section" aria-labelledby="profile-preview-title">
            <div className="profile-editorial-section-heading">
              <p className="profile-editorial-kicker">Preview & sharing</p>
              <h2 id="profile-preview-title">See what everyone else sees</h2>
              <p>Your public identity should read clearly before someone ever opens one of your discussions.</p>
            </div>

            <div className="profile-editorial-preview-layout">
              <article className="profile-editorial-preview-card">
                <p className="profile-editorial-preview-handle">@{username || "username"}</p>
                <ProfileAvatar
                  profile={{ full_name: fullName, username, avatar_url: avatarUrl }}
                  size="xl"
                />
                <h3>{fullName || "Loombus member"}</h3>
                {perspectiveMarker ? <p className="profile-editorial-perspective">{perspectiveMarker}</p> : null}
                <p className="profile-editorial-preview-bio">{bio || "Your bio preview will appear here."}</p>
                {(creatorWebsiteUrl.trim() || creatorSupportUrl.trim()) ? (
                  <div className="profile-editorial-preview-links">
                    {creatorWebsiteUrl.trim() ? <span>Website</span> : null}
                    {creatorSupportUrl.trim() ? <span>{creatorSupportLabel.trim() || "Support"}</span> : null}
                  </div>
                ) : null}
              </article>

              <aside className="profile-editorial-sharing">
                <p className="profile-editorial-kicker">Public address</p>
                <strong>{publicProfilePath || "Complete your profile to activate sharing."}</strong>
                <p>Share this address anywhere you want people to arrive at your Loombus identity first.</p>
                <div className="profile-editorial-inline-actions">
                  <button type="button" onClick={() => void copyPublicProfileLink()} disabled={!publicProfilePath}>
                    <Link2 aria-hidden="true" /> Copy link
                  </button>
                  {publicProfilePath ? (
                    <Link href={publicProfilePath} target="_blank">Open public profile</Link>
                  ) : null}
                </div>
              </aside>
            </div>
          </section>
        ) : null}
      </div>

      {pendingNavigationHref ? (
        <div className="profile-editorial-dialog-backdrop">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-unsaved-changes-title"
            className="profile-editorial-dialog"
          >
            <p className="profile-editorial-kicker">Unsaved profile</p>
            <h2 id="profile-unsaved-changes-title">Save your profile changes?</h2>
            <p>You changed your profile. Save before leaving so those updates are not lost.</p>
            <div>
              <button type="button" onClick={() => void saveAndContinueNavigation()} disabled={saving}>
                {saving ? "Saving…" : "Save changes and leave"}
              </button>
              <button type="button" onClick={discardAndContinueNavigation}>Discard changes and leave</button>
              <button type="button" onClick={() => setPendingNavigationHref(null)}>Keep editing</button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
