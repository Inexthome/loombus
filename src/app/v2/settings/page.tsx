"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  ChevronRight,
  Circle,
  Clock,
  CreditCard,
  Database,
  HelpCircle,
  Home,
  Laptop,
  Loader2,
  Lock,
  LogOut,
  Mail,
  MessageCircle,
  MessageSquare,
  Moon,
  Monitor,
  Paintbrush,
  Plus,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Smartphone,
  SlidersHorizontal,
  Sun,
  ToggleLeft,
  ToggleRight,
  UserRound,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type FeatureFlags = {
  v2_shell: boolean;
  v2_signal_brief: boolean;
  v2_rooms: boolean;
};

type ShellPayload = {
  version: "v1" | "v2";
  configured: boolean;
  authenticated: boolean;
  flags: FeatureFlags;
};

type SettingsNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  active?: boolean;
};

type ThemeOption = {
  label: string;
  detail?: string;
  icon: LucideIcon;
  selected?: boolean;
};

type Preference = {
  label: string;
  detail: string;
  icon: LucideIcon;
  enabled: boolean;
};

type ConnectedAccount = {
  label: string;
  email: string;
  status: "Connected" | "Connect";
  mark: string;
  tone: string;
};

type QuickLink = {
  label: string;
  detail: string;
  icon: LucideIcon;
};

type DeviceSession = {
  label: string;
  detail: string;
  time?: string;
  active?: boolean;
  icon: LucideIcon;
};

type SyncItem = {
  label: string;
  time: string;
};

type Benefit = {
  label: string;
  detail: string;
  icon: LucideIcon;
};

const DEFAULT_FLAGS: FeatureFlags = {
  v2_shell: false,
  v2_signal_brief: false,
  v2_rooms: false,
};

const V2_NAV_ITEMS = [
  { label: "Home", href: "/v2", icon: Home },
  { label: "Discussions", href: "/v2/discussions", icon: MessageCircle },
  { label: "Create", href: "/v2/create", icon: Plus, primary: true },
  { label: "Rooms", href: "/v2/rooms", icon: Users },
  { label: "Messages", href: "/v2/messages", icon: Mail },
];

const MOBILE_NAV_ITEMS = [
  { label: "Home", href: "/v2", icon: Home },
  { label: "Discussions", href: "/v2/discussions", icon: MessageCircle },
  { label: "Create", href: "/v2/create", icon: Plus, primary: true },
  { label: "Rooms", href: "/v2/rooms", icon: Users },
  { label: "Messages", href: "/v2/messages", icon: Mail },
];

const SETTINGS_NAV: SettingsNavItem[] = [
  { label: "Account", href: "/v2/settings", icon: Users },
  { label: "Profile", href: "/v2/profile", icon: UserRound },
  { label: "Notifications", href: "/v2/notifications", icon: Bell },
  { label: "Appearance", href: "/v2/settings", icon: Paintbrush, active: true },
  { label: "Messages", href: "/v2/messages", icon: Mail },
  { label: "Security", href: "/v2/privacy-security", icon: Shield },
  { label: "Subscription", href: "/v2/premium", icon: CreditCard },
  { label: "Data & History", href: "/v2/reading-history", icon: Database },
];

const THEME_OPTIONS: ThemeOption[] = [
  { label: "Light", icon: Sun },
  { label: "System", detail: "Use your device system setting", icon: Monitor, selected: true },
  { label: "Dark", icon: Moon },
];

const PREFERENCES: Preference[] = [
  { label: "Email Notifications", detail: "Receive important updates and activity summaries.", icon: Mail, enabled: true },
  { label: "Message Previews", detail: "Show message previews in notifications.", icon: MessageSquare, enabled: true },
  { label: "Do Not Disturb", detail: "Pause notifications during focus time.", icon: Bell, enabled: false },
  { label: "Send Read Receipts", detail: "Let others know when you’ve read their messages.", icon: Clock, enabled: true },
];

