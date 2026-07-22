"use client";

import Link from "next/link";
import { Bell, Mail, MessageCircle, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Preferences = {
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

const defaults: Preferences = {
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

function Toggle({ label, description, checked, disabled = false, onChange }: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className={`settings-v2-toggle-row${disabled ? " is-disabled" : ""}`}>
      <span className="settings-v2-toggle-copy"><strong>{label}</strong><span>{description}</span></span>
      <span className="settings-v2-switch"><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} /><span aria-hidden="true" /></span>
    </label>
  );
}

export function SettingsPreferencePanel({ scope }: { scope: "notifications" | "messages" | "delivery" }) {
  const [preferences, setPreferences] = useState(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [canUseEmailDigest, setCanUseEmailDigest] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return window.location.replace("/login?next=%2Fsettings");
      const response = await fetch("/api/settings/notification-preferences", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!alive) return;
      if (!response.ok) setMessage(result.error ?? "Unable to load these preferences.");
      else {
        setPreferences({ ...defaults, ...(result.preferences ?? {}) });
        setCanUseEmailDigest(Boolean(result.canUseEmailDigest));
        setIsAdmin(Boolean(result.isAdmin));
      }
      setLoading(false);
    }
    void load();
    return () => { alive = false; };
  }, []);

  function update<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    setPreferences((current) => ({ ...current, [key]: value }));
    setMessage("");
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setMessage("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return window.location.replace("/login?next=%2Fsettings");
      const response = await fetch("/api/settings/notification-preferences", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) setMessage(result.error ?? "Unable to save these preferences.");
      else {
        setPreferences({ ...defaults, ...(result.preferences ?? {}) });
        setMessage("Preferences saved.");
      }
    } catch {
      setMessage("Unable to save these preferences. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="settings-v2-section-note">Loading preferences…</div>;

  return (
    <>
      {message ? <div className="settings-v2-notice">{message}</div> : null}
      {scope === "notifications" ? (
        <div className="settings-v2-toggle-list">
<Toggle label="Replies to my discussions" description="Create Signal when someone replies to a discussion you started." checked={preferences.repliesEnabled} onChange={(value) => update("repliesEnabled", value)} />
<Toggle label="New followers" description="Create Signal when another member follows you." checked={preferences.followsEnabled} onChange={(value) => update("followsEnabled", value)} />
<Toggle label="Mentions" description="Create Signal when your member identity is mentioned." checked={preferences.mentionsEnabled} onChange={(value) => update("mentionsEnabled", value)} />
<Toggle label="Followed members: discussions" description="Create Signal for new discussions from people you follow." checked={preferences.followedDiscussionsEnabled} onChange={(value) => update("followedDiscussionsEnabled", value)} />
<Toggle label="Followed members: replies" description="Optionally create Signal for replies posted by people you follow." checked={preferences.followedRepliesEnabled} onChange={(value) => update("followedRepliesEnabled", value)} />
        </div>
      ) : null}

      {scope === "messages" ? (
        <div className="settings-workspace-stack">
<Toggle label="Private-message push alerts" description="Send a device notification when a mutual connection sends you a private message." checked={preferences.pushMessagesEnabled} onChange={(value) => update("pushMessagesEnabled", value)} />
<div className="settings-v2-section-note">Conversation-level mute, archive, report, and delete controls remain inside each private thread.</div>
<Link href="/messages" className="settings-v2-secondary-action"><MessageCircle aria-hidden="true" /> Open Messages</Link>
        </div>
      ) : null}

      {scope === "delivery" ? (
        <div className="settings-v2-preference-grid">
<section className="settings-v2-preference-group">
  <h3><Smartphone aria-hidden="true" /> Device delivery</h3>
  <div className="settings-v2-toggle-list">
    <Toggle label="Discussion replies" description="Send a device alert for replies to your discussions." checked={preferences.pushRepliesEnabled} onChange={(value) => update("pushRepliesEnabled", value)} />
    <Toggle label="New followers" description="Send a device alert when someone follows you." checked={preferences.pushFollowsEnabled} onChange={(value) => update("pushFollowsEnabled", value)} />
    {isAdmin ? <Toggle label="Admin report alerts" description="Send a device alert when a report needs review." checked={preferences.pushAdminReportsEnabled} onChange={(value) => update("pushAdminReportsEnabled", value)} /> : null}
  </div>
</section>
<section className="settings-v2-preference-group">
  <h3><Mail aria-hidden="true" /> Email digest</h3>
  <Toggle label="Email digest" description={canUseEmailDigest ? "Receive a summarized Signal digest by email." : "Email digest requires Premium or Admin access."} checked={preferences.emailDigestEnabled} disabled={!canUseEmailDigest} onChange={(value) => update("emailDigestEnabled", value)} />
  <label className="settings-v2-field">Digest frequency<select className="settings-v2-select" value={preferences.emailDigestFrequency} disabled={!canUseEmailDigest || !preferences.emailDigestEnabled} onChange={(event) => update("emailDigestFrequency", event.target.value === "daily" ? "daily" : "weekly")}><option value="weekly">Weekly</option><option value="daily">Daily</option></select></label>
</section>
        </div>
      ) : null}

      <div className="settings-v2-savebar"><p>Changes take effect after saving.</p><button type="button" className="settings-v2-primary-action" disabled={saving} onClick={() => void save()}><Bell aria-hidden="true" /> {saving ? "Saving…" : "Save preferences"}</button></div>
    </>
  );
}
