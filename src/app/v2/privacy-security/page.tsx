"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BookOpen,
  ChevronRight,
  CloudDownload,
  CreditCard,
  Eye,
  Globe,
  Lock,
  Mail,
  MessageCircle,
  Monitor,
  Paintbrush,
  Search,
  Settings,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserRound,
  UserRoundX,
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
  value: string;
  href?: string;
  tone?: string;
};

type SecurityEvent = {
  label: string;
  detail: string;
  meta: string;
  icon: LucideIcon;
};

const SETTINGS_NAV: SettingsNavItem[] = [
  { label: "Account", href: "/v2/settings", icon: UserRound },
  { label: "Privacy & Security", href: "/v2/privacy-security", icon: Lock, active: true },
  { label: "Notifications", href: "/v2/notifications", icon: Bell },
  { label: "Appearance", href: "/v2/settings/appearance", icon: Paintbrush },
  { label: "Language & Region", href: "/v2/settings/language", icon: Globe },
  { label: "Integrations", href: "/v2/settings/integrations", icon: Settings },
  { label: "Billing & Plans", href: "/v2/premium", icon: CreditCard },
];

function formatRelativeTime(value: string | null | undefined) {
  if (!value) return "Not available";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Not available";
  const diffMinutes = Math.floor((Date.now() - timestamp) / 60000);
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
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
      <Link href="/v2/support" className="rounded-2xl p-3 text-sm transition hover:bg-blue-50">
        <p className="flex items-center gap-2 font-black text-slate-700"><MessageCircle className="size-4 text-blue-700" />Need help?</p>
        <p className="mt-2 text-xs font-black text-blue-700">Visit Help Center</p>
      </Link>
    </aside>
  );
}

function PrivacyControlRow({ control }: { control: PrivacyControl }) {
  const Icon = control.icon;
  const content = (
    <article className="rounded-[1.15rem] border border-slate-200 bg-white p-3 shadow-sm transition hover:border-blue-200 hover:shadow-md sm:p-4">
      <div className="grid gap-3 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto_auto] sm:items-start">
        <span className={`grid size-10 place-items-center rounded-xl ${control.tone ?? "bg-blue-50 text-blue-700"}`}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-black leading-tight text-slate-950 sm:text-base">{control.label}</h3>
          <p className="mt-1 max-w-2xl text-xs font-semibold leading-5 text-slate-600 sm:text-sm">{control.description}</p>
        </div>
        <span className="w-fit rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700 sm:text-sm">{control.value}</span>
        <ChevronRight className="hidden size-5 shrink-0 text-blue-700 sm:block" />
      </div>
    </article>
  );

  if (!control.href) return content;
  return <Link href={control.href}>{content}</Link>;
}

function SecurityStatusCard({ user }: { user: User | null }) {
  const hasEmail = Boolean(user?.email);
  const emailConfirmed = Boolean(user?.email_confirmed_at);
  const providerCount = user?.identities?.length ?? 0;
  const completedChecks = [hasEmail, emailConfirmed, providerCount > 0].filter(Boolean).length;

  return (
    <section className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xs font-black uppercase tracking-[0.14em] text-slate-700">Security Status</h2>
      <div className="mt-4 rounded-2xl bg-blue-50 p-4 text-blue-900">
        <p className="text-3xl font-black">{completedChecks}/3</p>
        <p className="mt-1 text-xs font-black text-blue-700">Verified account checks</p>
      </div>
      <div className="mt-4 space-y-2 text-xs font-semibold text-slate-600">
        <p className="flex items-center gap-2"><ShieldCheck className={`size-4 ${hasEmail ? "text-emerald-600" : "text-slate-400"}`} />Email on account: {hasEmail ? user?.email : "Not available"}</p>
        <p className="flex items-center gap-2"><ShieldCheck className={`size-4 ${emailConfirmed ? "text-emerald-600" : "text-slate-400"}`} />Email verification: {emailConfirmed ? "Verified" : "Not verified"}</p>
        <p className="flex items-center gap-2"><ShieldCheck className={`size-4 ${providerCount > 0 ? "text-emerald-600" : "text-slate-400"}`} />Sign-in providers: {providerCount || "None detected"}</p>
      </div>
    </section>
  );
}

