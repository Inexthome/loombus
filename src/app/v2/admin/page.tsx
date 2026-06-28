"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Filter,
  Flag,
  FlaskConical,
  Gauge,
  Home,
  Inbox,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  UserRoundCheck,
  Users,
  Wrench,
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

type StatCard = {
  label: string;
  value: string;
  trend: string;
  trendDirection: "up" | "down";
  icon: LucideIcon;
  tone: "blue" | "red" | "emerald";
};

type AdminNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  active?: boolean;
};

type QueueItem = {
  report: string;
  context: string;
  type: string;
  severity: "High" | "Medium" | "Low";
  reportedBy: string;
  time: string;
  status: "New" | "In Review" | "Dismissed";
};

type AlertItem = {
  title: string;
  detail: string;
  time: string;
  icon: LucideIcon;
  tone: "red" | "amber" | "blue";
};

type ActivityItem = {
  person: string;
  action: string;
  detail: string;
  time: string;
};

type QuickAction = {
  label: string;
  icon: LucideIcon;
  href: string;
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

const ADMIN_NAV_GROUPS: Array<{ label: string; items: AdminNavItem[] }> = [
  {
    label: "Overview",
    items: [{ label: "Overview", href: "/v2/admin", icon: Home, active: true }],
  },
  {
    label: "Manage",
    items: [
      { label: "Users", href: "/admin/users", icon: Users },
      { label: "Reports", href: "/admin/reports", icon: Flag },
      { label: "Safety Queue", href: "/admin/safety", icon: ShieldCheck },
      { label: "Support Tickets", href: "/admin/support", icon: Inbox },
      { label: "Labs Requests", href: "/admin/labs", icon: FlaskConical },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "Topic Memory", href: "/admin/topic-memory", icon: BarChart3 },
      { label: "Audit Log", href: "/admin/audit", icon: FileText },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Settings", href: "/settings", icon: Settings },
      { label: "Integrations", href: "/admin", icon: KeyRound },
    ],
  },
];

const STATS: StatCard[] = [
  { label: "Total Users", value: "24,581", trend: "8.2% vs. last 7 days", trendDirection: "up", icon: Users, tone: "blue" },
  { label: "Open Reports", value: "126", trend: "14.6% vs. last 7 days", trendDirection: "up", icon: Flag, tone: "red" },
  { label: "Pending Reviews", value: "42", trend: "12.5% vs. last 7 days", trendDirection: "down", icon: ShieldCheck, tone: "emerald" },
  { label: "Support Backlog", value: "18", trend: "5.6% vs. last 7 days", trendDirection: "down", icon: Inbox, tone: "emerald" },
];

const QUEUE_ITEMS: QueueItem[] = [
  { report: "Harassment in Discussion", context: "The Future of Work", type: "Harassment", severity: "High", reportedBy: "Nadia Karim", time: "15m ago", status: "New" },
  { report: "Spam or Self-Promotion", context: "Open Systems Lab", type: "Spam", severity: "Medium", reportedBy: "Alex Rivera", time: "40m ago", status: "New" },
  { report: "Misinformation", context: "Climate Tech Roadmap 2030", type: "Misinformation", severity: "Medium", reportedBy: "Mason Alvarado", time: "1h ago", status: "In Review" },
  { report: "Inappropriate Content", context: "Builders’ Room", type: "Inappropriate", severity: "Low", reportedBy: "Priya Desai", time: "2h ago", status: "New" },
  { report: "Off-Topic / Irrelevant", context: "AI Alignment Debate", type: "Off-Topic", severity: "Low", reportedBy: "James Wu", time: "3h ago", status: "Dismissed" },
];

const ALERTS: AlertItem[] = [
  { title: "Spike in harassment reports", detail: "42% vs. last 24h", time: "15m ago", icon: Flag, tone: "red" },
  { title: "Misinformation trend detected", detail: "2 discussions affected", time: "1h ago", icon: TriangleAlert, tone: "amber" },
  { title: "Unusual login activity", detail: "5 accounts flagged", time: "2h ago", icon: ShieldAlert, tone: "blue" },
];

