"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { Eye, EyeOff, LockKeyhole, Search, UserCheck } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type PrivacySettings = {
  private_account: boolean;
  discoverable: boolean;
  show_view_identity: boolean;
};

const DEFAULTS: PrivacySettings = {
  private_account: false,
  discoverable: true,
  show_view_identity: true,
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
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
      } else if (!privacyResponse.ok) {
        setMessage(privacyPayload.error ?? "Privacy controls could not load.");
      }
      if (requestResponse.ok) {
        setPendingRequestCount(Array.isArray(requestPayload.requests) ? requestPayload.requests.length : 0);
      }
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
    const next = { ...settings, ...patch };
    setSettings(next);
    setSaving(true);
    setMessage("");
    const token = await getToken();
    if (!token) {
      window.location.href = "/login?next=/settings?section=privacy-safety";
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
      setMessage(
        payload.futureDiscussionVisibilityChanged
          ? "Privacy saved. Future Discussions now default to Followers. Existing Discussions were not changed."
          : "Privacy settings saved."
      );
    }
    setSaving(false);
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

      <div className="member-privacy-toggle-list">
        <PrivacyToggle
          title="Private account"
          description="New followers must be approved. Non-followers see a limited profile, and future Discussions move from Public to Followers when needed. Existing Discussions keep their original visibility."
          checked={settings.private_account}
          disabled={loading || saving}
          onChange={(value) => void updateSettings({ private_account: value })}
          icon={LockKeyhole}
        />
        <PrivacyToggle
          title="Appear in People and search"
          description="Allow signed-in Loombus members to find your account in the People directory, Everything Search, and recommendations."
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
            <p>Follow requests</p>
            <h3>{pendingRequestCount} pending request{pendingRequestCount === 1 ? "" : "s"}</h3>
          </div>
          <UserCheck aria-hidden="true" />
        </div>
        <p className="member-follow-requests-empty">
          Approve or decline individual requests from Notifications or People. Settings only controls whether approval is required.
        </p>
        <Link
          href="/people?view=requests&request=received"
          className="settings-v2-secondary-action"
          style={{ marginTop: "0.75rem" }}
        >
          Review follow requests
        </Link>
      </section>
    </div>,
    mount
  );
}
