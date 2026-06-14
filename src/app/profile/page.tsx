"use client";

import Link from "next/link";
import { TopicAlertsControl } from "@/components/topic-alerts-control";
import { type ChangeEvent, type FormEvent, type KeyboardEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { ProfileAvatar } from "@/components/profile-avatar";
import { getIdentityVerificationDisplay, normalizeIdentityVerificationStatus, type IdentityVerificationStatus } from "@/lib/identity-verification";
import { validatePublicProfileCompletion } from "@/lib/profile-completion";

type AiEntitlement = {
  tier: string | null;
  ai_assisted_enabled: boolean | null;
  monthly_summary_limit: number | null;
} | null;

function hasCreatorToolsAccess(entitlement: AiEntitlement, isAdmin: boolean) {
  if (isAdmin) {
    return true;
  }

  return (
    entitlement?.ai_assisted_enabled === true &&
    entitlement.tier === "premium" &&
    (entitlement.monthly_summary_limit ?? 0) > 50
  );
}

function hasPremiumDigestAccess(entitlement: AiEntitlement, isAdmin: boolean) {
  if (isAdmin) {
    return true;
  }

  return (
    entitlement?.ai_assisted_enabled === true &&
    entitlement.tier === "premium"
  );
}


const MAX_AVATAR_FILE_SIZE_BYTES = 2 * 1024 * 1024;

const ALLOWED_AVATAR_FILE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const PERSPECTIVE_MARKERS = [
  "",
  "Lived experience",
  "Professional experience",
  "Research-based",
  "Builder / operator",
  "Student / learner",
  "Question / exploring",
] as const;

function isValidOptionalUrl(value: string) {
  const clean = value.trim();

  if (!clean) {
    return true;
  }

  return /^https?:\/\//i.test(clean);
}

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

export default function ProfilePage() {
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
  const [identityVerificationStatus, setIdentityVerificationStatus] = useState<IdentityVerificationStatus>("unverified");
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
  const canUseEmailDigest = hasPremiumDigestAccess(aiEntitlement, isAdmin);
  const canUseTopicAlerts = canUseEmailDigest;
  const identityVerificationDisplay = getIdentityVerificationDisplay(identityVerificationStatus);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savedProfileSnapshot, setSavedProfileSnapshot] = useState("");
  const [pendingNavigationHref, setPendingNavigationHref] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        window.location.href = "/login";
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userData.user.id)
        .single();

      if (data) {
        setFullName(data.full_name ?? "");
        setUsername(data.username ?? "");
        setBio(data.bio ?? "");
        setPerspectiveMarker(data.perspective_marker ?? "");
        setAvatarUrl(data.avatar_url ?? "");
        setCreatorWebsiteUrl(data.creator_website_url ?? "");
        setCreatorSupportUrl(data.creator_support_url ?? "");
        setCreatorSupportLabel(data.creator_support_label ?? "");
        setIsAdmin(Boolean(data.is_admin));
        setIdentityVerificationStatus(
          normalizeIdentityVerificationStatus(data.identity_verification_status)
        );
        setIdentityVerificationProvider(data.identity_verification_provider ?? null);
        setIdentityVerifiedAt(data.identity_verified_at ?? null);
        setLegalNameVerified(Boolean(data.legal_name_verified));
      }

      const { data: entitlementData } = await supabase
        .from("user_ai_entitlements")
        .select("tier, ai_assisted_enabled, monthly_summary_limit")
        .eq("user_id", userData.user.id)
        .maybeSingle();

      setAiEntitlement((entitlementData ?? null) as AiEntitlement);

      const { data: preferences } = await supabase
        .from("notification_preferences")
        .select("replies_enabled, follows_enabled, mentions_enabled, followed_discussions_enabled, followed_replies_enabled, email_digest_enabled, email_digest_frequency, push_messages_enabled, push_replies_enabled, push_follows_enabled, push_admin_reports_enabled")
        .eq("user_id", userData.user.id)
        .maybeSingle();

      if (preferences) {
        setRepliesEnabled(preferences.replies_enabled ?? true);
        setFollowsEnabled(preferences.follows_enabled ?? true);
        setMentionsEnabled(preferences.mentions_enabled ?? true);
        setFollowedDiscussionsEnabled(preferences.followed_discussions_enabled ?? true);
        setFollowedRepliesEnabled(preferences.followed_replies_enabled ?? false);
        setEmailDigestEnabled(preferences.email_digest_enabled ?? false);
        setEmailDigestFrequency(
          preferences.email_digest_frequency === "daily" ? "daily" : "weekly"
        );
        setPushMessagesEnabled(preferences.push_messages_enabled ?? true);
        setPushRepliesEnabled(preferences.push_replies_enabled ?? true);
        setPushFollowsEnabled(preferences.push_follows_enabled ?? true);
        setPushAdminReportsEnabled(preferences.push_admin_reports_enabled ?? true);
      }

      setSavedProfileSnapshot(
        profileSnapshotToString({
          fullName: data?.full_name ?? "",
          username: data?.username ?? "",
          bio: data?.bio ?? "",
          perspectiveMarker: data?.perspective_marker ?? "",
          avatarUrl: data?.avatar_url ?? "",
          creatorWebsiteUrl: data?.creator_website_url ?? "",
          creatorSupportUrl: data?.creator_support_url ?? "",
          creatorSupportLabel: data?.creator_support_label ?? "",
          repliesEnabled: preferences?.replies_enabled ?? true,
          followsEnabled: preferences?.follows_enabled ?? true,
          mentionsEnabled: preferences?.mentions_enabled ?? true,
          followedDiscussionsEnabled: preferences?.followed_discussions_enabled ?? true,
          followedRepliesEnabled: preferences?.followed_replies_enabled ?? false,
          emailDigestEnabled: preferences?.email_digest_enabled ?? false,
          emailDigestFrequency:
            preferences?.email_digest_frequency === "daily" ? "daily" : "weekly",
          pushMessagesEnabled: preferences?.push_messages_enabled ?? true,
          pushRepliesEnabled: preferences?.push_replies_enabled ?? true,
          pushFollowsEnabled: preferences?.push_follows_enabled ?? true,
          pushAdminReportsEnabled: preferences?.push_admin_reports_enabled ?? true,
        })
      );

      setLoading(false);
    }

    loadProfile();
  }, []);

  const cleanUsernamePreview = username.replace(/^@+/, "").trim().toLowerCase();
  const profileCompletionGate = validatePublicProfileCompletion({
    fullName,
    username: cleanUsernamePreview,
    bio,
  });

  const profileCompletionItems = [
    {
      label: "Public name",
      complete: Boolean(fullName.trim()) && fullName.trim().replace(/[^\p{L}]/gu, "").length >= 4,
    },
    {
      label: "Public username",
      complete:
        /^[a-z0-9_]{3,30}$/.test(cleanUsernamePreview) &&
        !/^\d+$/.test(cleanUsernamePreview) &&
        !/^user_[a-f0-9]{16,}$/.test(cleanUsernamePreview),
    },
    {
      label: "Bio",
      complete: bio.trim().length >= 20,
    },
  ];

  const completedProfileItems = profileCompletionItems.filter(
    (item) => item.complete
  ).length;

  const profileCompletionPercent = Math.round(
    (completedProfileItems / profileCompletionItems.length) * 100
  );

  const missingProfileItems = profileCompletionItems
    .filter((item) => !item.complete)
    .map((item) => item.label.toLowerCase());

  const canUseCreatorTools = hasCreatorToolsAccess(aiEntitlement, isAdmin);

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
    !loading &&
    Boolean(savedProfileSnapshot) &&
    currentProfileSnapshot !== savedProfileSnapshot;

  function restoreSavedProfileSnapshot() {
    const snapshot = parseProfileSnapshot(savedProfileSnapshot);

    if (!snapshot) {
      return;
    }

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
    setPushMessagesEnabled(snapshot.pushMessagesEnabled ?? true);
    setPushRepliesEnabled(snapshot.pushRepliesEnabled ?? true);
    setPushFollowsEnabled(snapshot.pushFollowsEnabled ?? true);
    setPushAdminReportsEnabled(snapshot.pushAdminReportsEnabled ?? true);
    setMessage("Unsaved profile changes discarded.");
  }

  useEffect(() => {
    if (!hasUnsavedProfileChanges) {
      return;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedProfileChanges]);

  useEffect(() => {
    if (!hasUnsavedProfileChanges || saving) {
      return;
    }

    function handleDocumentClick(event: MouseEvent) {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest("a[href]") as HTMLAnchorElement | null;

      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) {
        return;
      }

      const destination = new URL(anchor.href);

      if (destination.origin !== window.location.origin) {
        return;
      }

      const currentUrl = new URL(window.location.href);

      if (
        destination.pathname === currentUrl.pathname &&
        destination.search === currentUrl.search &&
        destination.hash
      ) {
        return;
      }

      if (
        destination.pathname === currentUrl.pathname &&
        destination.search === currentUrl.search &&
        destination.hash === currentUrl.hash
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setPendingNavigationHref(destination.href);
    }

    document.addEventListener("click", handleDocumentClick, true);

    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [hasUnsavedProfileChanges, saving]);

  async function handleAvatarUpload(event: ChangeEvent<HTMLInputElement>) {
    setMessage("");

    const file = event.target.files?.[0];

    if (!file) {
      return;
    }
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
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) {
        setMessage(`Avatar upload failed: ${uploadError.message}`);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData.publicUrl;

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          avatarUrl: publicUrl,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(result.error ?? "Avatar uploaded, but profile update failed.");
        return;
      }

      const uploadedAvatarUrl = result.avatarUrl ?? publicUrl;
      setAvatarUrl(uploadedAvatarUrl);
      setSavedProfileSnapshot((current) => {
        const snapshot = parseProfileSnapshot(current);

        if (!snapshot) {
          return current;
        }

        return profileSnapshotToString({
          ...snapshot,
          avatarUrl: uploadedAvatarUrl,
        });
      });
      setMessage("Avatar updated successfully.");
    } finally {
      setUploadingAvatar(false);
      event.target.value = "";
    }
  }

  async function saveProfile(event?: FormEvent<HTMLFormElement> | KeyboardEvent<HTMLFormElement>): Promise<boolean> {
    event?.preventDefault();

    if (saving) {
      return false;
    }

    setMessage("");
    setSaving(true);

    const cleanUsername = username
      .replace(/^@+/, "")
      .trim()
      .toLowerCase();

    const profileGate = validatePublicProfileCompletion({
      fullName,
      username: cleanUsername,
      bio,
    });

    if (!profileGate.ok) {
      setSaving(false);
      setMessage(profileGate.message);
      return false;
    }

    const cleanCreatorWebsiteUrl = creatorWebsiteUrl.trim();
    const cleanCreatorSupportUrl = creatorSupportUrl.trim();
    const cleanCreatorSupportLabel = creatorSupportLabel.trim();

    const hasCreatorFields =
      Boolean(cleanCreatorWebsiteUrl) ||
      Boolean(cleanCreatorSupportUrl) ||
      Boolean(cleanCreatorSupportLabel);

    if (hasCreatorFields && !canUseCreatorTools) {
      setSaving(false);
      setMessage("Creator/supporter profile tools require Premium Plus access. Clear those fields to save your basic profile.");
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
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
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

      setSaving(false);

      if (!response.ok) {
        setMessage(result.error ?? "Unable to save profile.");
        return false;
      }

      const savedUsername = result.profile?.username ?? cleanUsername;
      const savedCreatorWebsiteUrl = cleanCreatorWebsiteUrl;
      const savedCreatorSupportUrl = cleanCreatorSupportUrl;
      const savedCreatorSupportLabel = cleanCreatorSupportLabel;

      setUsername(savedUsername);
      setCreatorWebsiteUrl(savedCreatorWebsiteUrl);
      setCreatorSupportUrl(savedCreatorSupportUrl);
      setCreatorSupportLabel(savedCreatorSupportLabel);
      setSavedProfileSnapshot(
        profileSnapshotToString({
          fullName,
          username: savedUsername,
          bio,
          perspectiveMarker,
          avatarUrl,
          creatorWebsiteUrl: savedCreatorWebsiteUrl,
          creatorSupportUrl: savedCreatorSupportUrl,
          creatorSupportLabel: savedCreatorSupportLabel,
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
      setMessage("Profile and notification settings updated successfully.");
      return true;
    } catch {
      setSaving(false);
      setMessage("Unable to save profile.");
      return false;
    }
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

    if (destination) {
      window.location.href = destination;
    }
  }

  function handleProfileFormKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      saveProfile(event);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-4 pb-24 pt-4 text-white sm:px-6 sm:py-12 lg:py-16">
        <div className="mx-auto max-w-xl text-zinc-400">
          Loading profile...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 pb-24 pt-4 text-white sm:px-6 sm:py-12 lg:py-16">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/settings"
          className="mb-5 inline-block text-sm text-zinc-500 hover:text-white sm:mb-10"
        >
          ← Back to settings
        </Link>

        <h1 className="mb-3 text-2xl font-semibold tracking-tight sm:mb-4 sm:text-4xl md:text-5xl">
          Profile
        </h1>

        <p className="mb-5 text-sm leading-relaxed text-zinc-400 sm:mb-8 sm:text-base">
          Manage your public Loombus profile and notification preferences.
        </p>

        <TopicAlertsControl canUseTopicAlerts={canUseTopicAlerts} />


        <div className="grid gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6">
          <form
            onSubmit={saveProfile}
            onKeyDown={handleProfileFormKeyDown}
            className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:space-y-8 sm:p-6"
          >
          <section className="rounded-2xl border border-zinc-900 bg-black p-4 sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-3 sm:items-center sm:gap-4">
              <div>
                <p className="mb-2 text-sm uppercase tracking-[0.25em] text-zinc-500">
                  Profile completion
                </p>

                <h2 className="text-xl font-medium sm:text-2xl">
                  {profileCompletionPercent}% complete
                </h2>
              </div>

              <span className="rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-400">
                {completedProfileItems}/{profileCompletionItems.length}
              </span>
            </div>

            <div className="mb-4 h-2 overflow-hidden rounded-full bg-zinc-900">
              <div
                className="h-full rounded-full bg-white transition-all"
                style={{ width: `${profileCompletionPercent}%` }}
              />
            </div>

            {missingProfileItems.length > 0 ? (
              <p className="text-sm leading-relaxed text-zinc-500">
                Add your {missingProfileItems.join(", ")} to complete your public profile.
              </p>
            ) : (
              <p className="text-sm leading-relaxed text-zinc-500">
                Your profile is complete and ready to appear across Loombus.
              </p>
            )}
          </section>

          <section className="space-y-4 sm:space-y-5">
            <div>
              <h2 className="text-xl font-medium sm:text-2xl">
                Public profile
              </h2>

              <p className="mt-2 text-sm text-zinc-500">
                This information appears on your Loombus profile.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-900 bg-black p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
                <div className="flex items-center gap-3 sm:gap-4">
                  <ProfileAvatar
                    profile={{
                      full_name: fullName,
                      username,
                      avatar_url: avatarUrl,
                    }}
                    size="xl"
                  />

                  <div>
                    <h3 className="text-lg font-medium">
                      Profile image
                    </h3>

                    <p className="mt-1 text-sm text-zinc-500">
                      Upload a square image for the clearest avatar display.
                    </p>
                  </div>
                </div>

                <label className="inline-flex w-full cursor-pointer justify-center rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white sm:w-fit">
                  {uploadingAvatar ? "Uploading..." : "Upload Image"}
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploadingAvatar}
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <p className="mt-3 text-xs leading-relaxed text-zinc-600 sm:mt-4">
                Supported formats depend on your browser. Keep images under 2 MB.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-400">
                Full Name
              </label>

              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-base text-white outline-none focus:border-zinc-500"
              />
              <p className="mt-2 text-xs text-zinc-600">
                Use 2-30 letters, numbers, or underscores. Usernames must be unique and should not include the @ symbol.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-400">
                Username
              </label>

              <input
                type="text"
                value={username}
                onChange={(e) =>
                  setUsername(
                    e.target.value
                      .replace(/^@+/, "")
                      .replace(/[^a-zA-Z0-9_]/g, "")
                      .toLowerCase()
                  )
                }
                placeholder="example-user"
                className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-base text-white outline-none focus:border-zinc-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-400">
                Bio
              </label>

              <textarea
                rows={5}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Write a short introduction..."
                className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-base text-white outline-none focus:border-zinc-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-400">
                Perspective marker
              </label>

              <select
                value={perspectiveMarker}
                onChange={(event) => setPerspectiveMarker(event.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-base text-white outline-none focus:border-zinc-500"
              >
                {PERSPECTIVE_MARKERS.map((marker) => (
                  <option key={marker || "none"} value={marker}>
                    {marker || "No perspective marker"}
                  </option>
                ))}
              </select>

              <p className="mt-2 text-xs leading-relaxed text-zinc-600">
                Optional self-context for where you are speaking from. This is not verification, an expertise label, or a trust score.
              </p>
            </div>
          </section>

          <section className="space-y-4 border-t border-zinc-900 pt-5 sm:space-y-5 sm:pt-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-medium sm:text-2xl">
                  Creator / supporter tools
                </h2>

                <p className="mt-2 text-sm text-zinc-500">
                  Add optional public links for your creator website or support page.
                </p>
              </div>

              {!canUseCreatorTools && (
                <Link
                  href="/premium"
                  className="w-fit rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-500 transition hover:border-zinc-600 hover:text-white"
                >
                  Premium Plus
                </Link>
              )}
            </div>

            {!canUseCreatorTools && (
              <div className="rounded-2xl border border-zinc-900 bg-black p-4 text-sm leading-relaxed text-zinc-500">
                Creator/supporter tools are locked for Free accounts. Creator website links, support links, and custom support labels require Premium Plus access. You can still save your basic profile without these fields.
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm text-zinc-400">
                Creator website URL
              </label>

              <input
                type="url"
                value={creatorWebsiteUrl}
                disabled={!canUseCreatorTools}
                onChange={(event) => setCreatorWebsiteUrl(event.target.value)}
                placeholder="https://example.com"
                maxLength={240}
                className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-base text-white outline-none focus:border-zinc-500 disabled:cursor-not-allowed disabled:border-zinc-900 disabled:bg-zinc-950 disabled:text-zinc-700 disabled:placeholder:text-zinc-800"
              />

              <p className="mt-2 text-xs text-zinc-600">
                Optional. Must start with http:// or https://.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-400">
                Support link URL
              </label>

              <input
                type="url"
                value={creatorSupportUrl}
                disabled={!canUseCreatorTools}
                onChange={(event) => setCreatorSupportUrl(event.target.value)}
                placeholder="https://buymeacoffee.com/yourname"
                maxLength={240}
                className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-base text-white outline-none focus:border-zinc-500 disabled:cursor-not-allowed disabled:border-zinc-900 disabled:bg-zinc-950 disabled:text-zinc-700 disabled:placeholder:text-zinc-800"
              />

              <p className="mt-2 text-xs text-zinc-600">
                Optional public support link.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-400">
                Support link label
              </label>

              <input
                type="text"
                value={creatorSupportLabel}
                disabled={!canUseCreatorTools}
                onChange={(event) => setCreatorSupportLabel(event.target.value)}
                placeholder="Support my work"
                maxLength={40}
                className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-base text-white outline-none focus:border-zinc-500 disabled:cursor-not-allowed disabled:border-zinc-900 disabled:bg-zinc-950 disabled:text-zinc-700 disabled:placeholder:text-zinc-800"
              />

              <p className="mt-2 text-xs text-zinc-600">
                Optional. Defaults to “Support” if blank.
              </p>
            </div>
          </section>

          <section className="border-t border-zinc-900 pt-5 sm:pt-8">
            <div className="mb-4 sm:mb-5">
              <h2 className="text-xl font-medium sm:text-2xl">
                Notification settings
              </h2>

              <p className="mt-2 text-sm text-zinc-500">
                Choose which activity can create notifications for you.
              </p>
            </div>

            <div className="space-y-3 sm:space-y-4">
              <label className="flex items-start justify-between gap-3 rounded-2xl border border-zinc-900 bg-black p-3.5 sm:gap-4 sm:p-4">
                <span>
                  <span className="block text-sm font-medium text-zinc-200">
                    Replies
                  </span>
                  <span className="mt-1 block text-sm text-zinc-500">
                    Notify me when someone replies to my discussions.
                  </span>
                </span>

                <input
                  type="checkbox"
                  checked={repliesEnabled}
                  onChange={(e) => setRepliesEnabled(e.target.checked)}
                  className="mt-1 h-5 w-5"
                />
              </label>

              <label className="flex items-start justify-between gap-3 rounded-2xl border border-zinc-900 bg-black p-3.5 sm:gap-4 sm:p-4">
                <span>
                  <span className="block text-sm font-medium text-zinc-200">
                    Follows
                  </span>
                  <span className="mt-1 block text-sm text-zinc-500">
                    Notify me when someone follows my profile.
                  </span>
                </span>

                <input
                  type="checkbox"
                  checked={followsEnabled}
                  onChange={(e) => setFollowsEnabled(e.target.checked)}
                  className="mt-1 h-5 w-5"
                />
              </label>

              <label className="flex items-start justify-between gap-3 rounded-2xl border border-zinc-900 bg-black p-3.5 sm:gap-4 sm:p-4">
                <span>
                  <span className="block text-sm font-medium text-zinc-200">
                    Mentions
                  </span>
                  <span className="mt-1 block text-sm text-zinc-500">
                    Reserved for future @mention notifications.
                  </span>
                </span>

                <input
                  type="checkbox"
                  checked={mentionsEnabled}
                  onChange={(e) => setMentionsEnabled(e.target.checked)}
                  className="mt-1 h-5 w-5"
                />
              </label>

              <label className="flex items-start justify-between gap-3 rounded-2xl border border-zinc-900 bg-black p-3.5 sm:gap-4 sm:p-4">
                <span>
                  <span className="block text-sm font-medium text-zinc-200">
                    People I follow: new discussions
                  </span>
                  <span className="mt-1 block text-sm text-zinc-500">
                    Notify me when someone I follow publishes a new discussion.
                  </span>
                </span>

                <input
                  type="checkbox"
                  checked={followedDiscussionsEnabled}
                  onChange={(e) => setFollowedDiscussionsEnabled(e.target.checked)}
                  className="mt-1 h-5 w-5"
                />
              </label>

              <label className="flex items-start justify-between gap-3 rounded-2xl border border-zinc-900 bg-black p-3.5 sm:gap-4 sm:p-4">
                <span>
                  <span className="block text-sm font-medium text-zinc-200">
                    People I follow: replies
                  </span>
                  <span className="mt-1 block text-sm text-zinc-500">
                    Optional. Notify me when someone I follow posts a reply.
                  </span>
                </span>

                <input
                  type="checkbox"
                  checked={followedRepliesEnabled}
                  onChange={(e) => setFollowedRepliesEnabled(e.target.checked)}
                  className="mt-1 h-5 w-5"
                />
              </label>

              <div className="rounded-2xl border border-zinc-900 bg-black p-3.5 sm:p-4">
                <div className="mb-4">
                  <span className="block text-sm font-medium text-zinc-200">
                    Native push notifications
                  </span>
                  <span className="mt-1 block text-sm text-zinc-500">
                    Choose which Loombus activity can reach your phone as a device notification.
                  </span>
                </div>

                <div className="space-y-3">
                  <label className="flex items-start justify-between gap-4">
                    <span>
                      <span className="block text-sm font-medium text-zinc-300">
                        Private messages
                      </span>
                      <span className="mt-1 block text-sm text-zinc-600">
                        Send a phone notification when someone sends you a private message.
                      </span>
                    </span>

                    <input
                      type="checkbox"
                      checked={pushMessagesEnabled}
                      onChange={(e) => setPushMessagesEnabled(e.target.checked)}
                      className="mt-1 h-5 w-5"
                    />
                  </label>

                  <label className="flex items-start justify-between gap-4">
                    <span>
                      <span className="block text-sm font-medium text-zinc-300">
                        Replies to my discussions
                      </span>
                      <span className="mt-1 block text-sm text-zinc-600">
                        Send a phone notification when someone replies to your discussion.
                      </span>
                    </span>

                    <input
                      type="checkbox"
                      checked={pushRepliesEnabled}
                      onChange={(e) => setPushRepliesEnabled(e.target.checked)}
                      className="mt-1 h-5 w-5"
                    />
                  </label>

                  <label className="flex items-start justify-between gap-4">
                    <span>
                      <span className="block text-sm font-medium text-zinc-300">
                        New followers
                      </span>
                      <span className="mt-1 block text-sm text-zinc-600">
                        Send a phone notification when someone follows you.
                      </span>
                    </span>

                    <input
                      type="checkbox"
                      checked={pushFollowsEnabled}
                      onChange={(e) => setPushFollowsEnabled(e.target.checked)}
                      className="mt-1 h-5 w-5"
                    />
                  </label>

                  {isAdmin && (
                    <label className="flex items-start justify-between gap-4 rounded-2xl border border-amber-900/50 bg-amber-950/10 p-3">
                      <span>
                        <span className="block text-sm font-medium text-amber-200">
                          Admin report alerts
                        </span>
                        <span className="mt-1 block text-sm text-amber-200/60">
                          Send a phone notification when a new report needs admin review.
                        </span>
                      </span>

                      <input
                        type="checkbox"
                        checked={pushAdminReportsEnabled}
                        onChange={(e) => setPushAdminReportsEnabled(e.target.checked)}
                        className="mt-1 h-5 w-5"
                      />
                    </label>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-900 bg-black p-3.5 sm:p-4">
                <label className="mb-4 flex items-start justify-between gap-4">
                  <span>
                    <span className="block text-sm font-medium text-zinc-200">
                      Email digest
                    </span>
                    <span className="mt-1 block text-sm text-zinc-500">
                      Premium email digest: receive a daily or weekly summary of recent Loombus notifications. You can turn this off here or from the unsubscribe link in any digest email.
                    </span>
                  </span>

                  <input
                    type="checkbox"
                    checked={emailDigestEnabled}
                    onChange={(e) => setEmailDigestEnabled(e.target.checked)}
                    className="mt-1 h-5 w-5"
                  />
                </label>

                <label className="block text-sm text-zinc-500">
                  <span className="mb-2 block">Digest frequency</span>
                  <select
                    value={emailDigestFrequency}
                    onChange={(event) => setEmailDigestFrequency(event.target.value)}
                    disabled={!canUseEmailDigest || !emailDigestEnabled}
                    className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-300 outline-none focus:border-zinc-600 disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="daily">Daily</option>
                  </select>

                  {!canUseEmailDigest && (
                    <p className="mt-2 text-xs leading-relaxed text-zinc-600">
                      Email digests are a Premium feature. Free accounts can
                      still use in-app notifications.
                    </p>
                  )}
                </label>
              </div>
            </div>
          </section>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-full bg-white px-6 py-3 text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400 sm:w-fit"
          >
            {saving ? "Saving..." : "Save Profile"}
          </button>

          <p className="hidden text-sm text-zinc-600 sm:block">
            Press Cmd+Enter or Ctrl+Enter to save.
          </p>

          {message && (
            <p className="text-sm text-zinc-400">
              {message}
            </p>
          )}
          </form>

          <aside className="h-fit rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:p-6">
            <p className="mb-4 text-sm uppercase tracking-[0.25em] text-zinc-500">
              Public Preview
            </p>

            <div className="rounded-2xl border border-zinc-900 bg-black p-4 sm:p-5">
              <p className="mb-3 text-sm text-zinc-500">
                @{username || "username"}
              </p>

              <div className="my-3 sm:my-5" aria-label="Profile preview avatar">
                <ProfileAvatar
                  profile={{
                    full_name: fullName,
                    username,
                    avatar_url: avatarUrl,
                  }}
                  size="xl"
                />
              </div>

              <h2 className="mb-3 text-xl font-medium sm:text-2xl">
                {fullName || "Loombus member"}
              </h2>

              {perspectiveMarker && (
                <p className="mb-3 w-fit rounded-full border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400">
                  Perspective: {perspectiveMarker}
                </p>
              )}

              <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-400 sm:text-base">
                {bio || "Your bio preview will appear here."}
              </p>

              {(creatorWebsiteUrl.trim() || creatorSupportUrl.trim()) && (
                <div className="mt-5 flex flex-wrap gap-3">
                  {creatorWebsiteUrl.trim() && (
                    <span className="rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-400">
                      Website
                    </span>
                  )}

                  {creatorSupportUrl.trim() && (
                    <span className="rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-400">
                      {creatorSupportLabel.trim() || "Support"}
                    </span>
                  )}
                </div>
              )}
            </div>

            <p className="mt-4 text-sm leading-relaxed text-zinc-600">
              This is how your profile card will appear across Loombus.
            </p>
          </aside>
        </div>
      </div>

      {pendingNavigationHref && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-unsaved-changes-title"
            className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-950 p-5 text-white shadow-2xl shadow-black/70 sm:p-6"
          >
            <p className="mb-2 text-xs uppercase tracking-[0.24em] text-zinc-500">
              Unsaved profile
            </p>

            <h2 id="profile-unsaved-changes-title" className="text-2xl font-semibold tracking-tight">
              Save your profile changes?
            </h2>

            <p className="mt-3 text-sm leading-relaxed text-zinc-500">
              You changed your profile or notification settings. Save before leaving so those updates are not lost.
            </p>

            <div className="mt-6 grid gap-3">
              <button
                type="button"
                onClick={() => void saveAndContinueNavigation()}
                disabled={saving}
                className="rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
              >
                {saving ? "Saving..." : "Save changes and leave"}
              </button>

              <button
                type="button"
                onClick={discardAndContinueNavigation}
                className="rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Discard changes and leave
              </button>

              <button
                type="button"
                onClick={() => setPendingNavigationHref(null)}
                className="rounded-full border border-zinc-900 px-5 py-3 text-sm text-zinc-500 transition hover:border-zinc-700 hover:text-white"
              >
                Keep editing
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
