"use client";

import dynamic from "next/dynamic";
import { LockKeyhole, UserCheck, UserPlus } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ProfileAvatar } from "@/components/profile-avatar";
import { supabase } from "@/lib/supabase/client";

const PublicProfileV2Client = dynamic(
  () => import("@/app/u/[username]/public-profile-v2-client"),
  { ssr: false }
);

type AccessPayload = {
  profile?: {
    id: string;
    fullName: string | null;
    username: string | null;
    avatarUrl: string | null;
    bio: string | null;
    perspectiveMarker: string | null;
    isAdmin: boolean;
  };
  privacy?: {
    privateAccount: boolean;
    discoverable: boolean;
  };
  access?: "full" | "limited";
  isOwner?: boolean;
  following?: boolean;
  requested?: boolean;
  error?: string;
};

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

export function PublicProfilePrivacyBridge() {
  const params = useParams();
  const username = decodeURIComponent(String(params.username ?? ""));
  const [state, setState] = useState<"checking" | "full" | "limited" | "error">(
    "checking"
  );
  const [payload, setPayload] = useState<AccessPayload>({});
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function resolveAccess() {
      const token = await getToken();
      if (!token) {
        setState("error");
        return;
      }

      const response = await fetch(
        `/api/profiles/access?username=${encodeURIComponent(username)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }
      );
      const result = (await response.json().catch(() => ({}))) as AccessPayload;
      if (cancelled) return;
      setPayload(result);
      if (!response.ok || !result.profile) {
        setState("error");
        return;
      }

      setState(result.access === "limited" ? "limited" : "full");
      if (!result.isOwner) {
        void fetch("/api/profiles/view", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ profileId: result.profile.id }),
          cache: "no-store",
        }).catch(() => null);
      }
    }

    void resolveAccess();
    return () => {
      cancelled = true;
    };
  }, [username]);

  async function toggleFollowRequest() {
    if (!payload.profile || working) return;
    setWorking(true);
    setMessage("");
    const token = await getToken();
    if (!token) {
      window.location.href = `/login?next=/u/${encodeURIComponent(username)}`;
      return;
    }

    const response = await fetch("/api/follows/toggle", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ targetUserId: payload.profile.id }),
    });
    const result = await response.json().catch(() => ({}));
    if (response.ok) {
      setPayload((current) => ({
        ...current,
        following: Boolean(result.following),
        requested: Boolean(result.requested),
      }));
      setMessage(
        result.requested
          ? "Follow request sent."
          : result.following
            ? "You are now following this member."
            : payload.requested
              ? "Follow request cancelled."
              : "Follow status updated."
      );
      if (result.following) window.location.reload();
    } else {
      setMessage(result.error ?? "Unable to update the follow request.");
    }
    setWorking(false);
  }

  if (state === "full") {
    return (
      <>
        <span data-public-profile-privacy-state="full" hidden />
        <PublicProfileV2Client />
      </>
    );
  }

  if (state === "checking") {
    return (
      <main
        className="private-profile-gate"
        data-public-profile-privacy-state="checking"
      >
        <section className="private-profile-card">
          <p className="private-profile-eyebrow">Member privacy</p>
          <h1>Checking profile access…</h1>
          <p>Loombus is applying this member’s privacy and follow settings.</p>
        </section>
      </main>
    );
  }

  if (state === "error" || !payload.profile) {
    return (
      <main
        className="private-profile-gate"
        data-public-profile-privacy-state="limited"
      >
        <section className="private-profile-card">
          <p className="private-profile-eyebrow">Profile unavailable</p>
          <h1>This member profile could not be opened.</h1>
          <p>{payload.error ?? "The profile may be unavailable or restricted."}</p>
        </section>
      </main>
    );
  }

  const profile = payload.profile;
  const avatarProfile = {
    id: profile.id,
    full_name: profile.fullName,
    username: profile.username,
    avatar_url: profile.avatarUrl,
  };

  return (
    <main
      className="private-profile-gate"
      data-public-profile-privacy-state="limited"
    >
      <section className="private-profile-card">
        <div className="private-profile-lock">
          <LockKeyhole aria-hidden="true" />
        </div>
        <ProfileAvatar profile={avatarProfile} size="xl" />
        <p className="private-profile-eyebrow">Private Loombus account</p>
        <h1>
          {profile.fullName?.trim() ||
            profile.username?.trim() ||
            "Loombus member"}
        </h1>
        <p className="private-profile-handle">
          {profile.username ? `@${profile.username}` : "Member identity"}
        </p>
        <p className="private-profile-copy">
          This member limits profile activity to approved followers. Send a follow
          request to see their member activity and follower-only Discussions.
        </p>
        <button
          type="button"
          disabled={working}
          onClick={() => void toggleFollowRequest()}
          className="private-profile-follow"
        >
          {payload.requested ? (
            <UserCheck aria-hidden="true" />
          ) : (
            <UserPlus aria-hidden="true" />
          )}
          {working
            ? "Working…"
            : payload.requested
              ? "Requested · tap to cancel"
              : "Request to follow"}
        </button>
        {message ? (
          <p className="private-profile-message" role="status">
            {message}
          </p>
        ) : null}
      </section>
    </main>
  );
}