function SecurityEventsCard({ events }: { events: SecurityEvent[] }) {
  return (
    <section className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xs font-black uppercase tracking-[0.14em] text-slate-700">Recent Sign-Ins</h2>
        <span className="text-xs font-black text-slate-400">Current account</span>
      </div>
      <div className="space-y-4">
        {events.map((event) => {
          const Icon = event.icon;
          return (
            <article key={`${event.label}-${event.meta}`} className="flex items-start gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-700">
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-black text-slate-950">{event.label}</h3>
                <p className="text-xs font-semibold text-slate-500">{event.detail}</p>
              </div>
              <span className="text-xs font-semibold text-slate-500">{event.meta}</span>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function PrivacyShortcutsCard() {
  const exportSubject = encodeURIComponent("Loombus data export request");
  const exportBody = encodeURIComponent("Please help me export a copy of my Loombus account data.");

  return (
    <section className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xs font-black uppercase tracking-[0.14em] text-slate-700">Privacy Shortcuts</h2>
      <div className="mt-4 space-y-3">
        <Link href="/privacy" className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-left text-sm font-black text-blue-700 transition hover:bg-blue-50">
          <span className="inline-flex items-center gap-3"><Lock className="size-4" />Review Privacy Policy</span>
          <ChevronRight className="size-4" />
        </Link>
        <a href={`mailto:support@loombus.com?subject=${exportSubject}&body=${exportBody}`} className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-left text-sm font-black text-blue-700 transition hover:bg-blue-50">
          <span className="inline-flex items-center gap-3"><CloudDownload className="size-4" />Request Data Export</span>
          <ChevronRight className="size-4" />
        </a>
        <Link href="/settings" className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-left text-sm font-black text-red-600 transition hover:bg-red-50">
          <span className="inline-flex items-center gap-3"><Trash2 className="size-4" />Account deletion settings</span>
          <ChevronRight className="size-4" />
        </Link>
      </div>
    </section>
  );
}

export default function V2PrivacySecurityPage() {
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [blockedCount, setBlockedCount] = useState<number | null>(null);

  const privacyControls = useMemo<PrivacyControl[]>(() => [
    {
      label: "Profile Visibility",
      description: "Profile visibility currently follows your public profile settings.",
      icon: UserRound,
      value: "View profile",
      href: "/v2/profile",
    },
    {
      label: "Messaging Permissions",
      description: "Messaging is controlled through your current Loombus message and mutual-connection rules.",
      icon: Mail,
      value: "Current rules",
      href: "/v2/messages",
    },
    {
      label: "Activity Visibility",
      description: "Review the activity Loombus can currently show for your account.",
      icon: Eye,
      value: "View activity",
      href: "/v2/my-activity",
    },
    {
      label: "Two-Factor Authentication",
      description: "Loombus currently uses Supabase auth, provider verification, and platform session controls.",
      icon: ShieldCheck,
      value: user?.email_confirmed_at ? "Email verified" : "Needs review",
      tone: user?.email_confirmed_at ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700",
    },
    {
      label: "Login Sessions",
      description: "This browser has an active Loombus session. Full multi-device session management needs a backend endpoint.",
      icon: Monitor,
      value: user ? "Current active" : "Not active",
    },
    {
      label: "Blocked Users",
      description: "Blocked-user count is read from account data when available.",
      icon: UserRoundX,
      value: blockedCount === null ? "Not available" : `${blockedCount} blocked`,
    },
    {
      label: "Download Your Data",
      description: "Request an export from Loombus support until an automated export flow is added.",
      icon: CloudDownload,
      value: "Request export",
    },
    {
      label: "Reading History",
      description: "Review your current V2 reading-history view.",
      icon: BookOpen,
      value: "View history",
      href: "/v2/reading-history",
    },
  ], [blockedCount, user]);

  const securityEvents = useMemo<SecurityEvent[]>(() => [
    {
      label: "Current session",
      detail: user?.email ?? "Signed-in user not available",
      meta: formatRelativeTime(user?.last_sign_in_at),
      icon: Smartphone,
    },
    {
      label: "Account created",
      detail: "Loombus account record",
      meta: formatRelativeTime(user?.created_at),
      icon: Monitor,
    },
  ], [user]);

  async function loadShell() {
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const currentUser = data.session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        const { count, error } = await supabase
          .from("blocked_users")
          .select("id", { count: "exact", head: true })
          .eq("blocker_id", currentUser.id);
        setBlockedCount(error ? null : count ?? 0);
      } else {
        setBlockedCount(null);
      }

      const response = await fetch("/api/v2/shell", { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined });
      const nextPayload = (await response.json().catch(() => getDefaultShellPayload())) as ShellPayload;
      setPayload(nextPayload);
    } catch {
      setPayload(getDefaultShellPayload());
      setBlockedCount(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadShell();
    const { data } = supabase.auth.onAuthStateChange(() => loadShell());
    return () => data.subscription.unsubscribe();
  }, []);

  if (loading) return <V2ShellGateCard title="Checking V2 Privacy & Security access" message="Loombus is verifying access before loading the V2 Privacy & Security shell." loading />;
  if (!payload?.authenticated) return <V2ShellGateCard title="Sign in required" message="The V2 Privacy & Security shell is internal-only right now. Sign in first so Loombus can check your v2_shell access." payload={payload} />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") return <V2ShellGateCard title="V2 Privacy & Security is not enabled" message="This account is not currently allowed through the v2_shell flag. Public users remain on V1." payload={payload} />;

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7fbff] text-slate-950">
      <V2ShellTopNav />
      <div className="mx-auto flex max-w-7xl bg-white/40">
        <SettingsSidebar />
        <section className="min-w-0 flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-8">
          <header className="mb-6">
            <p className="mb-2 text-xs font-black uppercase tracking-[0.32em] text-blue-700 lg:hidden">Account</p>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Privacy & Security</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Control your visibility, protect your account, and manage your data.</p>
          </header>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0 space-y-3">
              <label className="relative flex md:hidden">
                <span className="sr-only">Search privacy and security settings</span>
                <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
                <input type="search" placeholder="Search privacy and security settings" className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-sm font-semibold text-slate-700 shadow-sm outline-none transition placeholder:text-slate-500 focus:border-blue-300 focus:ring-4 focus:ring-blue-100" />
              </label>

              <section className="space-y-3">
                {privacyControls.map((control) => <PrivacyControlRow key={control.label} control={control} />)}
              </section>

              <p className="flex items-center justify-center gap-2 pt-2 text-sm font-semibold text-slate-600">
                <ShieldCheck className="size-4 text-blue-700" />
                Account-specific values are shown only when Loombus can read them from the current signed-in session.
              </p>
            </div>

            <aside className="space-y-4">
              <SecurityStatusCard user={user} />
              <SecurityEventsCard events={securityEvents} />
              <PrivacyShortcutsCard />
            </aside>
          </section>
        </section>
      </div>
      <V2ShellMobileNav />
    </main>
  );
}
