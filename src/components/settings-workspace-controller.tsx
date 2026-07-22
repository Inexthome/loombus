"use client";

import { createPortal } from "react-dom";
import Link from "next/link";
import {
  Bell,
  BookOpen,
  CreditCard,
  Database,
  Eye,
  History,
  Lock,
  Mail,
  MessageCircle,
  Shield,
  Sparkles,
  Trash2,
  User,
  UserCog,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type SectionKey =
  | "account"
  | "profile"
  | "appearance"
  | "data-history"
  | "messages"
  | "notifications"
  | "signal"
  | "topics"
  | "privacy"
  | "blocked-members"
  | "security"
  | "plan"
  | "reference"
  | "account-controls";

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

type BlockedMember = {
  blockId: string;
  blockedAt: string;
  profile: {
    id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
};

const DEFAULTS: Preferences = {
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

const SECTIONS: { key: SectionKey; label: string; icon: typeof User }[] = [
  { key: "account", label: "Account", icon: UserCog },
  { key: "profile", label: "Profile", icon: User },
  { key: "appearance", label: "Appearance", icon: Eye },
  { key: "data-history", label: "Data and history", icon: Database },
  { key: "messages", label: "Messages", icon: MessageCircle },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "signal", label: "Signal delivery", icon: Mail },
  { key: "topics", label: "Topic alerts", icon: Sparkles },
  { key: "privacy", label: "Privacy", icon: Shield },
  { key: "blocked-members", label: "Blocked members", icon: Users },
  { key: "security", label: "Security", icon: Lock },
  { key: "plan", label: "Plan", icon: CreditCard },
  { key: "reference", label: "Reference", icon: BookOpen },
  { key: "account-controls", label: "Account controls", icon: Trash2 },
];

const EXISTING_IDS = new Set([
  "appearance",
  "topics",
  "privacy",
  "security",
  "plan",
  "reference",
  "account-controls",
]);

async function accessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

function Toggle({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
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

function CustomCard({
  id,
  eyebrow,
  title,
  description,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="settings-v2-card settings-workspace-custom-card">
      <div className="settings-v2-card-header">
        <div>
          <p className="settings-v2-eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function BlockedMembersPanel() {
  const [items, setItems] = useState<BlockedMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    const token = await accessToken();
    if (!token) return;
    const response = await fetch("/api/blocks", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({}));
    setItems(Array.isArray(result.items) ? result.items : []);
    setMessage(response.ok ? "" : result.error ?? "Unable to load blocked members.");
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function unblock(item: BlockedMember) {
    if (working) return;
    setWorking(item.profile.id);
    setMessage("");
    const token = await accessToken();
    if (!token) return;
    const response = await fetch("/api/blocks/toggle", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ targetUserId: item.profile.id, desiredState: false }),
    });
    const result = await response.json().catch(() => ({}));
    if (response.ok && result.blocked === false) {
      setItems((current) => current.filter((entry) => entry.profile.id !== item.profile.id));
      setMessage("Member unblocked.");
    } else {
      setMessage(result.error ?? "Unable to unblock this member.");
    }
    setWorking(null);
  }

  if (loading) return <p className="settings-v2-muted">Loading blocked members…</p>;

  return (
    <>
      {message ? <div className="settings-v2-notice">{message}</div> : null}
      {items.length ? (
        <div className="settings-workspace-member-list">
          {items.map((item) => {
            const name = item.profile.full_name?.trim() || item.profile.username || "Loombus member";
            return (
              <article key={item.blockId}>
                <div>
                  <strong>{name}</strong>
                  <span>{item.profile.username ? `@${item.profile.username}` : "Profile unavailable"}</span>
                </div>
                <button
                  type="button"
                  className="settings-v2-secondary-action"
                  disabled={working === item.profile.id}
                  onClick={() => void unblock(item)}
                >
                  {working === item.profile.id ? "Unblocking…" : "Unblock"}
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="settings-v2-section-note">You have not blocked any members.</div>
      )}
      <div className="settings-v2-inline-actions" style={{ marginTop: "1rem" }}>
        <Link href="/blocked-users" className="settings-v2-secondary-action">Open full block manager</Link>
        <button type="button" className="settings-v2-quiet-button" onClick={() => void load()}>Refresh</button>
      </div>
    </>
  );
}

export function SettingsWorkspaceController() {
  const [navTarget, setNavTarget] = useState<HTMLElement | null>(null);
  const [slots, setSlots] = useState<Record<string, HTMLElement>>({});
  const [active, setActive] = useState<SectionKey>("account");
  const [preferences, setPreferences] = useState<Preferences>(DEFAULTS);
  const [canUseEmailDigest, setCanUseEmailDigest] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  const [profileName, setProfileName] = useState("Loombus member");
  const [username, setUsername] = useState("");

  useEffect(() => {
    const query = new URLSearchParams(window.location.search).get("section") as SectionKey | null;
    if (query && SECTIONS.some((section) => section.key === query)) setActive(query);

    let cancelled = false;
    let attempts = 0;
    function prepare() {
      const layout = document.querySelector<HTMLElement>(".settings-v2-layout");
      const oldNav = document.querySelector<HTMLElement>(".settings-v2-nav");
      const main = document.querySelector<HTMLElement>(".settings-v2-main");
      if (!layout || !oldNav || !main) {
        attempts += 1;
        if (!cancelled && attempts < 80) window.setTimeout(prepare, 100);
        return;
      }
      oldNav.hidden = true;
      let navSlot = layout.querySelector<HTMLElement>("[data-settings-workspace-nav]");
      if (!navSlot) {
        navSlot = document.createElement("div");
        navSlot.dataset.settingsWorkspaceNav = "true";
        layout.insertBefore(navSlot, oldNav);
      }
      const nextSlots: Record<string, HTMLElement> = {};
      for (const section of SECTIONS) {
        if (EXISTING_IDS.has(section.key)) continue;
        let slot = main.querySelector<HTMLElement>(`[data-settings-workspace-slot="${section.key}"]`);
        if (!slot) {
          slot = document.createElement("div");
          slot.dataset.settingsWorkspaceSlot = section.key;
          main.appendChild(slot);
        }
        nextSlots[section.key] = slot;
      }
      setNavTarget(navSlot);
      setSlots(nextSlots);
    }
    prepare();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const main = document.querySelector<HTMLElement>(".settings-v2-main");
    if (!main) return;
    main.querySelectorAll<HTMLElement>(".settings-v2-card, [data-settings-workspace-slot]").forEach((element) => {
      const key = element.id || element.dataset.settingsWorkspaceSlot || "";
      element.hidden = key !== active;
    });
    const url = new URL(window.location.href);
    url.searchParams.set("section", active);
    window.history.replaceState({}, "", url);
  }, [active, slots]);

  useEffect(() => {
    let alive = true;
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      setEmail(auth.user.email ?? "");
      const token = await accessToken();
      const [profileResult, preferenceResponse] = await Promise.all([
        supabase.from("profiles").select("full_name, username").eq("id", auth.user.id).maybeSingle(),
        fetch("/api/settings/notification-preferences", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const payload = await preferenceResponse.json().catch(() => ({}));
      if (!alive) return;
      setProfileName(profileResult.data?.full_name?.trim() || profileResult.data?.username || "Loombus member");
      setUsername(profileResult.data?.username ?? "");
      if (preferenceResponse.ok) {
        setPreferences({ ...DEFAULTS, ...(payload.preferences ?? {}) });
        setCanUseEmailDigest(Boolean(payload.canUseEmailDigest));
        setIsAdmin(Boolean(payload.isAdmin));
      }
    }
    void load();
    return () => {
      alive = false;
    };
  }, []);

  const activeLabel = useMemo(
    () => SECTIONS.find((section) => section.key === active)?.label ?? "Settings",
    [active]
  );

  function update<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    setPreferences((current) => ({ ...current, [key]: value }));
    setNotice("");
  }

  async function savePreferences() {
    if (saving) return;
    setSaving(true);
    setNotice("");
    const token = await accessToken();
    const response = await fetch("/api/settings/notification-preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preferences),
    });
    const result = await response.json().catch(() => ({}));
    if (response.ok) {
      setPreferences({ ...DEFAULTS, ...(result.preferences ?? {}) });
      setNotice("Settings saved.");
    } else {
      setNotice(result.error ?? "Unable to save settings.");
    }
    setSaving(false);
  }

  const nav = navTarget
    ? createPortal(
        <nav className="settings-v2-nav settings-workspace-nav" aria-label="Settings sections">
          <div className="settings-workspace-mobile-heading">{activeLabel}</div>
          {SECTIONS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              className={active === key ? "is-active" : ""}
              onClick={() => setActive(key)}
            >
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>,
        navTarget
      )
    : null;

  const account = slots.account
    ? createPortal(
        <CustomCard id="account" eyebrow="Account" title="Your Loombus account" description="Review private account identity and sign-in information.">
          <div className="settings-v2-account-summary">
            <div><span>Member</span><strong>{profileName}</strong></div>
            <div><span>Username</span><strong>{username ? `@${username}` : "Not set"}</strong></div>
            <div><span>Email</span><strong>{email || "Unavailable"}</strong></div>
          </div>
          <p className="settings-v2-muted">Public identity fields are edited in Profile. Password and sign-in protection remain under Security.</p>
        </CustomCard>,
        slots.account
      )
    : null;

  const profile = slots.profile
    ? createPortal(
        <CustomCard id="profile" eyebrow="Profile settings" title="Manage your public identity" description="Profile editing has its own organized workspace and left navigation.">
          <div className="settings-v2-resource-grid">
            <Link href="/profile" className="settings-v2-resource-link"><div><strong>Edit profile</strong><span>Update your avatar, public name, username, bio, perspective, and creator links.</span></div></Link>
            {username ? <Link href={`/u/${username}`} className="settings-v2-resource-link"><div><strong>View public profile</strong><span>See the profile other members can access.</span></div></Link> : null}
          </div>
        </CustomCard>,
        slots.profile
      )
    : null;

  const dataHistory = slots["data-history"]
    ? createPortal(
        <CustomCard id="data-history" eyebrow="Data and history" title="Review your Loombus activity" description="Open the existing private workspaces that contain your discussions, replies, saved items, reading history, and AI usage.">
          <div className="settings-v2-resource-grid">
            <Link href="/my-activity" className="settings-v2-resource-link"><div><strong>My Activity</strong><span>Combined timeline of discussions, replies, saved items, and Signal.</span></div></Link>
            <Link href="/my-discussions" className="settings-v2-resource-link"><div><strong>My Discussions</strong><span>Review discussions you created.</span></div></Link>
            <Link href="/my-replies" className="settings-v2-resource-link"><div><strong>My Replies</strong><span>Review replies you posted.</span></div></Link>
            <Link href="/saved" className="settings-v2-resource-link"><div><strong>Saved Library</strong><span>Bookmarks, private notes, and collections.</span></div></Link>
            <Link href="/reading-history" className="settings-v2-resource-link"><div><strong>Reading History</strong><span>Review and clear recently viewed discussions.</span></div></Link>
            <Link href="/ai-usage" className="settings-v2-resource-link"><div><strong>AI Usage</strong><span>Monthly usage, cached outputs, and recent AI activity.</span></div></Link>
          </div>
          <div className="settings-v2-section-note">Download My Data and account login history are recommended future additions because no complete export or session-history service exists yet.</div>
        </CustomCard>,
        slots["data-history"]
      )
    : null;

  const messages = slots.messages
    ? createPortal(
        <CustomCard id="messages" eyebrow="Messages" title="Private messaging preferences" description="Control message delivery here. Conversation-specific mute, archive, report, and delete actions remain inside Messages.">
          {notice ? <div className="settings-v2-notice">{notice}</div> : null}
          <div className="settings-v2-toggle-list">
            <Toggle label="Private-message push notifications" description="Allow a supported device notification when a mutual connection sends you a private message." checked={preferences.pushMessagesEnabled} onChange={(value) => update("pushMessagesEnabled", value)} />
          </div>
          <div className="settings-v2-savebar"><p>Private messaging is currently limited to mutual followers.</p><button type="button" className="settings-v2-primary-action" disabled={saving} onClick={() => void savePreferences()}>{saving ? "Saving…" : "Save message settings"}</button></div>
          <Link href="/messages" className="settings-v2-secondary-action" style={{ marginTop: "1rem" }}>Open Messages</Link>
        </CustomCard>,
        slots.messages
      )
    : null;

  const notifications = slots.notifications
    ? createPortal(
        <CustomCard id="notifications" eyebrow="Notifications" title="Choose what creates Signal" description="These controls decide which activity appears in your in-app Signal Inbox.">
          {notice ? <div className="settings-v2-notice">{notice}</div> : null}
          <div className="settings-v2-toggle-list">
            <Toggle label="Replies to my discussions" description="Create Signal when someone replies to your discussion." checked={preferences.repliesEnabled} onChange={(value) => update("repliesEnabled", value)} />
            <Toggle label="New followers" description="Create Signal when another member follows you." checked={preferences.followsEnabled} onChange={(value) => update("followsEnabled", value)} />
            <Toggle label="Mentions" description="Create Signal when your identity is mentioned." checked={preferences.mentionsEnabled} onChange={(value) => update("mentionsEnabled", value)} />
            <Toggle label="Followed members: discussions" description="Create Signal when someone you follow publishes a discussion." checked={preferences.followedDiscussionsEnabled} onChange={(value) => update("followedDiscussionsEnabled", value)} />
            <Toggle label="Followed members: replies" description="Optionally create Signal for replies posted by members you follow." checked={preferences.followedRepliesEnabled} onChange={(value) => update("followedRepliesEnabled", value)} />
          </div>
          <div className="settings-v2-savebar"><p>Changes apply after saving.</p><button type="button" className="settings-v2-primary-action" disabled={saving} onClick={() => void savePreferences()}>{saving ? "Saving…" : "Save notification settings"}</button></div>
        </CustomCard>,
        slots.notifications
      )
    : null;

  const signal = slots.signal
    ? createPortal(
        <CustomCard id="signal" eyebrow="Signal delivery" title="Choose how Signal reaches you" description="Configure device delivery and the optional Premium email digest.">
          {notice ? <div className="settings-v2-notice">{notice}</div> : null}
          <div className="settings-v2-toggle-list">
            <Toggle label="Discussion-reply push notifications" description="Send a supported device notification for replies to your discussions." checked={preferences.pushRepliesEnabled} onChange={(value) => update("pushRepliesEnabled", value)} />
            <Toggle label="New-follower push notifications" description="Send a supported device notification when someone follows you." checked={preferences.pushFollowsEnabled} onChange={(value) => update("pushFollowsEnabled", value)} />
            {isAdmin ? <Toggle label="Admin report alerts" description="Send a device notification when a report needs review." checked={preferences.pushAdminReportsEnabled} onChange={(value) => update("pushAdminReportsEnabled", value)} /> : null}
            <Toggle label="Email digest" description={canUseEmailDigest ? "Receive a summarized daily or weekly Signal digest." : "Email digest requires Premium or Admin access."} checked={preferences.emailDigestEnabled} disabled={!canUseEmailDigest} onChange={(value) => update("emailDigestEnabled", value)} />
          </div>
          <label className="settings-v2-field">Digest frequency<select className="settings-v2-select" value={preferences.emailDigestFrequency} disabled={!canUseEmailDigest || !preferences.emailDigestEnabled} onChange={(event) => update("emailDigestFrequency", event.target.value === "daily" ? "daily" : "weekly")}><option value="weekly">Weekly</option><option value="daily">Daily</option></select></label>
          <div className="settings-v2-savebar"><p>Message delivery has its own section.</p><button type="button" className="settings-v2-primary-action" disabled={saving} onClick={() => void savePreferences()}>{saving ? "Saving…" : "Save delivery settings"}</button></div>
        </CustomCard>,
        slots.signal
      )
    : null;

  const blocked = slots["blocked-members"]
    ? createPortal(
        <CustomCard id="blocked-members" eyebrow="Blocked members" title="Manage account boundaries" description="Your block list is private. Unblocking restores normal eligibility but does not recreate follows, messages, or previous interactions.">
          <BlockedMembersPanel />
        </CustomCard>,
        slots["blocked-members"]
      )
    : null;

  return <>{nav}{account}{profile}{dataHistory}{messages}{notifications}{signal}{blocked}</>;
}
