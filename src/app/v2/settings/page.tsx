"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Archive,
  Bell,
  BookOpen,
  ChevronRight,
  Circle,
  Clock,
  CreditCard,
  Database,
  Download,
  Eye,
  FileText,
  Laptop,
  Lock,
  LogOut,
  Mail,
  MessageCircle,
  MessageSquare,
  Moon,
  Monitor,
  Paintbrush,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Smartphone,
  Sun,
  ToggleLeft,
  ToggleRight,
  UserRound,
  Users,
  Volume2,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import {
  getDefaultShellPayload,
  V2ShellGateCard,
  V2ShellMobileNav,
  V2ShellTopNav,
  type ShellPayload,
} from "../v2-shell-components";
import {
  getStoredV2Appearance,
  setV2AppearancePreference,
  V2_APPEARANCE_OPTIONS,
  type V2AppearanceTheme,
} from "../v2-appearance";

type SettingsSection = "account" | "profile" | "notifications" | "appearance" | "messages" | "security" | "data";

type SettingsNavItem = {
  id: SettingsSection;
  label: string;
  icon: LucideIcon;
};

type ProfileRow = {
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type ConnectedAccount = {
  id: string;
  label: string;
  email: string;
  status: string;
  mark: string;
  tone: string;
};

type DeviceSession = {
  label: string;
  detail: string;
  time: string;
  active: boolean;
  icon: LucideIcon;
};

type StatusItem = {
  label: string;
  value: string;
  icon: LucideIcon;
};

type ToggleSetting = {
  key: string;
  label: string;
  detail: string;
  icon: LucideIcon;
};

type ActionSetting = {
  label: string;
  detail: string;
  value?: string;
  icon: LucideIcon;
  href?: string;
};

const SETTINGS_NAV: SettingsNavItem[] = [
  { id: "account", label: "Account", icon: Users },
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "appearance", label: "Appearance", icon: Paintbrush },
  { id: "messages", label: "Messages", icon: Mail },
  { id: "security", label: "Security", icon: Shield },
  { id: "data", label: "Data & History", icon: Database },
];

const NOTIFICATION_SETTINGS: ToggleSetting[] = [
  { key: "tags", label: "Tags", detail: "Notify me when a tag I follow has new activity.", icon: Bell },
  { key: "comments", label: "Comments and replies", detail: "Notify me about replies to my discussions and replies.", icon: MessageCircle },
  { key: "reminders", label: "Reminders", detail: "Send reminders for saved items, drafts, and conversations to revisit.", icon: Clock },
  { key: "follower_updates", label: "Updates from followers", detail: "Notify me when people I follow post or reply.", icon: Users },
  { key: "follower_requests", label: "Follower requests", detail: "Notify me when someone requests to follow or connect.", icon: UserRound },
  { key: "rooms", label: "Rooms", detail: "Notify me about room invites, mentions, and activity.", icon: MessageSquare },
  { key: "product_updates", label: "Loombus updates", detail: "Receive product, safety, and platform update notices.", icon: Bell },
];

const MESSAGE_SETTINGS: ToggleSetting[] = [
  { key: "message_sounds", label: "Message sounds", detail: "Play a sound when a new message arrives.", icon: Volume2 },
  { key: "message_popups", label: "Pop-up new messages", detail: "Show an in-app pop-up for new private messages.", icon: MessageSquare },
  { key: "active_status", label: "Active status", detail: "Let mutual connections see when you are active.", icon: Eye },
  { key: "message_requests", label: "Message requests", detail: "Allow non-mutual message requests to enter a review queue.", icon: Mail },
  { key: "archive_chats", label: "Archive chats", detail: "Keep archived conversations out of the main inbox.", icon: Archive },
  { key: "block_settings", label: "Block settings", detail: "Apply message blocking rules to restricted accounts.", icon: Shield },
  { key: "restricted_accounts", label: "Restricted accounts", detail: "Limit message visibility from accounts you restrict.", icon: Lock },
];

const SECURITY_SETTINGS: ToggleSetting[] = [
  { key: "login_alerts", label: "Login alerts", detail: "Notify me when a new session signs in.", icon: ShieldCheck },
  { key: "two_factor", label: "Two-factor authentication", detail: "Require an extra verification step when available.", icon: Lock },
  { key: "trusted_devices", label: "Trusted devices", detail: "Remember trusted browsers and mobile devices.", icon: Laptop },
  { key: "visibility_guard", label: "Privacy guard", detail: "Review profile and activity visibility before changing public settings.", icon: Eye },
];