const CONNECTED_ACCOUNTS: ConnectedAccount[] = [
  { label: "Google", email: "mason@loombus.com", status: "Connected", mark: "G", tone: "bg-blue-50 text-blue-700" },
  { label: "Microsoft", email: "mason@loombus.com", status: "Connected", mark: "M", tone: "bg-amber-50 text-amber-700" },
  { label: "Slack", email: "mason@loombus.com", status: "Connect", mark: "S", tone: "bg-violet-50 text-violet-700" },
];

const QUICK_LINKS: QuickLink[] = [
  { label: "Edit Profile", detail: "Update your personal information", icon: UserRound },
  { label: "Change Password", detail: "Update your account password", icon: Lock },
  { label: "Notification Settings", detail: "Configure notification preferences", icon: Bell },
  { label: "Privacy Settings", detail: "Manage your privacy options", icon: ShieldCheck },
];

const DEVICE_SESSIONS: DeviceSession[] = [
  { label: "MacBook Pro", detail: "macOS · Chrome", active: true, icon: Laptop },
  { label: "iPhone 14 Pro", detail: "iOS · Loombus App", time: "2h ago", icon: Smartphone },
  { label: "Windows Desktop", detail: "Windows 11 · Chrome", time: "1d ago", icon: Monitor },
];

const SYNC_ITEMS: SyncItem[] = [
  { label: "Messages", time: "Synced just now" },
  { label: "Discussions", time: "Synced just now" },
  { label: "Rooms", time: "Synced 1m ago" },
  { label: "Files", time: "Synced just now" },
];

const BENEFITS: Benefit[] = [
  { label: "Appearance Control", detail: "Choose the theme that fits your style and environment.", icon: Paintbrush },
  { label: "Account Preferences", detail: "Tailor notifications and behavior to match your workflow.", icon: SlidersHorizontal },
  { label: "Connected Devices", detail: "Manage active sessions and keep your account secure.", icon: Smartphone },
  { label: "Your Settings, Your Way", detail: "Personalize Loombus to work the way you do.", icon: ShieldCheck },
];

function getDefaultShellPayload(): ShellPayload {
  return {
    version: "v1",
    configured: false,
    authenticated: false,
    flags: DEFAULT_FLAGS,
  };
}

function GateCard({ title, message, loading = false, payload }: { title: string; message: string; loading?: boolean; payload?: ShellPayload | null }) {
  return (
    <main className="fixed inset-0 z-[80] flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white">
      <section className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-blue-500/15 text-blue-200 ring-1 ring-blue-300/20">
            {loading ? <Loader2 className="size-5 animate-spin" /> : <Lock className="size-5" />}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-200">Loombus V2</p>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h1>
          </div>
        </div>
        <p className="text-sm leading-6 text-slate-300 sm:text-base">{message}</p>
        {payload && <p className="mt-5 text-xs text-slate-300">v2_shell: {payload.flags.v2_shell ? "on" : "off"}</p>}
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/v2" className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-slate-200">Back to V2 Home</Link>
          <Link href="/settings" className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:text-white">Open V1 Settings</Link>
        </div>
      </section>
    </main>
  );
}

function V2TopNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-[#061942] text-white shadow-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/v2" className="flex items-center gap-3 font-bold">
          <img src="/assets/brand/loombus-mark-transparent.png" alt="" className="size-9 object-contain" />
          <span className="text-xl">Loombus</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {V2_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.label} href={item.href} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${item.primary ? "border border-white/40 text-white hover:bg-white/10" : "text-blue-100 hover:bg-white/10 hover:text-white"}`}>
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/v2/search" aria-label="Search" className="grid size-10 place-items-center rounded-full text-blue-100 transition hover:bg-white/10 hover:text-white"><Search className="size-5" /></Link>
          <Link href="/v2/notifications" aria-label="Notifications" className="relative grid size-10 place-items-center rounded-full text-blue-100 transition hover:bg-white/10 hover:text-white"><Bell className="size-5" /><span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-blue-500 text-[10px] font-bold text-white">3</span></Link>
        </div>
      </div>
    </header>
  );
}

function MobileBottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-3 pb-3 pt-2 shadow-2xl backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1 text-xs font-semibold text-slate-500">
        {MOBILE_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.label} href={item.href} className="flex flex-col items-center gap-1 rounded-2xl py-2 text-slate-500">
              <Icon className={`size-5 ${item.primary ? "rounded-full bg-blue-600 p-1 text-white" : ""}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function SettingsSidebar() {
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
        <button type="button" className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-blue-50 hover:text-blue-700">
          <MessageCircle className="size-4" />
          Give Feedback
        </button>
        <button type="button" className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black text-red-600 transition hover:bg-red-50">
          <LogOut className="size-4" />
          Log out
        </button>
      </div>
    </aside>
  );
}

