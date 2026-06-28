"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BookOpen,
  ChevronRight,
  CloudDownload,
  CreditCard,
  Eye,
  Globe,
  Home,
  Laptop,
  Loader2,
  Lock,
  Mail,
  MessageCircle,
  Monitor,
  Paintbrush,
  Plus,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Smartphone,
  ToggleRight,
  Trash2,
  UserRound,
  UserRoundX,
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

type PrivacyControl = {
  label: string;
  description: string;
  icon: LucideIcon;
  value?: string;
  badge?: string;
  action?: string;
  toggle?: boolean;
};

type SignIn = {
  location: string;
  device: string;
  time: string;
};

type TrustedDevice = {
  label: string;
  detail: string;
  icon: LucideIcon;
};

type Shortcut = {
  label: string;
  icon: LucideIcon;
  tone: string;
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
  { label: "Account", href: "/v2/settings", icon: UserRound },
  { label: "Privacy & Security", href: "/v2/privacy-security", icon: Lock, active: true },
  { label: "Notifications", href: "/v2/notifications", icon: Bell },
  { label: "Appearance", href: "/v2/settings/appearance", icon: Paintbrush },
  { label: "Language & Region", href: "/v2/settings/language", icon: Globe },
  { label: "Integrations", href: "/v2/settings/integrations", icon: Settings },
  { label: "Billing & Plans", href: "/v2/premium", icon: CreditCard },
];

const PRIVACY_CONTROLS: PrivacyControl[] = [
  {
    label: "Profile Visibility",
    description: "Choose who can view your profile information.",
    icon: UserRound,
    value: "Friends Only",
  },
  {
    label: "Messaging Permissions",
    description: "Control who can message you directly.",
    icon: Mail,
    value: "Everyone",
  },
  {
    label: "Activity Visibility",
    description: "Manage how your activity and presence are seen.",
    icon: Eye,
    toggle: true,
  },
  {
    label: "Two-Factor Authentication",
    description: "Add an extra layer of security to your account.",
    icon: ShieldCheck,
    badge: "Enabled",
  },
  {
    label: "Login Sessions",
    description: "View and manage your active sessions.",
    icon: Monitor,
    action: "3 Active",
  },
  {
    label: "Blocked Users",
    description: "Manage users you’ve blocked.",
    icon: UserRoundX,
    action: "2 Blocked",
  },
  {
    label: "Download Your Data",
    description: "Export a copy of your data from Loombus.",
    icon: CloudDownload,
    action: "Request Export",
  },
  {
    label: "Reading History",
    description: "Control how your reading activity is recorded.",
    icon: BookOpen,
    value: "Full History",
  },
];

const RECENT_SIGN_INS: SignIn[] = [
  { location: "San Francisco, CA, USA", device: "Chrome on macOS", time: "Now" },
  { location: "New York, NY, USA", device: "Safari on iPhone", time: "2h ago" },
  { location: "Austin, TX, USA", device: "Chrome on Windows", time: "1d ago" },
];

const TRUSTED_DEVICES: TrustedDevice[] = [
  { label: "MacBook Pro", detail: "macOS · This device", icon: Laptop },
  { label: "iPhone 14 Pro", detail: "iOS · Last active 2h ago", icon: Smartphone },
  { label: "Windows Desktop", detail: "Windows 11 · Last active 1d ago", icon: Monitor },
];

const PRIVACY_SHORTCUTS: Shortcut[] = [
  { label: "Review Privacy Policy", icon: Lock, tone: "text-blue-700" },
  { label: "Manage Ad Preferences", icon: Settings, tone: "text-blue-700" },
  { label: "Delete Account", icon: Trash2, tone: "text-red-600" },
];

