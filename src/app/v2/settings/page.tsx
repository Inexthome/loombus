"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BookOpen,
  ChevronRight,
  Circle,
  Clock,
  CreditCard,
  Database,
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

type SettingsNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  active?: boolean;
};

type ProfileRow = {
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type Preference = {
  label: string;
  detail: string;
  icon: LucideIcon;
  value: string;
  enabled?: boolean | null;
  href?: string;
};

type ConnectedAccount = {
  id: string;
  label: string;
  email: string;
  status: string;
  mark: string;
  tone: string;
};

type QuickLink = {
  label: string;
  detail: string;
  href: string;
  icon: LucideIcon;
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

const SETTINGS_NAV: SettingsNavItem[] = [
  { label: "Account", href: "/v2/settings", icon: Users, active: true },
  { label: "Profile", href: "/v2/profile", icon: UserRound },
  { label: "Notifications", href: "/v2/notifications", icon: Bell },
  { label: "Appearance", href: "/v2/settings", icon: Paintbrush },
  { label: "Messages", href: "/v2/messages", icon: Mail },
  { label: "Security", href: "/v2/privacy-security", icon: Shield },
  { label: "Subscription", href: "/v2/premium", icon: CreditCard },
  { label: "Data & History", href: "/v2/reading-history", icon: Database },
];

const QUICK_LINKS: QuickLink[] = [
  { label: "Edit Profile", detail: "Update your public profile information", href: "/v2/profile", icon: UserRound },
  { label: "Change Password", detail: "Open account security settings", href: "/v2/privacy-security", icon: Lock },
  { label: "Notification Settings", detail: "Review notification controls", href: "/v2/notifications", icon: Bell },
  { label: "Privacy Settings", detail: "Manage privacy and account security", href: "/v2/privacy-security", icon: ShieldCheck },
];

function asBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true" || value === "on";
  if (typeof value === "number") return value > 0;
  return null;
}

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

function getProviderTone(provider: string) {
  const value = provider.toLowerCase();
  if (value.includes("google")) return "bg-blue-50 text-blue-700";
  if (value.includes("apple")) return "bg-slate-100 text-slate-900";
  if (value.includes("azure") || value.includes("microsoft")) return "bg-amber-50 text-amber-700";
  return "bg-violet-50 text-violet-700";
}

function normalizeProviderName(provider: string) {
  if (provider === "azure") return "Microsoft";
  return provider.slice(0, 1).toUpperCase() + provider.slice(1);
}

function getPreferenceValue(value: unknown) {
  const boolValue = asBoolean(value);
  if (boolValue === true) return { value: "On", enabled: true };
  if (boolValue === false) return { value: "Off", enabled: false };
  const stringValue = asString(value);
  return { value: stringValue || "Not set", enabled: null };
}

async function fetchNotificationPreferences(userId: string): Promise<Preference[]> {
  const attempts = [
    { table: "notification_preferences", ownerColumn: "user_id" },
    { table: "user_notification_preferences", ownerColumn: "user_id" },
  ];

  for (const attempt of attempts) {
    const { data, error } = await supabase
      .from(attempt.table)
      .select("*")
      .eq(attempt.ownerColumn, userId)
      .maybeSingle();

    if (!error && data) {
      const row = data as Record<string, unknown>;
      const email = getPreferenceValue(row.email_enabled ?? row.email_notifications);
      const push = getPreferenceValue(row.push_enabled ?? row.push_notifications);
      const inApp = getPreferenceValue(row.in_app_enabled ?? row.in_app_notifications);
      const digest = getPreferenceValue(row.digest_frequency ?? row.digest ?? row.summary_frequency);
      const previews = getPreferenceValue(row.message_previews ?? row.show_message_previews);

      return [
        { label: "Email Notifications", detail: "Receive important updates and activity summaries.", icon: Mail, ...email },
        { label: "Push Notifications", detail: "Receive mobile and device alerts when available.", icon: Bell, ...push },
        { label: "In-App Notifications", detail: "Show alerts inside Loombus.", icon: Bell, ...inApp },
        { label: "Digest Summary", detail: "Current digest frequency for account summaries.", icon: Mail, ...digest },
        { label: "Message Previews", detail: "Show or hide message preview text when available.", icon: MessageSquare, ...previews },
      ];
    }
  }

  return [
    { label: "Notification Preferences", detail: "No live notification-preference record was found yet.", icon: Settings, value: "Manage", enabled: null, href: "/v2/notifications" },
  ];
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

function SettingsSidebar({ onSignOut }: { onSignOut: () => void }) {
  return (
    <aside className="hidden w-56 shrink-0 rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm lg:flex lg:flex-col lg:justify-between">
      <div>
        <h2 className="mb-7 text-2xl font-black text-slate-950">Settings</h2>
        <nav className="space-y-2">
          {SETTINGS_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.label} href={item.href} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold transition ${item.active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-blue-50 hover:text-blue-700"}`}>
                <Icon className="size-4" />
                {item.label}
              </Link>
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

function MobileSettingsSummary({ profile, user }: { profile: ProfileRow | null; user: User | null }) {
  return (
    <section className="space-y-4 lg:hidden">
      <Link href="/v2/profile" className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
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
      </Link>
      <div className="grid gap-2">
        {SETTINGS_NAV.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.label} href={item.href} className={`flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black shadow-sm ${item.active ? "text-blue-700" : "text-slate-700"}`}>
              <span className="inline-flex items-center gap-3"><Icon className="size-4" />{item.label}</span>
              <ChevronRight className="size-4" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function ThemeCard({ option, selected, onSelect }: { option: (typeof V2_APPEARANCE_OPTIONS)[number]; selected: boolean; onSelect: () => void }) {
  const Icon = option.key === "light" ? Sun : option.key === "dark" ? Moon : Monitor;

  return (
    <button type="button" onClick={onSelect} className={`relative min-h-[128px] rounded-2xl border p-5 text-center transition ${selected ? "border-blue-600 bg-blue-50/40 shadow-sm ring-1 ring-blue-200" : "border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/40"}`}>
      <Icon className="mx-auto size-8 text-slate-800" />
      <h3 className="mt-3 text-sm font-black text-slate-950">{option.label}</h3>
      <p className="mx-auto mt-2 max-w-[150px] text-xs font-semibold leading-5 text-slate-500">{option.description}</p>
      <span className="absolute bottom-4 left-4">
        {selected ? <span className="grid size-4 place-items-center rounded-full bg-blue-600"><span className="size-1.5 rounded-full bg-white" /></span> : <Circle className="size-4 text-slate-300" />}
      </span>
    </button>
  );
}

function PreferenceRow({ item }: { item: Preference }) {
  const Icon = item.icon;
  const stateIcon = item.enabled === true ? <ToggleRight className="size-9 shrink-0 text-blue-600" /> : item.enabled === false ? <ToggleLeft className="size-9 shrink-0 text-slate-300" /> : <span className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-black text-slate-600">{item.value}</span>;
  const content = (
    <article className="flex items-center gap-4 border-b border-slate-100 py-4 last:border-0">
      <Icon className="size-5 shrink-0 text-blue-700" />
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-black text-slate-950">{item.label}</h3>
        <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{item.detail}</p>
      </div>
      {stateIcon}
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

function QuickLinksCard() {
  return (
    <section className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-black text-slate-950">Quick Links</h2>
      <div className="mt-4 space-y-4">
        {QUICK_LINKS.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.label} href={item.href} className="flex w-full items-start gap-3 rounded-xl p-2 text-left transition hover:bg-blue-50">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-700"><Icon className="size-5" /></span>
              <span className="min-w-0">
                <span className="block text-sm font-black text-slate-950">{item.label}</span>
                <span className="block text-xs font-semibold leading-5 text-slate-500">{item.detail}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
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
      <Link href="/v2/privacy-security" className="mt-2 flex w-full items-center justify-between text-sm font-black text-blue-700">View security settings <ChevronRight className="size-4" /></Link>
    </section>
  );
}

function AccountStatusCard({ payload, user, appearance }: { payload: ShellPayload | null; user: User | null; appearance: V2AppearanceTheme }) {
  const items: StatusItem[] = [
    { label: "Account session", value: user ? "Active" : "Unavailable", icon: ShieldCheck },
    { label: "V2 shell", value: payload?.flags.v2_shell && payload.version === "v2" ? "Enabled" : "Unavailable", icon: Settings },
    { label: "Appearance", value: V2_APPEARANCE_OPTIONS.find((option) => option.key === appearance)?.label ?? appearance, icon: Paintbrush },
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

export default function V2SettingsPage() {
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [appearance, setAppearance] = useState<V2AppearanceTheme>("light");

  const connectedAccounts = useMemo(() => getConnectedAccounts(user), [user]);

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
        const [{ data: profileData }, nextPreferences] = await Promise.all([
          supabase.from("profiles").select("full_name, username, avatar_url").eq("id", currentUser.id).maybeSingle(),
          fetchNotificationPreferences(currentUser.id),
        ]);
        setProfile((profileData as ProfileRow | null) ?? null);
        setPreferences(nextPreferences);
      } else {
        setProfile(null);
        setPreferences([]);
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
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7fbff] loombus-v2-page-bg text-slate-950">
      <V2ShellTopNav />
      <section className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)_320px]">
          <SettingsSidebar onSignOut={handleSignOut} />

          <section className="min-w-0 space-y-5">
            <header>
              <p className="mb-2 text-xs font-black uppercase tracking-[0.32em] text-blue-700 lg:hidden">Account</p>
              <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl lg:text-2xl">Settings</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 lg:hidden">Manage your account, preferences, and how Loombus works for you.</p>
            </header>

            <MobileSettingsSummary profile={profile} user={user} />

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-2xl font-black text-slate-950">Appearance</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">Customize how Loombus looks and feels.</p>
              <section className="mt-5 rounded-2xl border border-slate-200 p-4">
                <h3 className="text-base font-black text-slate-950">Theme</h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">Choose a theme that works best for you.</p>
                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                  {V2_APPEARANCE_OPTIONS.map((option) => <ThemeCard key={option.key} option={option} selected={appearance === option.key} onSelect={() => handleAppearanceChange(option.key)} />)}
                </div>
              </section>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-black text-slate-950">Preferences</h2>
              <div className="mt-2 divide-y divide-slate-100">
                {preferences.map((item) => <PreferenceRow key={item.label} item={item} />)}
                {preferences.length === 0 && <p className="py-4 text-sm font-semibold text-slate-500">No live preference data is available for this account yet.</p>}
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-black text-slate-950">Connected Accounts</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">Services currently connected to your Loombus sign-in.</p>
              <div className="mt-2 divide-y divide-slate-100">
                {connectedAccounts.map((account) => <ConnectedAccountRow key={account.id} account={account} />)}
                {connectedAccounts.length === 0 && <p className="py-4 text-sm font-semibold text-slate-500">No connected sign-in providers found for this session.</p>}
              </div>
            </section>
          </section>

          <aside className="space-y-4">
            <QuickLinksCard />
            <DeviceSessionsCard user={user} />
            <AccountStatusCard payload={payload} user={user} appearance={appearance} />
          </aside>
        </div>
      </section>
      <V2ShellMobileNav />
    </main>
  );
}