function MobileSettingsSummary() {
  return (
    <section className="space-y-4 lg:hidden">
      <article className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <span className="grid size-14 shrink-0 place-items-center rounded-full bg-amber-50 text-lg font-black text-amber-800">MA</span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-black text-slate-950">Mason Alvarado</h2>
          <p className="truncate text-xs font-semibold text-slate-500">mason@loombus.com</p>
        </div>
        <ChevronRight className="size-5 text-blue-700" />
      </article>
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

function ThemeCard({ option }: { option: ThemeOption }) {
  const Icon = option.icon;

  return (
    <button type="button" className={`relative min-h-[128px] rounded-2xl border p-5 text-center transition ${option.selected ? "border-blue-600 bg-blue-50/40 shadow-sm ring-1 ring-blue-200" : "border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/40"}`}>
      <Icon className="mx-auto size-8 text-slate-800" />
      <h3 className="mt-3 text-sm font-black text-slate-950">{option.label}</h3>
      {option.detail && <p className="mx-auto mt-2 max-w-[130px] text-xs font-semibold leading-5 text-slate-500">{option.detail}</p>}
      <span className="absolute bottom-4 left-4">
        {option.selected ? <span className="grid size-4 place-items-center rounded-full bg-blue-600"><span className="size-1.5 rounded-full bg-white" /></span> : <Circle className="size-4 text-slate-300" />}
      </span>
    </button>
  );
}

function PreferenceRow({ item }: { item: Preference }) {
  const Icon = item.icon;

  return (
    <article className="flex items-center gap-4 border-b border-slate-100 py-4 last:border-0">
      <Icon className="size-5 shrink-0 text-blue-700" />
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-black text-slate-950">{item.label}</h3>
        <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{item.detail}</p>
      </div>
      {item.enabled ? <ToggleRight className="size-9 shrink-0 text-blue-600" /> : <ToggleLeft className="size-9 shrink-0 text-slate-300" />}
    </article>
  );
}

function ConnectedAccountRow({ account }: { account: ConnectedAccount }) {
  return (
    <article className="flex items-center gap-4 border-b border-slate-100 py-4 last:border-0">
      <span className={`grid size-8 shrink-0 place-items-center rounded-lg text-sm font-black ${account.tone}`}>{account.mark}</span>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-black text-slate-950">{account.label}</h3>
        <p className="truncate text-xs font-semibold text-slate-500">{account.email}</p>
      </div>
      {account.status === "Connected" ? <span className="rounded-lg bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">Connected</span> : <button type="button" className="rounded-lg border border-blue-200 px-4 py-2 text-xs font-black text-blue-700">Connect</button>}
      <ChevronRight className="size-4 text-blue-700" />
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
            <button key={item.label} type="button" className="flex w-full items-start gap-3 rounded-xl p-2 text-left transition hover:bg-blue-50">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-700"><Icon className="size-5" /></span>
              <span className="min-w-0">
                <span className="block text-sm font-black text-slate-950">{item.label}</span>
                <span className="block text-xs font-semibold leading-5 text-slate-500">{item.detail}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function DeviceSessionsCard() {
  return (
    <section className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-black text-slate-950">Device Sessions</h2>
      <p className="mt-1 text-xs font-semibold text-slate-500">View and manage your active sessions.</p>
      <div className="mt-4 divide-y divide-slate-100">
        {DEVICE_SESSIONS.map((device) => {
          const Icon = device.icon;
          return (
            <article key={device.label} className="flex items-center gap-3 py-4">
              <Icon className="size-5 shrink-0 text-blue-700" />
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-black text-slate-950">{device.label}</h3>
                <p className="truncate text-xs font-semibold text-slate-500">{device.detail}</p>
              </div>
              {device.active ? <span className="rounded-lg bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">Active</span> : <span className="text-xs font-semibold text-slate-500">{device.time}</span>}
            </article>
          );
        })}
      </div>
      <button type="button" className="mt-2 flex w-full items-center justify-between text-sm font-black text-blue-700">View all sessions <ChevronRight className="size-4" /></button>
    </section>
  );
}

function SyncStatusCard() {
  return (
    <section className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-black text-slate-950">Sync Status</h2>
      <p className="mt-1 text-xs font-semibold text-slate-500">All systems are up to date.</p>
      <div className="mt-4 divide-y divide-slate-100">
        {SYNC_ITEMS.map((item) => (
          <article key={item.label} className="flex items-center gap-3 py-3">
            <ShieldCheck className="size-5 shrink-0 text-emerald-600" />
            <h3 className="min-w-0 flex-1 text-sm font-black text-slate-950">{item.label}</h3>
            <span className="text-xs font-semibold text-slate-500">{item.time}</span>
          </article>
        ))}
      </div>
      <p className="mt-4 flex items-center gap-2 text-sm font-black text-blue-700"><ShieldCheck className="size-5" />Everything is up to date</p>
    </section>
  );
}

export default function V2SettingsPage() {
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadShell() {
    setLoading(true);
    setMessage("");

    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const response = await fetch("/api/v2/shell", {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      const nextPayload = (await response.json().catch(() => getDefaultShellPayload())) as ShellPayload;
      setPayload(nextPayload);
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

  if (loading) return <GateCard title="Loading Settings" message="Loombus is verifying access before loading V2 Settings." loading />;
  if (message) return <GateCard title="V2 shell check failed safely" message={message} payload={payload} />;
  if (!payload?.authenticated) return <GateCard title="Sign in required" message="Sign in first so Loombus can verify V2 Settings access." payload={payload} />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") return <GateCard title="V2 shell is not enabled" message="This account is not currently allowed through the v2_shell flag. Public users remain on V1." payload={payload} />;

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7fbff] text-slate-950">
      <V2TopNav />
      <section className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)_320px]">
          <SettingsSidebar />

          <section className="min-w-0 space-y-5">
            <header>
              <p className="mb-2 text-xs font-black uppercase tracking-[0.32em] text-blue-700 lg:hidden">Account</p>
              <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl lg:text-2xl">Settings</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 lg:hidden">Manage your account, preferences, and how Loombus works for you.</p>
            </header>

            <MobileSettingsSummary />

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-2xl font-black text-slate-950">Appearance</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">Customize how Loombus looks and feels.</p>
              <section className="mt-5 rounded-2xl border border-slate-200 p-4">
                <h3 className="text-base font-black text-slate-950">Theme</h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">Choose a theme that works best for you.</p>
                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                  {THEME_OPTIONS.map((option) => <ThemeCard key={option.label} option={option} />)}
                </div>
              </section>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-black text-slate-950">Preferences</h2>
              <div className="mt-2 divide-y divide-slate-100">
                {PREFERENCES.map((item) => <PreferenceRow key={item.label} item={item} />)}
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-black text-slate-950">Connected Accounts</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">Manage the services connected to your Loombus account.</p>
              <div className="mt-2 divide-y divide-slate-100">
                {CONNECTED_ACCOUNTS.map((account) => <ConnectedAccountRow key={account.label} account={account} />)}
              </div>
            </section>
          </section>

          <aside className="space-y-4">
            <QuickLinksCard />
            <DeviceSessionsCard />
            <SyncStatusCard />
          </aside>
        </div>

        <section className="mt-6 grid gap-4 md:grid-cols-4">
          {BENEFITS.map((benefit) => {
            const Icon = benefit.icon;
            return (
              <article key={benefit.label} className="flex gap-4 rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm md:block">
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">
                  <Icon className="size-5" />
                </span>
                <div>
                  <h3 className="text-sm font-black text-blue-700 md:mt-3">{benefit.label}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{benefit.detail}</p>
                </div>
              </article>
            );
          })}
        </section>
      </section>
      <MobileBottomNav />
    </main>
  );
}