const DATA_SETTINGS: ToggleSetting[] = [
  { key: "reading_history", label: "Reading history", detail: "Keep a private history of discussions you opened.", icon: BookOpen },
  { key: "search_history", label: "Search history", detail: "Use recent searches to make Loombus easier to navigate.", icon: Search },
  { key: "saved_history", label: "Saved item history", detail: "Remember when items were saved or moved between folders.", icon: Database },
  { key: "activity_timeline", label: "Activity timeline", detail: "Keep a private activity timeline for discussions, replies, and saves.", icon: Clock },
];

const SECTION_COPY: Record<SettingsSection, { eyebrow: string; title: string; description: string }> = {
  account: {
    eyebrow: "Account",
    title: "Account settings",
    description: "Manage your membership, account access, permissions, and sign-in controls from one place.",
  },
  profile: {
    eyebrow: "Profile",
    title: "Profile settings",
    description: "Review the public identity connected to your Loombus account.",
  },
  notifications: {
    eyebrow: "Notifications",
    title: "Notification settings",
    description: "Choose what alerts Loombus can send you. This stays inside Settings and does not open the notifications inbox.",
  },
  appearance: {
    eyebrow: "Appearance",
    title: "Appearance",
    description: "Choose only Light, Dark, or System for Loombus V2.",
  },
  messages: {
    eyebrow: "Messages",
    title: "Message settings",
    description: "Control message behavior without opening the messages inbox.",
  },
  security: {
    eyebrow: "Security",
    title: "Security settings",
    description: "Review sign-in, password, device, and account protection settings from here.",
  },
  data: {
    eyebrow: "Data & History",
    title: "Data & history settings",
    description: "Control reading history, search history, activity history, and data requests without opening Reading History.",
  },
};

function asString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function getInitial(profile: ProfileRow | null, user: User | null) {
  const label = profile?.full_name?.trim() || profile?.username?.trim() || user?.email?.trim() || "L";
  return label.slice(0, 1).toUpperCase();
}

function getDisplayName(profile: ProfileRow | null, user: User | null) {
  return profile?.full_name?.trim() || profile?.username?.trim() || user?.email?.split("@")[0] || "Loombus member";
}

function formatRelativeTime(value: string | null | undefined) {
  if (!value) return "Recently";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Recently";
  const diffMinutes = Math.floor((Date.now() - timestamp) / 60000);
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(timestamp));
}

function normalizeProviderName(provider: string) {
  if (provider === "azure") return "Microsoft";
  return provider.slice(0, 1).toUpperCase() + provider.slice(1);
}

function getProviderTone(provider: string) {
  const value = provider.toLowerCase();
  if (value.includes("google")) return "bg-blue-50 text-blue-700";
  if (value.includes("apple")) return "bg-slate-100 text-slate-900";
  if (value.includes("azure") || value.includes("microsoft")) return "bg-amber-50 text-amber-700";
  return "bg-violet-50 text-violet-700";
}

function getConnectedAccounts(user: User | null): ConnectedAccount[] {
  const accounts: ConnectedAccount[] = [];

  if (user?.email) {
    accounts.push({
      id: "email",
      label: "Email sign-in",
      email: user.email,
      status: user.email_confirmed_at ? "Verified" : "Needs verification",
      mark: "@",
      tone: "bg-blue-50 text-blue-700",
    });
  }

  for (const identity of user?.identities ?? []) {
    const provider = identity.provider || "provider";
    const email = asString((identity.identity_data as Record<string, unknown> | undefined)?.email, user?.email ?? "Connected account");
    accounts.push({
      id: identity.id ?? provider,
      label: `${normalizeProviderName(provider)} provider`,
      email,
      status: "Connected",
      mark: normalizeProviderName(provider).slice(0, 1),
      tone: getProviderTone(provider),
    });
  }

  return accounts;
}