const TEAM_ACTIVITY: ActivityItem[] = [
  { person: "Nadia Karim", action: "Resolved 18 reports", detail: "Moderation", time: "2m ago" },
  { person: "Alex Rivera", action: "Reviewed 12 items", detail: "Safety queue", time: "8m ago" },
  { person: "Priya Desai", action: "Closed 7 tickets", detail: "Support", time: "12m ago" },
  { person: "Mason Alvarado", action: "Approved 5 requests", detail: "Labs", time: "15m ago" },
];

const RECENT_ACTIVITY: ActivityItem[] = [
  { person: "Nadia Karim", action: "updated the status of a report in The Future of Work", detail: "Marked as In Review", time: "15m ago" },
  { person: "Mason Alvarado", action: "resolved a support ticket", detail: "Ticket #8742 · Unable to upload file", time: "32m ago" },
  { person: "Alex Rivera", action: "approved a labs request", detail: "Request · Climate Data Explorer", time: "1h ago" },
  { person: "System", action: "flagged a potential misinformation pattern in 2 discussions", detail: "Auto-detection", time: "2h ago" },
];

const QUICK_ACTIONS: QuickAction[] = [
  { label: "Create Announcement", icon: Bell, href: "/admin" },
  { label: "Bulk User Actions", icon: UserRoundCheck, href: "/admin/users" },
  { label: "Export Reports", icon: Download, href: "/admin/reports" },
  { label: "System Health", icon: Activity, href: "/admin" },
];

const BENEFITS = [
  { label: "Moderation Overview", detail: "See what needs attention with real-time metrics and queues.", icon: ShieldCheck },
  { label: "Safety Queue", detail: "Review reports and take action quickly with smart prioritization.", icon: MessageCircle },
  { label: "Operational Visibility", detail: "Track platform health, trends, and team performance.", icon: BarChart3 },
  { label: "Admin Tools", detail: "Powerful tools for support, users, content, and settings.", icon: Wrench },
];

function getDefaultShellPayload(): ShellPayload {
  return {
    version: "v1",
    configured: false,
    authenticated: false,
    flags: DEFAULT_FLAGS,
  };
}

function getSeverityClass(severity: QueueItem["severity"]) {
  if (severity === "High") return "bg-red-50 text-red-700";
  if (severity === "Medium") return "bg-amber-50 text-amber-700";
  return "bg-blue-50 text-blue-700";
}

function getStatusClass(status: QueueItem["status"]) {
  if (status === "In Review") return "bg-violet-50 text-violet-700";
  if (status === "Dismissed") return "bg-slate-100 text-slate-600";
  return "bg-blue-50 text-blue-700";
}

function getStatToneClass(tone: StatCard["tone"]) {
  if (tone === "red") return "bg-red-50 text-red-700";
  if (tone === "emerald") return "bg-emerald-50 text-emerald-700";
  return "bg-blue-50 text-blue-700";
}