const BENEFITS: Benefit[] = [
  { label: "Strong Account Protection", detail: "2FA, strong passwords, and smart detection keep you safe.", icon: ShieldCheck },
  { label: "Clear Privacy Controls", detail: "Decide who can see you, message you, and what you share.", icon: Eye },
  { label: "Session Management", detail: "See where you’re signed in and secure your account anywhere.", icon: Monitor },
  { label: "Data in Your Control", detail: "Download your data or delete your account with ease.", icon: CloudDownload },
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
          <Link href="/v2/notifications" aria-label="Notifications" className="relative grid size-10 place-items-center rounded-full text-blue-100 transition hover:bg-white/10 hover:text-white"><Bell className="size-5" /><span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-blue-500 text-[10px] font-bold text-white">8</span></Link>
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
    <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white p-5 lg:flex lg:flex-col lg:justify-between">
      <div>
        <h2 className="mb-7 text-base font-black text-slate-950">Settings</h2>
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
      <div className="rounded-2xl p-3 text-sm">
        <p className="flex items-center gap-2 font-black text-slate-700"><MessageCircle className="size-4 text-blue-700" />Need help?</p>
        <button type="button" className="mt-2 text-xs font-black text-blue-700">Visit Help Center</button>
      </div>
    </aside>
  );
}

function PrivacyControlRow({ control }: { control: PrivacyControl }) {
  const Icon = control.icon;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md sm:p-5">
      <div className="flex items-center gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-black text-slate-950 sm:text-base">{control.label}</h3>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-600 sm:text-sm">{control.description}</p>
        </div>
        {control.value && (
          <button type="button" className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-blue-50 hover:text-blue-700 sm:inline-flex">
            {control.value}
            <ChevronRight className="size-4 rotate-90" />
          </button>
        )}
        {control.badge && <span className="hidden rounded-lg bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 sm:inline-flex">{control.badge}</span>}
        {control.action && <button type="button" className="hidden text-sm font-black text-blue-700 sm:inline-flex">{control.action}</button>}
        {control.toggle && <span className="hidden text-blue-600 sm:inline-flex"><ToggleRight className="size-10 fill-blue-600 stroke-white" /></span>}
        <ChevronRight className="size-5 shrink-0 text-blue-700" />
      </div>
    </article>
  );
}

function SecurityScoreCard() {
  return (
    <section className="rounded-[1.25rem] border border-slate-200 bg-white p-5 text-center shadow-sm">
      <h2 className="text-left text-xs font-black uppercase tracking-[0.14em] text-slate-700">Security Score</h2>
      <div className="mx-auto mt-5 grid size-32 place-items-center rounded-full border-[10px] border-emerald-500 bg-emerald-50 text-slate-950">
        <div>
          <p className="text-3xl font-black">92</p>
          <p className="text-xs font-black text-emerald-700">Excellent</p>
        </div>
      </div>
      <p className="mt-4 text-sm font-semibold text-slate-600">Your account is well protected.</p>
      <div className="mt-4 space-y-2 text-left text-xs font-semibold text-slate-600">
        <p className="flex items-center gap-2"><ShieldCheck className="size-4 text-emerald-600" />Two-factor authentication enabled</p>
        <p className="flex items-center gap-2"><ShieldCheck className="size-4 text-emerald-600" />Strong password</p>
        <p className="flex items-center gap-2"><ShieldCheck className="size-4 text-emerald-600" />No suspicious activity detected</p>
      </div>
      <button type="button" className="mt-4 text-xs font-black text-blue-700">View security recommendations</button>
    </section>
  );
}

