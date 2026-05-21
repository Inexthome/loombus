"use client";

import Link from "next/link";
import { type ChangeEvent, type FormEvent, type KeyboardEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { ProfileAvatar } from "@/components/profile-avatar";

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

function isValidOptionalUrl(value: string) {
  const clean = value.trim();

  if (!clean) {
    return true;
  }

  return /^https?:\/\//i.test(clean);
}

export default function ProfilePage() {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [creatorWebsiteUrl, setCreatorWebsiteUrl] = useState("");
  const [creatorSupportUrl, setCreatorSupportUrl] = useState("");
  const [creatorSupportLabel, setCreatorSupportLabel] = useState("");
  const [aiEntitlement, setAiEntitlement] = useState<AiEntitlement>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [repliesEnabled, setRepliesEnabled] = useState(true);
  const [followsEnabled, setFollowsEnabled] = useState(true);
  const [mentionsEnabled, setMentionsEnabled] = useState(true);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

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
        setAvatarUrl(data.avatar_url ?? "");
        setCreatorWebsiteUrl(data.creator_website_url ?? "");
        setCreatorSupportUrl(data.creator_support_url ?? "");
        setCreatorSupportLabel(data.creator_support_label ?? "");
        setIsAdmin(Boolean(data.is_admin));
      }

      const { data: entitlementData } = await supabase
        .from("user_ai_entitlements")
        .select("tier, ai_assisted_enabled, monthly_summary_limit")
        .eq("user_id", userData.user.id)
        .maybeSingle();

      setAiEntitlement((entitlementData ?? null) as AiEntitlement);

      const { data: preferences } = await supabase
        .from("notification_preferences")
        .select("replies_enabled, follows_enabled, mentions_enabled")
        .eq("user_id", userData.user.id)
        .maybeSingle();

      if (preferences) {
        setRepliesEnabled(preferences.replies_enabled ?? true);
        setFollowsEnabled(preferences.follows_enabled ?? true);
        setMentionsEnabled(preferences.mentions_enabled ?? true);
      }

      setLoading(false);
    }

    loadProfile();
  }, []);

  const profileCompletionItems = [
    {
      label: "Username",
      complete: Boolean(username.trim()),
    },
    {
      label: "Full name",
      complete: Boolean(fullName.trim()),
    },
    {
      label: "Bio",
      complete: Boolean(bio.trim()),
    },
    {
      label: "Profile image",
      complete: Boolean(avatarUrl.trim()),
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

  async function handleAvatarUpload(event: ChangeEvent<HTMLInputElement>) {
    setMessage("");

    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setMessage("Please upload an image file.");
      event.target.value = "";
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      setMessage("Avatar image must be 3 MB or smaller.");
      event.target.value = "";
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

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", userData.user.id);

      if (profileError) {
        setMessage(`Avatar uploaded, but profile update failed: ${profileError.message}`);
        return;
      }

      setAvatarUrl(publicUrl);
      setMessage("Avatar updated successfully.");
    } finally {
      setUploadingAvatar(false);
      event.target.value = "";
    }
  }

  async function saveProfile(event?: FormEvent<HTMLFormElement> | KeyboardEvent<HTMLFormElement>) {
    event?.preventDefault();

    if (saving) {
      return;
    }

    setMessage("");
    setSaving(true);

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      window.location.href = "/login";
      return;
    }

    const cleanUsername = username
      .replace(/^@+/, "")
      .trim()
      .toLowerCase();

    if (!/^[a-z0-9_]{2,30}$/.test(cleanUsername)) {
      setSaving(false);
      setMessage("Username must be 2-30 characters and can only use letters, numbers, and underscores.");
      return;
    }

    const { data: existingUsername } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", cleanUsername)
      .neq("id", userData.user.id)
      .maybeSingle();

    if (existingUsername) {
      setSaving(false);
      setMessage("That username is already taken. Please choose another one.");
      return;
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
      setMessage("Creator/supporter profile tools require Premium Plus or Admin access. Clear those fields to save your basic profile.");
      return;
    }

    if (!isValidOptionalUrl(cleanCreatorWebsiteUrl)) {
      setSaving(false);
      setMessage("Creator website URL must start with http:// or https://.");
      return;
    }

    if (!isValidOptionalUrl(cleanCreatorSupportUrl)) {
      setSaving(false);
      setMessage("Support URL must start with http:// or https://.");
      return;
    }

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: userData.user.id,
      full_name: fullName,
      username: cleanUsername,
      bio,
      avatar_url: avatarUrl || null,
      creator_website_url: cleanCreatorWebsiteUrl || null,
      creator_support_url: cleanCreatorSupportUrl || null,
      creator_support_label: cleanCreatorSupportLabel || null,
    });

    if (profileError) {
      setSaving(false);

      if (profileError.code === "23505") {
        setMessage("That username is already taken. Please choose another one.");
        return;
      }

      setMessage(`Error: ${profileError.message}`);
      return;
    }

    const { error: preferencesError } = await supabase
      .from("notification_preferences")
      .upsert({
        user_id: userData.user.id,
        replies_enabled: repliesEnabled,
        follows_enabled: followsEnabled,
        mentions_enabled: mentionsEnabled,
        updated_at: new Date().toISOString(),
      });

    setSaving(false);

    if (preferencesError) {
      setMessage(`Profile saved, but notification settings failed: ${preferencesError.message}`);
      return;
    }

    setMessage("Profile and notification settings updated successfully.");
  }

  function handleProfileFormKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      saveProfile(event);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-xl text-zinc-400">
          Loading profile...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-6 text-5xl font-semibold tracking-tight">
          Profile
        </h1>

        <p className="mb-8 text-zinc-400">
          Manage your public Loombus profile and notification preferences.
        </p>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <form
            onSubmit={saveProfile}
            onKeyDown={handleProfileFormKeyDown}
            className="space-y-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-6"
          >
          <section className="rounded-2xl border border-zinc-900 bg-black p-5">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="mb-2 text-sm uppercase tracking-[0.25em] text-zinc-500">
                  Profile completion
                </p>

                <h2 className="text-2xl font-medium">
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

          <section className="space-y-5">
            <div>
              <h2 className="text-2xl font-medium">
                Public profile
              </h2>

              <p className="mt-2 text-sm text-zinc-500">
                This information appears on your Loombus profile.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-900 bg-black p-5">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
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

                <label className="inline-flex cursor-pointer rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white">
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

              <p className="mt-4 text-xs leading-relaxed text-zinc-600">
                Supported formats depend on your browser. Keep images under 3 MB.
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
                className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none focus:border-zinc-500"
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
                placeholder="saint"
                className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none focus:border-zinc-500"
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
                className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none focus:border-zinc-500"
              />
            </div>
          </section>

          <section className="space-y-5 border-t border-zinc-900 pt-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-2xl font-medium">
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
                Creator/supporter profile links require Premium Plus or Admin access.
                You can leave these fields blank and still save your basic profile.
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm text-zinc-400">
                Creator website URL
              </label>

              <input
                type="url"
                value={creatorWebsiteUrl}
                onChange={(event) => setCreatorWebsiteUrl(event.target.value)}
                placeholder="https://example.com"
                maxLength={240}
                className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none focus:border-zinc-500"
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
                onChange={(event) => setCreatorSupportUrl(event.target.value)}
                placeholder="https://buymeacoffee.com/yourname"
                maxLength={240}
                className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none focus:border-zinc-500"
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
                onChange={(event) => setCreatorSupportLabel(event.target.value)}
                placeholder="Support my work"
                maxLength={40}
                className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none focus:border-zinc-500"
              />

              <p className="mt-2 text-xs text-zinc-600">
                Optional. Defaults to “Support” if blank.
              </p>
            </div>
          </section>

          <section className="border-t border-zinc-900 pt-8">
            <div className="mb-5">
              <h2 className="text-2xl font-medium">
                Notification settings
              </h2>

              <p className="mt-2 text-sm text-zinc-500">
                Choose which activity can create notifications for you.
              </p>
            </div>

            <div className="space-y-4">
              <label className="flex items-start justify-between gap-4 rounded-2xl border border-zinc-900 bg-black p-4">
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

              <label className="flex items-start justify-between gap-4 rounded-2xl border border-zinc-900 bg-black p-4">
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

              <label className="flex items-start justify-between gap-4 rounded-2xl border border-zinc-900 bg-black p-4">
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
            </div>
          </section>

          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-white px-6 py-3 text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
          >
            {saving ? "Saving..." : "Save Profile"}
          </button>

          <p className="text-sm text-zinc-600">
            Press Cmd+Enter or Ctrl+Enter to save.
          </p>

          {message && (
            <p className="text-sm text-zinc-400">
              {message}
            </p>
          )}
          </form>

          <aside className="h-fit rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <p className="mb-4 text-sm uppercase tracking-[0.25em] text-zinc-500">
              Public Preview
            </p>

            <div className="rounded-2xl border border-zinc-900 bg-black p-5">
              <p className="mb-3 text-sm text-zinc-500">
                @{username || "username"}
              </p>

              <div className="my-5" aria-label="Profile preview avatar">
                <ProfileAvatar
                  profile={{
                    full_name: fullName,
                    username,
                    avatar_url: avatarUrl,
                  }}
                  size="xl"
                />
              </div>

              <h2 className="mb-3 text-2xl font-medium">
                {fullName || "Loombus member"}
              </h2>

              <p className="whitespace-pre-wrap leading-relaxed text-zinc-400">
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
    </main>
  );
}