function getAlertToneClass(tone: AlertItem["tone"]) {
  if (tone === "red") return "bg-red-50 text-red-700";
  if (tone === "amber") return "bg-amber-50 text-amber-700";
  return "bg-blue-50 text-blue-700";
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
          <Link href="/admin" className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:text-white">Open current Admin</Link>
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

function AdminSidebar() {
  return (
    <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white p-5 lg:block">
      <div className="mb-8 flex items-center gap-3 text-xl font-black text-slate-950"><Shield className="size-6" />Admin</div>
      <nav className="space-y-7">
        {ADMIN_NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-slate-500">{group.label}</p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                return <Link key={item.label} href={item.href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-black transition ${item.active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-blue-50 hover:text-blue-700"}`}><Icon className="size-4" />{item.label}</Link>;
              })}
            </div>
          </div>
        ))}
      </nav>
      <button type="button" className="mt-16 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-600 transition hover:bg-blue-50 hover:text-blue-700"><ChevronLeft className="size-4" />Collapse</button>
    </aside>
  );
}

function StatCardView({ stat }: { stat: StatCard }) {
  const Icon = stat.icon;
  const TrendIcon = stat.trendDirection === "up" ? TrendingUp : TrendingDown;
  const trendClass = stat.trendDirection === "up" && stat.tone === "red" ? "text-red-600" : "text-emerald-600";
  return (
    <article className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-sm font-black text-slate-700">{stat.label}</p><p className="mt-3 text-3xl font-black text-slate-950">{stat.value}</p></div>
        <span className={`grid size-12 place-items-center rounded-2xl ${getStatToneClass(stat.tone)}`}><Icon className="size-5" /></span>
      </div>
      <p className={`mt-5 inline-flex items-center gap-2 text-sm font-black ${trendClass}`}><TrendIcon className="size-4" />{stat.trend}</p>
    </article>
  );
}

function ModerationQueue() {
  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-black text-slate-950">Moderation Queue <span className="ml-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">126</span></h2>
        <div className="flex gap-2">
          <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:bg-blue-50 hover:text-blue-700"><Filter className="size-4" />Filters</button>
          <button type="button" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:bg-blue-50 hover:text-blue-700">Newest</button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
            <tr>
              <th className="px-5 py-4">Report / Item</th><th className="px-4 py-4">Type</th><th className="px-4 py-4">Severity</th><th className="px-4 py-4">Reported By</th><th className="px-4 py-4">Time</th><th className="px-4 py-4">Status</th><th className="px-4 py-4" />
            </tr>
          </thead>
          <tbody>
            {QUEUE_ITEMS.map((item) => <tr key={item.report} className="border-t border-slate-100"><td className="px-5 py-4"><p className="font-black text-slate-900">{item.report}</p><p className="text-xs font-semibold text-slate-500">{item.context}</p></td><td className="px-4 py-4 font-semibold text-slate-600">{item.type}</td><td className="px-4 py-4"><span className={`rounded-lg px-3 py-1 text-xs font-black ${getSeverityClass(item.severity)}`}>{item.severity}</span></td><td className="px-4 py-4"><span className="inline-flex items-center gap-2 font-semibold text-slate-700"><span className="grid size-8 place-items-center rounded-full bg-slate-900 text-[10px] font-black text-white">{item.reportedBy.split(" ").map((part) => part[0]).join("")}</span>{item.reportedBy}</span></td><td className="px-4 py-4 font-semibold text-slate-500">{item.time}</td><td className="px-4 py-4"><span className={`rounded-lg px-3 py-1 text-xs font-black ${getStatusClass(item.status)}`}>{item.status}</span></td><td className="px-4 py-4"><MoreHorizontal className="size-4 text-slate-500" /></td></tr>)}
          </tbody>
        </table>
      </div>
      <Link href="/admin/reports" className="flex items-center justify-center gap-2 border-t border-slate-100 px-4 py-4 text-sm font-black text-blue-700 hover:bg-blue-50">View all reports <ChevronRight className="size-4" /></Link>
    </section>
  );
}

function RecentActivity() {
  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black text-slate-950">Recent Activity</h2>
      <div className="mt-4 divide-y divide-slate-100">
        {RECENT_ACTIVITY.map((item) => <div key={`${item.person}-${item.time}`} className="flex items-start gap-3 py-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-900 text-[10px] font-black text-white">{item.person === "System" ? "S" : item.person.split(" ").map((part) => part[0]).join("")}</span><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-700"><span className="font-black text-slate-950">{item.person}</span> {item.action}</p><p className="text-xs font-semibold text-slate-500">{item.detail}</p></div><span className="text-xs font-semibold text-slate-500">{item.time}</span></div>)}
      </div>
      <Link href="/admin/audit" className="mt-3 flex items-center justify-center gap-2 text-sm font-black text-blue-700">View all activity <ChevronRight className="size-4" /></Link>
    </section>
  );
}

export default function V2AdminPage() {
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

  if (loading) return <GateCard title="Checking V2 Admin access" message="Loombus is verifying access before loading the V2 Admin shell." loading />;
  if (!payload?.authenticated) return <GateCard title="Sign in required" message="The V2 Admin shell is internal-only right now. Sign in first so Loombus can check your v2_shell access." payload={payload} />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") return <GateCard title="V2 Admin is not enabled" message="This account is not currently allowed through the v2_shell flag. Public users remain on V1." payload={payload} />;

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7fbff] text-slate-950">
      <V2TopNav />
      <div className="mx-auto flex max-w-7xl bg-white/40">
        <AdminSidebar />
        <section className="min-w-0 flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-8">
          <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div><h1 className="text-3xl font-black tracking-tight text-slate-950">Admin Overview</h1><p className="mt-2 text-sm leading-6 text-slate-600">Monitor platform health, moderate content, and support your community.</p></div>
            <button type="button" className="inline-flex w-fit items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm"><CalendarDays className="size-4 text-blue-700" />May 20 – May 26, 2025 <ChevronDown className="size-4" /></button>
          </header>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{STATS.map((stat) => <StatCardView key={stat.label} stat={stat} />)}</section>

          <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-5"><ModerationQueue /><RecentActivity /></div>
            <aside className="space-y-4">
              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between"><h2 className="text-lg font-black text-slate-950">Priority Alerts</h2><span className="grid size-7 place-items-center rounded-full bg-red-50 text-sm font-black text-red-600">3</span></div>
                <div className="mt-4 space-y-4">{ALERTS.map((alert) => { const Icon = alert.icon; return <div key={alert.title} className="flex items-start gap-3"><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${getAlertToneClass(alert.tone)}`}><Icon className="size-4" /></span><div className="min-w-0 flex-1"><p className="text-sm font-black text-slate-900">{alert.title}</p><p className="text-xs font-semibold text-slate-500">{alert.detail}</p></div><span className="text-xs font-semibold text-slate-500">{alert.time}</span></div>; })}</div>
                <Link href="/admin/reports" className="mt-5 flex items-center justify-center gap-2 text-sm font-black text-blue-700">View all alerts <ChevronRight className="size-4" /></Link>
              </section>

              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between"><h2 className="text-lg font-black text-slate-950">Team Activity</h2><Link href="/admin/audit" className="text-sm font-black text-blue-700">View all</Link></div>
                <div className="mt-4 space-y-4">{TEAM_ACTIVITY.map((item) => <div key={item.person} className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-slate-900 text-[10px] font-black text-white">{item.person.split(" ").map((part) => part[0]).join("")}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-slate-900">{item.person}</p><p className="truncate text-xs font-semibold text-slate-500">{item.action}</p></div><span className="text-xs font-semibold text-slate-500">{item.time}</span></div>)}</div>
              </section>

              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-black text-slate-950">Quick Actions</h2>
                <div className="mt-4 grid grid-cols-2 gap-3">{QUICK_ACTIONS.map((action) => { const Icon = action.icon; return <Link key={action.label} href={action.href} className="rounded-xl border border-slate-200 p-4 text-sm font-black text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"><Icon className="mb-3 size-5 text-blue-700" />{action.label}</Link>; })}</div>
              </section>
            </aside>
          </section>

          <section className="mt-6 grid gap-4 md:grid-cols-4">{BENEFITS.map((benefit) => { const Icon = benefit.icon; return <article key={benefit.label} className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm"><span className="grid size-12 place-items-center rounded-xl bg-blue-50 text-blue-700"><Icon className="size-5" /></span><h3 className="mt-3 text-sm font-black text-blue-700">{benefit.label}</h3><p className="mt-1 text-sm leading-6 text-slate-600">{benefit.detail}</p></article>; })}</section>
        </section>
      </div>
      <MobileBottomNav />
    </main>
  );
}