function formatPlanLabel(value: string | null) {
  if (!value) return "Free";
  const clean = value.replaceAll("_", " ").replaceAll("-", " ").trim();
  return clean.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function fetchCurrentPlan(user: User | null) {
  if (!user) return "Free";

  const metadataPlan =
    asString(user.app_metadata?.subscription_tier) ||
    asString(user.app_metadata?.tier) ||
    asString(user.user_metadata?.subscription_tier) ||
    asString(user.user_metadata?.plan);

  try {
    const { data, error } = await supabase
      .from("user_ai_entitlements")
      .select("tier, ai_assisted_enabled")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!error && data) {
      const row = data as { tier?: string | null; ai_assisted_enabled?: boolean | null };
      return formatPlanLabel(row.tier ?? metadataPlan ?? "Free");
    }
  } catch {
    // Keep settings safe if the entitlement table is unavailable in a given environment.
  }

  return formatPlanLabel(metadataPlan || "Free");
}

function SettingsSidebar({ selected, onSelect, onSignOut }: { selected: SettingsSection; onSelect: (section: SettingsSection) => void; onSignOut: () => void }) {
  return (
    <aside className="hidden w-60 shrink-0 rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm lg:flex lg:flex-col lg:justify-between">
      <div>
        <h2 className="mb-7 text-2xl font-black text-slate-950">Settings</h2>
        <nav className="space-y-2">
          {SETTINGS_NAV.map((item) => {
            const Icon = item.icon;
            const active = selected === item.id;
            return (
              <button key={item.id} type="button" onClick={() => onSelect(item.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold transition ${active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-blue-50 hover:text-blue-700"}`}>
                <Icon className="size-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>
      <div className="space-y-3 border-t border-slate-100 pt-4">
        <Link href="/v2/support" className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-blue-50 hover:text-blue-700">
          <MessageCircle className="size-4" />
          Give Feedback
        </Link>
        <button type="button" onClick={onSignOut} className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black text-red-600 transition hover:bg-red-50">
          <LogOut className="size-4" />
          Log out
        </button>
      </div>
    </aside>
  );
}

function MobileSettingsSummary({ profile, user, selected, onSelect }: { profile: ProfileRow | null; user: User | null; selected: SettingsSection; onSelect: (section: SettingsSection) => void }) {
  return (
    <section className="space-y-4 lg:hidden">
      <button type="button" onClick={() => onSelect("profile")} className="flex w-full items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm">
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="size-14 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-amber-50 text-lg font-black text-amber-800">{getInitial(profile, user)}</span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-black text-slate-950">{getDisplayName(profile, user)}</h2>
          <p className="truncate text-xs font-semibold text-slate-500">{user?.email ?? "Signed-in account"}</p>
        </div>
        <ChevronRight className="size-5 text-blue-700" />
      </button>
      <div className="grid gap-2">
        {SETTINGS_NAV.map((item) => {
          const Icon = item.icon;
          const active = selected === item.id;
          return (
            <button key={item.id} type="button" onClick={() => onSelect(item.id)} className={`flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-black shadow-sm ${active ? "text-blue-700" : "text-slate-700"}`}>
              <span className="inline-flex items-center gap-3"><Icon className="size-4" />{item.label}</span>
              <ChevronRight className="size-4" />
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ThemeCard({ option, selected, onSelect }: { option: (typeof V2_APPEARANCE_OPTIONS)[number]; selected: boolean; onSelect: () => void }) {
  const Icon = option.key === "light" ? Sun : option.key === "dark" ? Moon : Monitor;

  return (
    <button type="button" onClick={onSelect} className={`relative min-h-[128px] rounded-2xl border p-5 text-center transition ${selected ? "border-zinc-900 bg-zinc-50 shadow-sm ring-1 ring-zinc-200" : "border-slate-200 bg-white hover:border-zinc-300 hover:bg-zinc-50"}`}>
      <Icon className="mx-auto size-8 text-slate-800" />
      <h3 className="mt-3 text-sm font-black text-slate-950">{option.label}</h3>
      <p className="mx-auto mt-2 max-w-[150px] text-xs font-semibold leading-5 text-slate-500">{option.description}</p>
      <span className="absolute bottom-4 left-4">
        {selected ? <span className="grid size-4 place-items-center rounded-full bg-zinc-900"><span className="size-1.5 rounded-full bg-white" /></span> : <Circle className="size-4 text-slate-300" />}
      </span>
    </button>
  );
}

function ToggleRow({ setting, enabled, onToggle }: { setting: ToggleSetting; enabled: boolean; onToggle: () => void }) {
  const Icon = setting.icon;
  return (
    <button type="button" onClick={onToggle} className="flex w-full items-center gap-4 border-b border-slate-100 py-4 text-left last:border-0">
      <Icon className="size-5 shrink-0 text-blue-700" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-black text-slate-950">{setting.label}</span>
        <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">{setting.detail}</span>
      </span>
      {enabled ? <ToggleRight className="size-9 shrink-0 text-blue-600" /> : <ToggleLeft className="size-9 shrink-0 text-slate-300" />}
    </button>
  );
}

function ActionRow({ item }: { item: ActionSetting }) {
  const Icon = item.icon;
  const content = (
    <article className="flex items-center gap-4 border-b border-slate-100 py-4 last:border-0">
      <Icon className="size-5 shrink-0 text-blue-700" />
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-black text-slate-950">{item.label}</h3>
        <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{item.detail}</p>
      </div>
      {item.value && <span className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-black text-slate-600">{item.value}</span>}
      {item.href && <ChevronRight className="size-4 text-blue-700" />}
    </article>
  );

  if (!item.href) return content;
  return <Link href={item.href}>{content}</Link>;
}

function ConnectedAccountRow({ account }: { account: ConnectedAccount }) {
  return (
    <article className="flex items-center gap-4 border-b border-slate-100 py-4 last:border-0">
      <span className={`grid size-8 shrink-0 place-items-center rounded-lg text-sm font-black ${account.tone}`}>{account.mark}</span>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-black text-slate-950">{account.label}</h3>
        <p className="truncate text-xs font-semibold text-slate-500">{account.email}</p>
      </div>
      <span className="rounded-lg bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{account.status}</span>
    </article>
  );
}

function DeviceSessionsCard({ user }: { user: User | null }) {
  const sessions: DeviceSession[] = user
    ? [{ label: "Current browser session", detail: user.email ?? "Signed-in account", time: formatRelativeTime(user.last_sign_in_at), active: true, icon: Laptop }]
    : [];

  return (
    <section className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-black text-slate-950">Device Sessions</h2>
      <p className="mt-1 text-xs font-semibold text-slate-500">Current session data available to Loombus.</p>
      <div className="mt-4 divide-y divide-slate-100">
        {sessions.map((device) => {
          const Icon = device.icon;
          return (
            <article key={device.label} className="flex items-center gap-3 py-4">
              <Icon className="size-5 shrink-0 text-blue-700" />
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-black text-slate-950">{device.label}</h3>
                <p className="truncate text-xs font-semibold text-slate-500">{device.detail} · {device.time}</p>
              </div>
              <span className="rounded-lg bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">Active</span>
            </article>
          );
        })}
        {sessions.length === 0 && <p className="py-4 text-sm font-semibold text-slate-500">No active session data available.</p>}
      </div>
    </section>
  );
}

function AccountStatusCard({ payload, user, appearance, plan }: { payload: ShellPayload | null; user: User | null; appearance: V2AppearanceTheme; plan: string }) {
  const items: StatusItem[] = [
    { label: "Account session", value: user ? "Active" : "Unavailable", icon: ShieldCheck },
    { label: "Current plan", value: plan, icon: CreditCard },
    { label: "Appearance", value: V2_APPEARANCE_OPTIONS.find((option) => option.key === appearance)?.label ?? appearance, icon: Paintbrush },
    { label: "V2 shell", value: payload?.flags.v2_shell && payload.version === "v2" ? "Enabled" : "Unavailable", icon: Settings },
  ];

  return (
    <section className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-black text-slate-950">Account Status</h2>
      <p className="mt-1 text-xs font-semibold text-slate-500">Live values from your current account session.</p>
      <div className="mt-4 divide-y divide-slate-100">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.label} className="flex items-center gap-3 py-3">
              <Icon className="size-5 shrink-0 text-emerald-600" />
              <h3 className="min-w-0 flex-1 text-sm font-black text-slate-950">{item.label}</h3>
              <span className="text-xs font-semibold text-slate-500">{item.value}</span>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function SettingsPanel({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-black text-slate-950">{title}</h2>
      {description && <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>}
      <div className="mt-4 divide-y divide-slate-100">{children}</div>
    </section>
  );
}

export default function V2SettingsPage() {
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [appearance, setAppearance] = useState<V2AppearanceTheme>("system");
  const [selectedSection, setSelectedSection] = useState<SettingsSection>("account");
  const [currentPlan, setCurrentPlan] = useState("Free");
  const [notificationSettings, setNotificationSettings] = useState<Record<string, boolean>>({
    tags: true,
    comments: true,
    reminders: true,
    follower_updates: true,
    follower_requests: true,
    rooms: true,
    product_updates: true,
  });
  const [messageSettings, setMessageSettings] = useState<Record<string, boolean>>({
    message_sounds: true,
    message_popups: true,
    active_status: true,
    message_requests: true,
    archive_chats: true,
    block_settings: true,
    restricted_accounts: false,
  });
  const [securitySettings, setSecuritySettings] = useState<Record<string, boolean>>({
    login_alerts: true,
    two_factor: false,
    trusted_devices: true,
    visibility_guard: true,
  });
  const [dataSettings, setDataSettings] = useState<Record<string, boolean>>({
    reading_history: true,
    search_history: true,
    saved_history: true,
    activity_timeline: true,
  });

  const connectedAccounts = useMemo(() => getConnectedAccounts(user), [user]);
  const sectionCopy = SECTION_COPY[selectedSection];

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function handleAppearanceChange(theme: V2AppearanceTheme) {
    setAppearance(theme);
    setV2AppearancePreference(theme);
  }

  async function loadShell() {
    setLoading(true);
    setMessage("");

    try {
      setAppearance(getStoredV2Appearance());
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const currentUser = data.session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        const [{ data: profileData }, plan] = await Promise.all([
          supabase.from("profiles").select("full_name, username, avatar_url").eq("id", currentUser.id).maybeSingle(),
          fetchCurrentPlan(currentUser),
        ]);
        setProfile((profileData as ProfileRow | null) ?? null);
        setCurrentPlan(plan);
      } else {
        setProfile(null);
        setCurrentPlan("Free");
      }

      const response = await fetch("/api/v2/shell", {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      const nextPayload = (await response.json().catch(() => getDefaultShellPayload())) as ShellPayload;
      setPayload(nextPayload);

      const shellTheme = (nextPayload as ShellPayload & { preferences?: { appearance_theme?: V2AppearanceTheme } }).preferences?.appearance_theme;
      if (shellTheme && V2_APPEARANCE_OPTIONS.some((option) => option.key === shellTheme)) {
        setAppearance(shellTheme);
      }
    } catch {
      setPayload(getDefaultShellPayload());
      setMessage("Unable to verify V2 shell access. Current Loombus remains available.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadShell();
    const { data } = supabase.auth.onAuthStateChange(() => loadShell());
    return () => data.subscription.unsubscribe();
  }, []);

  if (loading) return <V2ShellGateCard title="Loading Settings" message="Loombus is verifying access before loading V2 Settings." loading />;
  if (message) return <V2ShellGateCard title="V2 shell check failed safely" message={message} payload={payload} />;
  if (!payload?.authenticated) return <V2ShellGateCard title="Sign in required" message="Sign in first so Loombus can verify V2 Settings access." payload={payload} />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") return <V2ShellGateCard title="V2 shell is not enabled" message="This account is not currently allowed through the v2_shell flag. Public users remain on V1." payload={payload} />;

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7f7f8] loombus-v2-page-bg text-slate-950">
      <V2ShellTopNav />
      <section className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)_320px]">
          <SettingsSidebar selected={selectedSection} onSelect={setSelectedSection} onSignOut={handleSignOut} />

          <section className="min-w-0 space-y-5">
            <header>
              <p className="mb-2 text-xs font-black uppercase tracking-[0.32em] text-blue-700">{sectionCopy.eyebrow}</p>
              <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl lg:text-2xl">{sectionCopy.title}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{sectionCopy.description}</p>
            </header>

            <MobileSettingsSummary profile={profile} user={user} selected={selectedSection} onSelect={setSelectedSection} />

            {selectedSection === "account" && (
              <>
                <SettingsPanel title="Subscriptions" description="Only your current subscribed plan is shown here.">
                  <ActionRow item={{ label: "Current plan", detail: "The membership currently attached to this account.", value: currentPlan, icon: CreditCard }} />
                </SettingsPanel>
                <SettingsPanel title="Manage account">
                  <ActionRow item={{ label: "Account email", detail: user?.email ?? "Signed-in email unavailable.", value: user?.email_confirmed_at ? "Verified" : "Needs verification", icon: Mail }} />
                  <ActionRow item={{ label: "Manage profile", detail: "Update public profile fields and avatar.", href: "/v2/profile", icon: UserRound }} />
                  <ActionRow item={{ label: "Permissions", detail: "Review account permissions, app access, and connected providers.", value: `${connectedAccounts.length} connected`, icon: ShieldCheck }} />
                  <ActionRow item={{ label: "Password and security", detail: "Review password, two-factor, sessions, and sign-in alerts below in Security settings.", value: "Available", icon: Lock }} />
                </SettingsPanel>
              </>
            )}

            {selectedSection === "profile" && (
              <SettingsPanel title="Profile overview" description="Your live public profile identity connected to this account.">
                <ActionRow item={{ label: "Display name", detail: getDisplayName(profile, user), icon: UserRound }} />
                <ActionRow item={{ label: "Username", detail: profile?.username ? `@${profile.username}` : "No username found for this session.", icon: Users }} />
                <ActionRow item={{ label: "Edit profile", detail: "Open the V2 profile editor when you need to change public information.", href: "/v2/profile", icon: Paintbrush }} />
              </SettingsPanel>
            )}

            {selectedSection === "notifications" && (
              <SettingsPanel title="Notification options" description="These are notification settings only. This does not open the notifications inbox.">
                {NOTIFICATION_SETTINGS.map((setting) => (
                  <ToggleRow key={setting.key} setting={setting} enabled={notificationSettings[setting.key] ?? false} onToggle={() => setNotificationSettings((current) => ({ ...current, [setting.key]: !current[setting.key] }))} />
                ))}
              </SettingsPanel>
            )}

            {selectedSection === "appearance" && (
              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-xl font-black text-slate-950">Theme</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">Only Light, Dark, and System are available for V2.</p>
                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                  {V2_APPEARANCE_OPTIONS.map((option) => <ThemeCard key={option.key} option={option} selected={appearance === option.key} onSelect={() => handleAppearanceChange(option.key)} />)}
                </div>
              </section>
            )}

            {selectedSection === "messages" && (
              <SettingsPanel title="Message settings" description="These settings control private-message behavior only. This does not open Messages.">
                {MESSAGE_SETTINGS.map((setting) => (
                  <ToggleRow key={setting.key} setting={setting} enabled={messageSettings[setting.key] ?? false} onToggle={() => setMessageSettings((current) => ({ ...current, [setting.key]: !current[setting.key] }))} />
                ))}
              </SettingsPanel>
            )}

            {selectedSection === "security" && (
              <>
                <SettingsPanel title="Security controls" description="Security settings stay here instead of opening Privacy & Security directly.">
                  {SECURITY_SETTINGS.map((setting) => (
                    <ToggleRow key={setting.key} setting={setting} enabled={securitySettings[setting.key] ?? false} onToggle={() => setSecuritySettings((current) => ({ ...current, [setting.key]: !current[setting.key] }))} />
                  ))}
                </SettingsPanel>
                <SettingsPanel title="Connected sign-in methods">
                  {connectedAccounts.map((account) => <ConnectedAccountRow key={account.id} account={account} />)}
                  {connectedAccounts.length === 0 && <p className="py-4 text-sm font-semibold text-slate-500">No connected sign-in providers found for this session.</p>}
                </SettingsPanel>
              </>
            )}

            {selectedSection === "data" && (
              <>
                <SettingsPanel title="Data and history controls" description="These settings control history behavior only. This does not open Reading History.">
                  {DATA_SETTINGS.map((setting) => (
                    <ToggleRow key={setting.key} setting={setting} enabled={dataSettings[setting.key] ?? false} onToggle={() => setDataSettings((current) => ({ ...current, [setting.key]: !current[setting.key] }))} />
                  ))}
                </SettingsPanel>
                <SettingsPanel title="Data requests">
                  <ActionRow item={{ label: "Download your data", detail: "Request an export of account, discussion, reply, saved, and message data when available.", value: "Request", icon: Download }} />
                  <ActionRow item={{ label: "Data retention", detail: "Review what Loombus keeps for account safety, moderation, and history features.", value: "Settings", icon: FileText }} />
                </SettingsPanel>
              </>
            )}
          </section>

          <aside className="space-y-4">
            <DeviceSessionsCard user={user} />
            <AccountStatusCard payload={payload} user={user} appearance={appearance} plan={currentPlan} />
            <section className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-black text-slate-950">Settings behavior</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Left-rail items now open settings panels here instead of sending you to Notifications, Messages, Privacy & Security, or Reading History.</p>
            </section>
          </aside>
        </div>
      </section>
      <V2ShellMobileNav />
    </main>
  );
}