function RecentSignInsCard() {
  return (
    <section className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xs font-black uppercase tracking-[0.14em] text-slate-700">Recent Sign-Ins</h2>
        <button type="button" className="text-xs font-black text-blue-700">View all</button>
      </div>
      <div className="space-y-4">
        {RECENT_SIGN_INS.map((signIn) => (
          <article key={`${signIn.location}-${signIn.time}`} className="flex items-start gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-700">
              <Globe className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-black text-slate-950">{signIn.location}</h3>
              <p className="text-xs font-semibold text-slate-500">{signIn.device}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">{signIn.time}</span>
              <span className="size-2 rounded-full bg-emerald-500" />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function TrustedDevicesCard() {
  return (
    <section className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xs font-black uppercase tracking-[0.14em] text-slate-700">Trusted Devices</h2>
        <button type="button" className="text-xs font-black text-blue-700">View all</button>
      </div>
      <div className="space-y-4">
        {TRUSTED_DEVICES.map((device) => {
          const Icon = device.icon;
          return (
            <article key={device.label} className="flex items-center gap-3">
              <Icon className="size-5 shrink-0 text-blue-700" />
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-black text-slate-950">{device.label}</h3>
                <p className="text-xs font-semibold text-slate-500">{device.detail}</p>
              </div>
              <span className="rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700">Trusted</span>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function PrivacyShortcutsCard() {
  return (
    <section className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xs font-black uppercase tracking-[0.14em] text-slate-700">Privacy Shortcuts</h2>
      <div className="mt-4 space-y-3">
        {PRIVACY_SHORTCUTS.map((shortcut) => {
          const Icon = shortcut.icon;
          return (
            <button key={shortcut.label} type="button" className={`flex w-full items-center justify-between rounded-xl px-2 py-2 text-left text-sm font-black ${shortcut.tone} transition hover:bg-blue-50`}>
              <span className="inline-flex items-center gap-3"><Icon className="size-4" />{shortcut.label}</span>
              <ChevronRight className="size-4" />
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function V2PrivacySecurityPage() {
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadShell() {
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const response = await fetch("/api/v2/shell", { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined });
      const nextPayload = (await response.json().catch(() => getDefaultShellPayload())) as ShellPayload;
      setPayload(nextPayload);
    } catch {
      setPayload(getDefaultShellPayload());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadShell();
    const { data } = supabase.auth.onAuthStateChange(() => loadShell());
    return () => data.subscription.unsubscribe();
  }, []);

  if (loading) return <GateCard title="Checking V2 Privacy & Security access" message="Loombus is verifying access before loading the V2 Privacy & Security shell." loading />;
  if (!payload?.authenticated) return <GateCard title="Sign in required" message="The V2 Privacy & Security shell is internal-only right now. Sign in first so Loombus can check your v2_shell access." payload={payload} />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") return <GateCard title="V2 Privacy & Security is not enabled" message="This account is not currently allowed through the v2_shell flag. Public users remain on V1." payload={payload} />;

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7fbff] text-slate-950">
      <V2TopNav />
      <div className="mx-auto flex max-w-7xl bg-white/40">
        <SettingsSidebar />
        <section className="min-w-0 flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-8">
          <header className="mb-6">
            <p className="mb-2 text-xs font-black uppercase tracking-[0.32em] text-blue-700 lg:hidden">Account</p>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Privacy & Security</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Control your visibility, protect your account, and manage your data.</p>
          </header>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0 space-y-5">
              <label className="relative flex md:hidden">
                <span className="sr-only">Search privacy and security settings</span>
                <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
                <input type="search" placeholder="Search privacy and security settings" className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-sm font-semibold text-slate-700 shadow-sm outline-none transition placeholder:text-slate-500 focus:border-blue-300 focus:ring-4 focus:ring-blue-100" />
              </label>

              <section className="space-y-3">
                {PRIVACY_CONTROLS.map((control) => <PrivacyControlRow key={control.label} control={control} />)}
              </section>

              <p className="flex items-center justify-center gap-2 pt-3 text-sm font-semibold text-slate-600">
                <ShieldCheck className="size-4 text-blue-700" />
                We use industry-standard encryption to keep your data safe and private.
              </p>
            </div>

            <aside className="space-y-4">
              <SecurityScoreCard />
              <RecentSignInsCard />
              <TrustedDevicesCard />
              <PrivacyShortcutsCard />
            </aside>
          </section>

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
      </div>
      <MobileBottomNav />
    </main>
  );
}
