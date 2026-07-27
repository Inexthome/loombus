"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import {
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  Search,
  ShieldCheck,
  UserCheck,
  X,
} from "lucide-react";
import { ProfileAvatar } from "@/components/profile-avatar";
import { supabase } from "@/lib/supabase/client";

type PrivacySettings = {
  private_account: boolean;
  discoverable: boolean;
  show_view_identity: boolean;
};

type AgeSafety = {
  ageBand: string;
  teenSafetyMode: boolean;
  privateAccountLocked: boolean;
  adultDiscoveryLimited: boolean;
};

type FollowRequest = {
  id: string;
  createdAt: string;
  requester: {
    id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
    bio: string | null;
  };
};

const DEFAULTS: PrivacySettings = {
  private_account: false,
  discoverable: true,
  show_view_identity: true,
};

const DEFAULT_AGE_SAFETY: AgeSafety = {
  ageBand: "unknown",
  teenSafetyMode: false,
  privateAccountLocked: false,
  adultDiscoveryLimited: false,
};

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

function PrivacyToggle({
  title,
  description,
  checked,
  disabled,
  onChange,
  icon: Icon,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
  icon: typeof LockKeyhole;
}) {
  return (
    <label className="member-privacy-toggle">
      <span className="member-privacy-toggle-icon"><Icon aria-hidden="true" /></span>
      <span className="member-privacy-toggle-copy">
        <strong>{title}</strong>
        <span>{description}</span>
      </span>
      <span className="member-privacy-switch">
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

export function MemberPrivacySettingsBridge() {
  const [mount, setMount] = useState<HTMLElement | null>(null);
  const [settings, setSettings] = useState<PrivacySettings>(DEFAULTS);
  const [ageSafety, setAgeSafety] = useState<AgeSafety>(DEFAULT_AGE_SAFETY);
  const [requests, setRequests] = useState<FollowRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workingRequest, setWorkingRequest] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setMount(document.getElementById("privacy"));
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const token = await getToken();
      if (!token) return;
      const [privacyResponse, requestResponse] = await Promise.all([
        fetch("/api/settings/member-privacy", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }),
        fetch("/api/follows/requests", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }),
      ]);
      const privacyPayload = await privacyResponse.json().catch(() => ({}));
      const requestPayload = await requestResponse.json().catch(() => ({}));
      if (cancelled) return;
      if (privacyResponse.ok && privacyPayload.settings) {
        setSettings({
          private_account: Boolean(privacyPayload.settings.private_account),
          discoverable: privacyPayload.settings.discoverable !== false,
          show_view_identity: privacyPayload.settings.show_view_identity !== false,
        });
        if (privacyPayload.ageSafety) {
          setAgeSafety({
            ageBand: String(privacyPayload.ageSafety.ageBand ?? "unknown"),
            teenSafetyMode: Boolean(privacyPayload.ageSafety.teenSafetyMode),
            privateAccountLocked: Boolean(privacyPayload.ageSafety.privateAccountLocked),
            adultDiscoveryLimited: Boolean(privacyPayload.ageSafety.adultDiscoveryLimited),
          });
        }
      } else if (!privacyResponse.ok) {
        setMessage(privacyPayload.error ?? "Privacy controls could not load.");
      }
      if (requestResponse.ok) setRequests(requestPayload.requests ?? []);
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function updateSettings(patch: Partial<PrivacySettings>) {
    if (saving) return;
    const previous = settings;
    const next = {
      ...settings,
      ...patch,
      private_account: ageSafety.privateAccountLocked
        ? true
        : patch.private_account ?? settings.private_account,
    };
    setSettings(next);
    setSaving(true);
    setMessage("");
    const token = await getToken();
    if (!token) {
      window.location.href = "/login?next=/settings#privacy";
      return;
    }

    const response = await fetch("/api/settings/member-privacy", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        privateAccount: next.private_account,
        discoverable: next.discoverable,
        showViewIdentity: next.show_view_identity,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setSettings(previous);
      setMessage(payload.error ?? "Privacy settings could not be saved.");
    } else {
      if (payload.settings) {
        setSettings({
          private_account: Boolean(payload.settings.private_account),
          discoverable: payload.settings.discoverable !== false,
          show_view_identity: payload.settings.show_view_identity !== false,
        });
      }
      if (payload.ageSafety) {
        setAgeSafety({
          ageBand: String(payload.ageSafety.ageBand ?? "unknown"),
          teenSafetyMode: Boolean(payload.ageSafety.teenSafetyMode),
          privateAccountLocked: Boolean(payload.ageSafety.privateAccountLocked),
          adultDiscoveryLimited: Boolean(payload.ageSafety.adultDiscoveryLimited),
        });
      }
      setMessage(
        payload.futureDiscussionVisibilityChanged
          ? "Privacy saved. Future Discussions now default to Followers. Existing Discussions were not changed."
          : "Privacy settings saved.",
      );
    }
    setSaving(false);
  }

  async function respondToRequest(requestId: string, action: "accept" | "decline") {
    if (workingRequest) return;
    setWorkingRequest(requestId);
    setMessage("");
    const token = await getToken();
    if (!token) return;
    const response = await fetch("/api/follows/requests", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ requestId, action }),
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      setRequests((current) => current.filter((item) => item.id !== requestId));
      setMessage(action === "accept" ? "Follow request approved." : "Follow request declined.");
    } else {
      setMessage(payload.error ?? "Unable to update this follow request.");
    }
    setWorkingRequest("");
  }

  if (!mount) return null;

  return createPortal(
    <div className="member-privacy-settings">
      <div className="member-privacy-heading">
        <div>
          <p>Member privacy</p>
          <h3>Control discovery, profile access, and viewer identity.</h3>
        </div>
        <span>{loading ? "Loading" : saving ? "Saving" : "Saved"}</span>
      </div>

      {ageSafety.teenSafetyMode ? (
        <div className="member-privacy-message" role="status">
          <ShieldCheck aria-hidden="true" size={17} />
          <span>
            Teen Safety keeps this account private. Adult members outside an established
            Loombus relationship cannot discover or open the profile. Turning 18 preserves
            the privacy choices already in place. <Link href="/account/age-safety">Review Age Safety</Link>
          </span>
        </div>
      ) : null}

      <div className="member-privacy-toggle-list">
        <PrivacyToggle
          title="Private account"
          description={
            ageSafety.privateAccountLocked
              ? "Required while Teen Safety is active. Every new follower needs approval, and future Discussions cannot use a public audience."
              : "New followers must be approved. Non-followers see a limited profile, and future Discussions move from Public to Followers when needed. Existing Discussions keep their original visibility."
          }
          checked={settings.private_account}
          disabled={loading || saving || ageSafety.privateAccountLocked}
          onChange={(value) => void updateSettings({ private_account: value })}
          icon={ageSafety.privateAccountLocked ? ShieldCheck : LockKeyhole}
        />
        <PrivacyToggle
          title="Appear in People and search"
          description={
            ageSafety.adultDiscoveryLimited
              ? "Allow eligible Loombus discovery. Adult strangers remain excluded even when this setting is on."
              : "Allow signed-in Loombus members to find your account in the People directory, Everything Search, and recommendations."
          }
          checked={settings.discoverable}
          disabled={loading || saving}
          onChange={(value) => void updateSettings({ discoverable: value })}
          icon={settings.discoverable ? Search : EyeOff}
        />
        <PrivacyToggle
          title="Show my identity when I view"
          description="Discussion and profile owners can see that you viewed their content. Turn this off to appear as a Private viewer on future views."
          checked={settings.show_view_identity}
          disabled={loading || saving}
          onChange={(value) => void updateSettings({ show_view_identity: value })}
          icon={settings.show_view_identity ? Eye : EyeOff}
        />
      </div>

      {message ? <p className="member-privacy-message" role="status">{message}</p> : null}

      <section className="member-follow-requests">
        <div className="member-follow-requests-heading">
          <div>
            <p>Follow approvals</p>
            <h3>{requests.length} pending request{requests.length === 1 ? "" : "s"}</h3>
          </div>
          <UserCheck aria-hidden="true" />
        </div>
        {requests.length ? (
          <div className="member-follow-request-list">
            {requests.map((request) => {
              const profile = request.requester;
              const displayName = profile.full_name?.trim() || profile.username?.trim() || "Loombus member";
              return (
                <article key={request.id} className="member-follow-request">
                  <ProfileAvatar profile={profile} size="sm" />
                  <div className="member-follow-request-copy">
                    <strong>{displayName}</strong>
                    <span>{profile.username ? `@${profile.username}` : "Member request"}</span>
                  </div>
                  <div className="member-follow-request-actions">
                    <button
                      type="button"
                      disabled={workingRequest === request.id}
                      onClick={() => void respondToRequest(request.id, "accept")}
                      aria-label={`Approve ${displayName}`}
                    >
                      <Check aria-hidden="true" /> Approve
                    </button>
                    <button
                      type="button"
                      disabled={workingRequest === request.id}
                      onClick={() => void respondToRequest(request.id, "decline")}
                      aria-label={`Decline ${displayName}`}
                    >
                      <X aria-hidden="true" /> Decline
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="member-follow-requests-empty">No follow requests are waiting.</p>
        )}
      </section>
    </div>,
    mount,
  );
}
