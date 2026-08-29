"use client";

import { createPortal } from "react-dom";
import Link from "next/link";
import {
  Bell,
  BookOpen,
  CreditCard,
  Database,
  Eye,
  LifeBuoy,
  Lock,
  MessageCircle,
  Shield,
  User,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type SectionKey =
  | "account-security"
  | "profile"
  | "privacy-safety"
  | "messages"
  | "notifications-alerts"
  | "appearance"
  | "subscriptions-billing"
  | "data-activity";

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

type SectionDefinition = {
  key: SectionKey;
  label: string;
  icon: LucideIcon;
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

const SECTIONS: SectionDefinition[] = [
  { key: "account-security", label: "Account & Security", icon: UserCog },
  { key: "profile", label: "Profile & Identity", icon: User },
  { key: "privacy-safety", label: "Privacy & Safety", icon: Shield },
  { key: "messages", label: "Messages", icon: MessageCircle },
  { key: "notifications-alerts", label: "Notifications & Alerts", icon: Bell },
  { key: "appearance", label: "Appearance", icon: Eye },
  { key: "subscriptions-billing", label: "Subscriptions & Billing", icon: CreditCard },
  { key: "data-activity", label: "Data & Activity", icon: Database },
];

const CUSTOM_SECTION_KEYS = new Set<SectionKey>([
  "account-security",
  "profile",
  "privacy-safety",
  "messages",
  "notifications-alerts",
  "data-activity",
]);

const SECTION_VISIBLE_KEYS: Record<SectionKey, string[]> = {
  "account-security": ["account-security", "security", "account-controls"],
  profile: ["profile"],
  "privacy-safety": ["privacy", "privacy-safety"],
  messages: ["messages"],
  "notifications-alerts": ["notifications-alerts", "topics"],
  appearance: ["appearance"],
  "subscriptions-billing": ["plan"],
  "data-activity": ["data-activity"],
};

const LEGACY_SECTION_ALIASES: Record<string, SectionKey> = {
  account: "account-security",
  security: "account-security",
  "account-controls": "account-security",
  profile: "profile",
  privacy: "privacy-safety",
  "blocked-members": "privacy-safety",
  messages: "messages",
  notifications: "notifications-alerts",
  signal: "notifications-alerts",
  topics: "notifications-alerts",
  appearance: "appearance",
  plan: "subscriptions-billing",
  subscriptions: "subscriptions-billing",
  "data-history": "data-activity",
  reference: "account-security",
};

const HELP_LEGAL_LINKS = [
  { href: "/settings/guide", label: "Loombus Guide" },
  { href: "/contact", label: "Support" },
  { href: "/about", label: "About Loombus" },
  { href: "/guidelines", label: "Guidelines" },
  { href: "/terms", label: "Terms" },
  { href: "/cookies", label: "Cookies" },
  { href: "/refunds", label: "Refund Policy" },
  { href: "/dmca", label: "Copyright / DMCA" },
  { href: "/accessibility", label: "Accessibility" },
];

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

function WorkspaceLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link href={href} className="settings-v2-resource-link">
      <div>
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
    </Link>
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
    if (!token) {
      setLoading(false);
      return;
    }
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
    if (!token) {
      setWorking(null);
      return;
    }
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
      setItems((current) =>
        current.filter((entry) => entry.profile.id !== item.profile.id)
      );
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
            const name =
              item.profile.full_name?.trim() ||
              item.profile.username ||
              "Loombus member";
            return (
              <article key={item.blockId}>
                <div>
                  <strong>{name}</strong>
                  <span>
                    {item.profile.username
                      ? `@${item.profile.username}`
                      : "Profile unavailable"}
                  </span>
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
        <Link href="/blocked-users" className="settings-v2-secondary-action">
          Open full block manager
        </Link>
        <button
          type="button"
          className="settings-v2-quiet-button"
          onClick={() => void load()}
        >
          Refresh
        </button>
      </div>
    </>
  );
}

function normalizeRequestedSection(value: string | null): SectionKey | null {
  if (!value) return null;
  if (SECTIONS.some((section) => section.key === value)) return value as SectionKey;
  return LEGACY_SECTION_ALIASES[value] ?? null;
}

export function SettingsWorkspaceController() {
  const [navTarget, setNavTarget] = useState<HTMLElement | null>(null);
  const [slots, setSlots] = useState<Record<string, HTMLElement>>({});
  const [active, setActive] = useState<SectionKey>("account-security");
  const [preferences, setPreferences] = useState<Preferences>(DEFAULTS);
  const [canUseEmailDigest, setCanUseEmailDigest] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  const [profileName, setProfileName] = useState("Loombus member");
  const [username, setUsername] = useState("");

  useEffect(() => {
    const requested = normalizeRequestedSection(
      new URLSearchParams(window.location.search).get("section")
    );
    if (requested) setActive(requested);

    let cancelled = false;
    let attempts = 0;

    function placeSlot(
      main: HTMLElement,
      slot: HTMLElement,
      key: SectionKey
    ) {
      if (key === "account-security") {
        const security = main.querySelector<HTMLElement>("#security");
        if (security) {
          main.insertBefore(slot, security);
          return;
        }
      }
      if (key === "notifications-alerts") {
        const topics = main.querySelector<HTMLElement>("#topics");
        if (topics) {
          main.insertBefore(slot, topics);
          return;
        }
      }
      if (key === "privacy-safety") {
        const privacy = main.querySelector<HTMLElement>("#privacy");
        if (privacy) {
          privacy.after(slot);
          return;
        }
      }
      main.appendChild(slot);
    }

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
        if (!CUSTOM_SECTION_KEYS.has(section.key)) continue;
        let slot = main.querySelector<HTMLElement>(
          `[data-settings-workspace-slot="${section.key}"]`
        );
        if (!slot) {
          slot = document.createElement("div");
          slot.dataset.settingsWorkspaceSlot = section.key;
          placeSlot(main, slot, section.key);
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

    const visible = new Set(SECTION_VISIBLE_KEYS[active]);
    main
      .querySelectorAll<HTMLElement>(".settings-v2-card, [data-settings-workspace-slot]")
      .forEach((element) => {
        const key = element.id || element.dataset.settingsWorkspaceSlot || "";
        element.hidden = !visible.has(key);
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
        supabase
          .from("profiles")
          .select("full_name, username")
          .eq("id", auth.user.id)
          .maybeSingle(),
        fetch("/api/settings/notification-preferences", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const payload = await preferenceResponse.json().catch(() => ({}));
      if (!alive) return;

      setProfileName(
        profileResult.data?.full_name?.trim() ||
          profileResult.data?.username ||
          "Loombus member"
      );
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
    if (!token) {
      setSaving(false);
      window.location.href = "/login?next=/settings";
      return;
    }

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
      setCanUseEmailDigest(Boolean(result.canUseEmailDigest));
      setNotice("Settings saved.");
    } else {
      setNotice(result.error ?? "Unable to save settings.");
    }
    setSaving(false);
  }

  const nav = navTarget
    ? createPortal(
        <nav
          className="settings-v2-nav settings-workspace-nav"
          aria-label="Settings sections"
        >
          <div className="settings-workspace-mobile-heading">{activeLabel}</div>
          {SECTIONS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              className={active === key ? "is-active" : ""}
              aria-current={active === key ? "page" : undefined}
              onClick={() => setActive(key)}
            >
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}

          <details className="settings-workspace-help">
            <summary>
              <LifeBuoy aria-hidden="true" />
              <span>Help & Legal</span>
            </summary>
            <div>
              {HELP_LEGAL_LINKS.map((item) => (
                <Link key={item.href} href={item.href}>
                  {item.label}
                </Link>
              ))}
            </div>
          </details>
        </nav>,
        navTarget
      )
    : null;

  const accountSecurity = slots["account-security"]
    ? createPortal(
        <CustomCard
          id="account-security"
          eyebrow="Account & security"
          title="Your Loombus account"
          description="Review private account identity, enforcement decisions, sign-in protection, and account lifecycle controls in one place."
        >
          <div className="settings-v2-account-summary">
            <div>
              <span>Member</span>
              <strong>{profileName}</strong>
            </div>
            <div>
              <span>Username</span>
              <strong>{username ? `@${username}` : "Not set"}</strong>
            </div>
            <div>
              <span>Email</span>
              <strong>{email || "Unavailable"}</strong>
            </div>
          </div>
          <div className="settings-v2-resource-grid" style={{ marginTop: "1rem" }}>
            <WorkspaceLink
              href="/account/enforcement"
              title="Account decisions & appeals"
              description="Review enforcement decisions and submit an appeal when available."
            />
          </div>
          <p className="settings-v2-muted">
            Password, sign-in method, deactivation, and deletion controls continue below.
          </p>
        </CustomCard>,
        slots["account-security"]
      )
    : null;

  const profile = slots.profile
    ? createPortal(
        <CustomCard
          id="profile"
          eyebrow="Profile & identity"
          title="Manage your public Loombus identity"
          description="Public identity editing stays in the dedicated Profile workspace; account access and notification preferences remain in Settings."
        >
          <div className="settings-v2-resource-grid">
            <WorkspaceLink
              href="/profile"
              title="Edit profile"
              description="Update your avatar, public name, username, bio, perspective, creator presence, viewers, and sharing."
            />
            {username ? (
              <WorkspaceLink
                href={`/u/${username}`}
                title="View public profile"
                description="See the profile that other members can access."
              />
            ) : null}
          </div>
        </CustomCard>,
        slots.profile
      )
    : null;

  const privacySafety = slots["privacy-safety"]
    ? createPortal(
        <CustomCard
          id="privacy-safety"
          eyebrow="Privacy & safety"
          title="Blocked members and safety boundaries"
          description="Member privacy, discovery, viewer identity, follow approvals, and future Discussion visibility are managed above. Blocking belongs to the same privacy boundary."
        >
          <BlockedMembersPanel />
          <div className="settings-v2-resource-grid" style={{ marginTop: "1rem" }}>
            <WorkspaceLink
              href="/privacy"
              title="Privacy policy"
              description="Review how account, platform, AI, and usage information is handled."
            />
            <WorkspaceLink
              href="/safety"
              title="Safety controls"
              description="Review reporting, enforcement, blocking, and member protections."
            />
          </div>
        </CustomCard>,
        slots["privacy-safety"]
      )
    : null;

  const messages = slots.messages
    ? createPortal(
        <CustomCard
          id="messages"
          eyebrow="Messages"
          title="Private messaging preferences"
          description="Control message delivery here. Conversation-specific mute, archive, report, and delete actions remain inside Messages."
        >
          {notice ? <div className="settings-v2-notice">{notice}</div> : null}
          <div className="settings-v2-toggle-list">
            <Toggle
              label="Private-message push notifications"
              description="Allow a supported device notification when a mutual connection sends you a private message."
              checked={preferences.pushMessagesEnabled}
              onChange={(value) => update("pushMessagesEnabled", value)}
            />
          </div>
          <div className="settings-v2-savebar">
            <p>Private messaging is currently limited to mutual followers.</p>
            <button
              type="button"
              className="settings-v2-primary-action"
              disabled={saving}
              onClick={() => void savePreferences()}
            >
              {saving ? "Saving…" : "Save message settings"}
            </button>
          </div>
          <Link
            href="/messages"
            className="settings-v2-secondary-action"
            style={{ marginTop: "1rem" }}
          >
            Open Messages
          </Link>
        </CustomCard>,
        slots.messages
      )
    : null;

  const notificationsAlerts = slots["notifications-alerts"]
    ? createPortal(
        <CustomCard
          id="notifications-alerts"
          eyebrow="Notifications & alerts"
          title="Choose what becomes Signal and how it reaches you"
          description="In-app Signal, device delivery, email digest, and topic alerts now share one settings area. Private-message delivery remains under Messages."
        >
          {notice ? <div className="settings-v2-notice">{notice}</div> : null}

          <section className="settings-v2-preference-group">
            <h3>In-app Signal</h3>
            <p>Choose the activity shown in your Loombus Signal Inbox.</p>
            <div className="settings-v2-toggle-list">
              <Toggle
                label="Replies to my discussions"
                description="Create Signal when someone replies to your discussion."
                checked={preferences.repliesEnabled}
                onChange={(value) => update("repliesEnabled", value)}
              />
              <Toggle
                label="New followers"
                description="Create Signal when another member follows you."
                checked={preferences.followsEnabled}
                onChange={(value) => update("followsEnabled", value)}
              />
              <Toggle
                label="Mentions"
                description="Create Signal when your member identity is mentioned."
                checked={preferences.mentionsEnabled}
                onChange={(value) => update("mentionsEnabled", value)}
              />
              <Toggle
                label="Followed members: discussions"
                description="Create Signal when someone you follow publishes a discussion."
                checked={preferences.followedDiscussionsEnabled}
                onChange={(value) => update("followedDiscussionsEnabled", value)}
              />
              <Toggle
                label="Followed members: replies"
                description="Optionally create Signal for replies posted by members you follow."
                checked={preferences.followedRepliesEnabled}
                onChange={(value) => update("followedRepliesEnabled", value)}
              />
            </div>
          </section>

          <section className="settings-v2-preference-group" style={{ marginTop: "0.8rem" }}>
            <h3>Push notifications</h3>
            <p>Choose which non-message activity can reach a supported device.</p>
            <div className="settings-v2-toggle-list">
              <Toggle
                label="Discussion replies"
                description="Send a device notification for replies to your discussions."
                checked={preferences.pushRepliesEnabled}
                onChange={(value) => update("pushRepliesEnabled", value)}
              />
              <Toggle
                label="New followers"
                description="Send a device notification when someone follows you."
                checked={preferences.pushFollowsEnabled}
                onChange={(value) => update("pushFollowsEnabled", value)}
              />
              {isAdmin ? (
                <Toggle
                  label="Admin report alerts"
                  description="Send a device notification when a report needs review."
                  checked={preferences.pushAdminReportsEnabled}
                  onChange={(value) => update("pushAdminReportsEnabled", value)}
                />
              ) : null}
            </div>
          </section>

          <section className="settings-v2-preference-group" style={{ marginTop: "0.8rem" }}>
            <h3>Email digest</h3>
            <p>Premium and Admin accounts can receive a daily or weekly Signal summary.</p>
            <Toggle
              label="Email digest"
              description={
                canUseEmailDigest
                  ? "Receive a summarized Signal digest by email."
                  : "Email digest requires Premium or Admin access."
              }
              checked={preferences.emailDigestEnabled}
              disabled={!canUseEmailDigest}
              onChange={(value) => update("emailDigestEnabled", value)}
            />
            <label className="settings-v2-field">
              Digest frequency
              <select
                className="settings-v2-select"
                value={preferences.emailDigestFrequency}
                disabled={!canUseEmailDigest || !preferences.emailDigestEnabled}
                onChange={(event) =>
                  update(
                    "emailDigestFrequency",
                    event.target.value === "daily" ? "daily" : "weekly"
                  )
                }
              >
                <option value="weekly">Weekly</option>
                <option value="daily">Daily</option>
              </select>
            </label>
          </section>

          <div className="settings-v2-savebar">
            <p>Topic-alert selection continues directly below in this same section.</p>
            <div className="settings-v2-inline-actions">
              <Link href="/notifications" className="settings-v2-secondary-action">
                Open Signal Inbox
              </Link>
              <button
                type="button"
                className="settings-v2-primary-action"
                disabled={saving}
                onClick={() => void savePreferences()}
              >
                {saving ? "Saving…" : "Save notification settings"}
              </button>
            </div>
          </div>
        </CustomCard>,
        slots["notifications-alerts"]
      )
    : null;

  const dataActivity = slots["data-activity"]
    ? createPortal(
        <CustomCard
          id="data-activity"
          eyebrow="Data & activity"
          title="Review your Loombus activity"
          description="Open the existing private workspaces that contain your discussions, replies, saved items, reading history, and AI usage."
        >
          <div className="settings-v2-resource-grid">
            <WorkspaceLink
              href="/my-activity"
              title="My Activity"
              description="Combined timeline of discussions, replies, saved items, and Signal."
            />
            <WorkspaceLink
              href="/my-discussions"
              title="My Discussions"
              description="Review discussions you created."
            />
            <WorkspaceLink
              href="/my-replies"
              title="My Replies"
              description="Review replies you posted."
            />
            <WorkspaceLink
              href="/saved"
              title="Saved items"
              description="Review bookmarks, private notes, and collections."
            />
            <WorkspaceLink
              href="/reading-history"
              title="Reading History"
              description="Review and clear recently viewed discussions."
            />
            <WorkspaceLink
              href="/ai-usage"
              title="AI Usage"
              description="Review monthly usage, cached outputs, and recent AI activity."
            />
          </div>
          <div className="settings-v2-section-note">
            Download My Data and account login history remain recommended future additions because no complete export or session-history service exists yet.
          </div>
        </CustomCard>,
        slots["data-activity"]
      )
    : null;

  return (
    <>
      {nav}
      {accountSecurity}
      {profile}
      {privacySafety}
      {messages}
      {notificationsAlerts}
      {dataActivity}
    </>
  );
}
