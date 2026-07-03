"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileText,
  Flag,
  FlaskConical,
  HeartPulse,
  Home,
  Inbox,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  MessageCircle,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
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

type AdminCounts = {
  totalUsers: number;
  totalReports: number;
  openReports: number;
  dismissedReports: number;
  actionedReports: number;
  profileReports: number;
  deletedDiscussions: number;
  deletedReplies: number;
  labsRequests: number;
  supportRequests: number;
  safetyEvents: number;
  auditEvents: number;
};

type StatCard = {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone: "blue" | "red" | "emerald" | "amber";
  href: string;
};

type AdminNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  active?: boolean;
};

type AdminModule = {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  countKey?: keyof AdminCounts;
  action: string;
};

type ReportPreview = {
  id: string;
  reason: string | null;
  status: string | null;
  created_at: string;
  discussion_id: string | null;
  reply_id: string | null;
  reported_profile_id: string | null;
  discussions: { title: string | null; topic: string | null } | null;
  replies: { body: string | null } | null;
};

type AuditPreview = {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  created_at: string;
  actor_id: string | null;
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

const EMPTY_COUNTS: AdminCounts = {
  totalUsers: 0,
  totalReports: 0,
  openReports: 0,
  dismissedReports: 0,
  actionedReports: 0,
  profileReports: 0,
  deletedDiscussions: 0,
  deletedReplies: 0,
  labsRequests: 0,
  supportRequests: 0,
  safetyEvents: 0,
  auditEvents: 0,
};

const V2_NAV_ITEMS = [
  { label: "Home", href: "/v2", icon: Home },
  { label: "Discussions", href: "/v2/discussions", icon: MessageCircle },
  { label: "Create", href: "/v2/create", icon: Plus, primary: true },
  { label: "Rooms", href: "/v2/rooms", icon: Users },
  { label: "Messages", href: "/v2/messages", icon: Mail },
];

const MOBILE_NAV_ITEMS = V2_NAV_ITEMS;

const ADMIN_MODULES: AdminModule[] = [
  {
    label: "Reports",
    description: "Review community-submitted moderation reports for discussions, replies, profiles, and private messages.",
    href: "/admin/reports",
    icon: Flag,
    countKey: "openReports",
    action: "Open reports",
  },
  {
    label: "Safety Queue",
    description: "Review pre-submit safety blocks and warnings from rule-based and AI-assisted checks.",
    href: "/admin/safety",
    icon: ShieldCheck,
    countKey: "safetyEvents",
    action: "Open safety",
  },
  {
    label: "Deleted Discussions",
    description: "Review and restore soft-deleted discussions when needed.",
    href: "/admin/deleted",
    icon: RotateCcw,
    countKey: "deletedDiscussions",
    action: "Open deleted discussions",
  },
  {
    label: "Deleted Replies",
    description: "Review and restore soft-deleted replies when needed.",
    href: "/admin/deleted-replies",
    icon: MessageCircle,
    countKey: "deletedReplies",
    action: "Open deleted replies",
  },
  {
    label: "Support Requests",
    description: "Review structured contact form submissions and track support status.",
    href: "/admin/support",
    icon: Inbox,
    countKey: "supportRequests",
    action: "Open support",
  },
  {
    label: "User Lookup",
    description: "Search members, review account status, Premium access, teen safety, and identity verification.",
    href: "/admin/users",
    icon: Users,
    countKey: "totalUsers",
    action: "Open users",
  },
  {
    label: "Billing Diagnostics",
    description: "Review Stripe config presence, subscription sync, and Extra AI Pack fulfillment.",
    href: "/admin/billing",
    icon: KeyRound,
    action: "Open billing",
  },
  {
    label: "Platform Health",
    description: "Review config presence, database visibility, AI failures, reports, and operational warnings.",
    href: "/admin/health",
    icon: HeartPulse,
    action: "Open health",
  },
  {
    label: "AI Access",
    description: "Manage Premium AI-Assisted Layer access and review AI usage.",
    href: "/admin/ai-access",
    icon: Bot,
    action: "Open AI access",
  },
  {
    label: "Topic Memory",
    description: "Review recurring topics, Reality Lenses, tags, and AI idea coverage.",
    href: "/admin/topic-memory",
    icon: BarChart3,
    action: "Open topic memory",
  },
  {
    label: "Loombus Labs",
    description: "Review Premium Plus feature requests and update Labs status.",
    href: "/admin/labs",
    icon: FlaskConical,
    countKey: "labsRequests",
    action: "Open labs",
  },
  {
    label: "Audit Log",
    description: "Review platform activity, moderation actions, actors, targets, and system events.",
    href: "/admin/audit",
    icon: FileText,
    countKey: "auditEvents",
    action: "Open audit log",
  },
];

const ADMIN_NAV_GROUPS: Array<{ label: string; items: AdminNavItem[] }> = [
  { label: "Overview", items: [{ label: "Overview", href: "/v2/admin", icon: Home, active: true }] },
  {
    label: "Moderation",
    items: [
      { label: "Reports", href: "/admin/reports", icon: Flag },
      { label: "Safety Queue", href: "/admin/safety", icon: ShieldCheck },
      { label: "Deleted Discussions", href: "/admin/deleted", icon: RotateCcw },
      { label: "Deleted Replies", href: "/admin/deleted-replies", icon: MessageCircle },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Users", href: "/admin/users", icon: Users },
      { label: "Support Requests", href: "/admin/support", icon: Inbox },
      { label: "Billing Diagnostics", href: "/admin/billing", icon: KeyRound },
      { label: "Platform Health", href: "/admin/health", icon: HeartPulse },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "AI Access", href: "/admin/ai-access", icon: Bot },
      { label: "Topic Memory", href: "/admin/topic-memory", icon: BarChart3 },
      { label: "Labs Requests", href: "/admin/labs", icon: FlaskConical },
      { label: "Audit Log", href: "/admin/audit", icon: FileText },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Settings", href: "/settings", icon: Settings },
      { label: "Current V1 Admin", href: "/admin", icon: Wrench },
    ],
  },
];

const QUICK_ACTIONS: QuickAction[] = [
  { label: "Review reports", icon: Flag, href: "/admin/reports" },
  { label: "Open users", icon: UserRoundCheck, href: "/admin/users" },
  { label: "Support queue", icon: Inbox, href: "/admin/support" },
  { label: "System health", icon: Activity, href: "/admin/health" },
];

const BENEFITS = [
  { label: "V1 parity", detail: "Every V1 admin destination is present and active from this V2 shell.", icon: ShieldCheck },
  { label: "Live metrics", detail: "Counts come from the same Supabase tables used by current admin tools.", icon: BarChart3 },
  { label: "Safe rollout", detail: "V2 shell remains gated while active actions continue to use existing admin routes.", icon: Lock },
  { label: "Operational focus", detail: "Reports, safety, support, users, billing, health, AI, Labs, and audit stay visible.", icon: Wrench },
];

function getDefaultShellPayload(): ShellPayload {
  return { version: "v1", configured: false, authenticated: false, flags: DEFAULT_FLAGS };
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function normalizeJoined<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function getReportTarget(report: ReportPreview) {
  if (report.discussions?.title) return report.discussions.title;
  if (report.replies?.body) return `Reply: ${report.replies.body.slice(0, 70)}`;
  if (report.reported_profile_id) return "Reported profile";
  return report.discussion_id || report.reply_id || "Reported item";
}

function getStatusClass(status: string | null | undefined) {
  if (status === "actioned") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "dismissed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "reviewing") return "border-violet-200 bg-violet-50 text-violet-700";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

function getStatToneClass(tone: StatCard["tone"]) {
  if (tone === "red") return "bg-red-50 text-red-700";
  if (tone === "emerald") return "bg-emerald-50 text-emerald-700";
  if (tone === "amber") return "bg-amber-50 text-amber-700";
  return "bg-blue-50 text-blue-700";
}

function getModuleCount(module: AdminModule, counts: AdminCounts) {
  if (!module.countKey) return null;
  return counts[module.countKey];
}

function getStats(counts: AdminCounts): StatCard[] {
  return [
    {
      label: "Total Users",
      value: formatCount(counts.totalUsers),
      detail: "Profiles visible to admin lookup",
      icon: Users,
      tone: "blue",
      href: "/admin/users",
    },
    {
      label: "New Reports",
      value: formatCount(counts.openReports),
      detail: `${formatCount(counts.totalReports)} total moderation reports`,
      icon: Flag,
      tone: counts.openReports > 0 ? "red" : "emerald",
      href: "/admin/reports",
    },
    {
      label: "Support Backlog",
      value: formatCount(counts.supportRequests),
      detail: "New or reviewing support requests",
      icon: Inbox,
      tone: counts.supportRequests > 0 ? "amber" : "emerald",
      href: "/admin/support",
    },
    {
      label: "Safety Events",
      value: formatCount(counts.safetyEvents),
      detail: "Blocked or warned content events",
      icon: ShieldCheck,
      tone: counts.safetyEvents > 0 ? "amber" : "emerald",
      href: "/admin/safety",
    },
  ];
}

function GateCard({ title, message, loading = false, payload }: { title: string; message: string; loading?: boolean; payload?: ShellPayload | null }) {
  return (
    <main className="fixed inset-0 z-[80] flex min-h-screen items-center justify-center overflow-y-auto bg-[#f7f7f8] loombus-v2-page-bg px-4 py-10 text-slate-950">
      <section className="w-full max-w-2xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-200/70 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-900 ring-1 ring-slate-200">
            {loading ? <Loader2 className="size-5 animate-spin" /> : <Lock className="size-5" />}
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">Loombus V2</p>
            <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{title}</h1>
          </div>
        </div>
        <p className="text-sm leading-6 text-slate-600 sm:text-base">{message}</p>
        {payload && <p className="mt-5 text-xs font-semibold text-slate-500">v2_shell: {payload.flags.v2_shell ? "on" : "off"}</p>}
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/v2" className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-black text-white transition hover:bg-slate-800">Back to V2 Home</Link>
          <Link href="/admin" className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50">Open current Admin</Link>
        </div>
      </section>
    </main>
  );
}

function V2TopNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-[#061942] loombus-v2-top-nav shadow-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/v2" className="flex items-center gap-3 font-bold">
          <img src="/assets/brand/loombus-mark-transparent.png" alt="" className="size-9 object-contain" />
          <span className="text-xl">Loombus</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {V2_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return <Link key={item.label} href={item.href} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${item.primary ? "border border-white/40 text-white hover:bg-white/10" : "text-blue-100 hover:bg-white/10 hover:text-white"}`}><Icon className="size-4" />{item.label}</Link>;
          })}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/v2/search" aria-label="Search" className="grid size-10 place-items-center rounded-full text-blue-100 transition hover:bg-white/10 hover:text-white"><Search className="size-5" /></Link>
          <Link href="/v2/notifications" aria-label="Notifications" className="relative grid size-10 place-items-center rounded-full text-blue-100 transition hover:bg-white/10 hover:text-white"><Bell className="size-5" /></Link>
        </div>
      </div>
    </header>
  );
}

function MobileBottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 loombus-v2-bottom-nav px-3 pb-3 pt-2 shadow-2xl backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1 text-xs font-semibold text-slate-500">
        {MOBILE_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return <Link key={item.label} href={item.href} className="flex flex-col items-center gap-1 rounded-2xl py-2 text-slate-500"><Icon className={`size-5 ${item.primary ? "rounded-full bg-blue-600 p-1 text-white" : ""}`} /><span>{item.label}</span></Link>;
        })}
      </div>
    </nav>
  );
}

function AdminSidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white p-5 lg:block">
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
  return (
    <Link href={stat.href} className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black text-slate-700">{stat.label}</p>
          <p className="mt-3 text-3xl font-black text-slate-950">{stat.value}</p>
        </div>
        <span className={`grid size-12 place-items-center rounded-2xl ${getStatToneClass(stat.tone)}`}><Icon className="size-5" /></span>
      </div>
      <p className="mt-5 text-sm font-semibold text-slate-500">{stat.detail}</p>
    </Link>
  );
}

function ModerationQueue({ reports, count }: { reports: ReportPreview[]; count: number }) {
  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-black text-slate-950">Moderation Queue <span className="ml-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">{formatCount(count)}</span></h2>
        <Link href="/admin/reports" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:bg-blue-50 hover:text-blue-700"><Flag className="size-4" />Open reports</Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-xs font-black uppercase tracking-[0.12em] text-slate-500"><tr><th className="px-5 py-4">Report / Item</th><th className="px-4 py-4">Reason</th><th className="px-4 py-4">Status</th><th className="px-4 py-4">Created</th><th className="px-4 py-4" /></tr></thead>
          <tbody>
            {reports.length > 0 ? reports.map((report) => (
              <tr key={report.id} className="border-t border-slate-100">
                <td className="px-5 py-4"><p className="font-black text-slate-900">{getReportTarget(report)}</p><p className="text-xs font-semibold text-slate-500">{report.discussions?.topic ?? (report.reply_id ? "Reply report" : report.reported_profile_id ? "Profile report" : "Moderation report")}</p></td>
                <td className="px-4 py-4 font-semibold text-slate-600">{report.reason ?? "Unspecified"}</td>
                <td className="px-4 py-4"><span className={`rounded-lg border px-3 py-1 text-xs font-black ${getStatusClass(report.status)}`}>{report.status ?? "new"}</span></td>
                <td className="px-4 py-4 font-semibold text-slate-500">{formatTime(report.created_at)}</td>
                <td className="px-4 py-4"><Link href="/admin/reports" className="text-sm font-black text-blue-700">Review</Link></td>
              </tr>
            )) : (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-sm font-semibold text-slate-500">No recent reports loaded.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Link href="/admin/reports" className="flex items-center justify-center gap-2 border-t border-slate-100 px-4 py-4 text-sm font-black text-blue-700 hover:bg-blue-50">View all reports <ChevronRight className="size-4" /></Link>
    </section>
  );
}

function RecentActivity({ activity }: { activity: AuditPreview[] }) {
  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between"><h2 className="text-lg font-black text-slate-950">Recent Activity</h2><Link href="/admin/audit" className="text-sm font-black text-blue-700">View all</Link></div>
      <div className="mt-4 divide-y divide-slate-100">
        {activity.length > 0 ? activity.map((item) => (
          <div key={item.id} className="flex items-start gap-3 py-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-900 text-[10px] font-black text-white">{item.action.slice(0, 1).toUpperCase()}</span>
            <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-700"><span className="font-black text-slate-950">{item.action.replaceAll(".", " ")}</span></p><p className="text-xs font-semibold text-slate-500">{item.target_type}{item.target_id ? ` · ${item.target_id}` : ""}</p></div>
            <span className="text-xs font-semibold text-slate-500">{formatTime(item.created_at)}</span>
          </div>
        )) : <p className="py-6 text-center text-sm font-semibold text-slate-500">No recent audit activity loaded.</p>}
      </div>
    </section>
  );
}

function AdminModuleGrid({ counts }: { counts: AdminCounts }) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {ADMIN_MODULES.map((module) => {
        const Icon = module.icon;
        const count = getModuleCount(module, counts);
        return (
          <Link key={module.href} href={module.href} className="group flex min-h-[210px] flex-col rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:bg-blue-50/40 hover:shadow-md">
            <div className="mb-5 flex items-start justify-between gap-4">
              <span className="grid size-12 place-items-center rounded-2xl bg-blue-50 text-blue-700"><Icon className="size-5" /></span>
              {typeof count === "number" && <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-black text-slate-700">{formatCount(count)}</span>}
            </div>
            <h3 className="text-lg font-black text-slate-950">{module.label}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{module.description}</p>
            <span className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-black text-blue-700">{module.action} <ChevronRight className="size-4 transition group-hover:translate-x-1" /></span>
          </Link>
        );
      })}
    </section>
  );
}

export default function V2AdminPage() {
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminChecked, setAdminChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [counts, setCounts] = useState<AdminCounts>(EMPTY_COUNTS);
  const [recentReports, setRecentReports] = useState<ReportPreview[]>([]);
  const [recentActivity, setRecentActivity] = useState<AuditPreview[]>([]);
  const [dataMessage, setDataMessage] = useState("");

  const stats = useMemo(() => getStats(counts), [counts]);

  async function loadAdminData() {
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      setIsAdmin(false);
      setAdminChecked(true);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (!profile?.is_admin) {
      setIsAdmin(false);
      setAdminChecked(true);
      return;
    }

    setIsAdmin(true);

    try {
      const [
        totalUsers,
        totalReports,
        openReports,
        dismissedReports,
        actionedReports,
        profileReports,
        deletedDiscussions,
        deletedReplies,
        labsRequests,
        supportRequests,
        safetyEvents,
        auditEvents,
        reportRows,
        auditRows,
      ] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("reports").select("*", { count: "exact", head: true }),
        supabase.from("reports").select("*", { count: "exact", head: true }).eq("status", "new"),
        supabase.from("reports").select("*", { count: "exact", head: true }).eq("status", "dismissed"),
        supabase.from("reports").select("*", { count: "exact", head: true }).eq("status", "actioned"),
        supabase.from("reports").select("*", { count: "exact", head: true }).not("reported_profile_id", "is", null),
        supabase.from("discussions").select("*", { count: "exact", head: true }).not("deleted_at", "is", null),
        supabase.from("replies").select("*", { count: "exact", head: true }).not("deleted_at", "is", null),
        supabase.from("labs_feature_requests").select("*", { count: "exact", head: true }),
        supabase.from("support_requests").select("*", { count: "exact", head: true }).in("status", ["new", "reviewing"]),
        supabase.from("audit_logs").select("*", { count: "exact", head: true }).in("action", ["content_safety.blocked", "content_safety.warned"]),
        supabase.from("audit_logs").select("*", { count: "exact", head: true }),
        supabase.from("reports").select("id, reason, status, created_at, discussion_id, reply_id, reported_profile_id, discussions(title, topic), replies(body)").order("created_at", { ascending: false }).limit(5),
        supabase.from("audit_logs").select("id, action, target_type, target_id, created_at, actor_id").order("created_at", { ascending: false }).limit(6),
      ]);

      setCounts({
        totalUsers: totalUsers.count ?? 0,
        totalReports: totalReports.count ?? 0,
        openReports: openReports.count ?? 0,
        dismissedReports: dismissedReports.count ?? 0,
        actionedReports: actionedReports.count ?? 0,
        profileReports: profileReports.count ?? 0,
        deletedDiscussions: deletedDiscussions.count ?? 0,
        deletedReplies: deletedReplies.count ?? 0,
        labsRequests: labsRequests.count ?? 0,
        supportRequests: supportRequests.count ?? 0,
        safetyEvents: safetyEvents.count ?? 0,
        auditEvents: auditEvents.count ?? 0,
      });

      setRecentReports(((reportRows.data ?? []) as any[]).map((report) => ({
        ...report,
        discussions: normalizeJoined(report.discussions),
        replies: normalizeJoined(report.replies),
      })) as ReportPreview[]);
      setRecentActivity((auditRows.data ?? []) as AuditPreview[]);
      setDataMessage("");
    } catch (error) {
      console.error("Unable to load V2 admin overview.", error);
      setDataMessage("Some admin overview data could not be loaded. Open the specific admin tool for full details.");
    } finally {
      setAdminChecked(true);
    }
  }

  async function loadShell() {
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const response = await fetch("/api/v2/shell", { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined });
      const nextPayload = (await response.json().catch(() => getDefaultShellPayload())) as ShellPayload;
      setPayload(nextPayload);

      if (nextPayload.authenticated && nextPayload.configured && nextPayload.flags.v2_shell && nextPayload.version === "v2") {
        await loadAdminData();
      } else {
        setAdminChecked(false);
        setIsAdmin(false);
      }
    } catch {
      setPayload(getDefaultShellPayload());
      setAdminChecked(false);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadShell();
    const { data } = supabase.auth.onAuthStateChange(() => { void loadShell(); });
    return () => data.subscription.unsubscribe();
  }, []);

  if (loading) return <GateCard title="Checking V2 Admin access" message="Loombus is verifying access before loading the V2 Admin shell." loading />;
  if (!payload?.authenticated) return <GateCard title="Sign in required" message="The V2 Admin shell is internal-only right now. Sign in first so Loombus can check your v2_shell access." payload={payload} />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") return <GateCard title="V2 Admin is not enabled" message="This account is not currently allowed through the v2_shell flag. Public users remain on V1." payload={payload} />;
  if (!adminChecked) return <GateCard title="Checking admin role" message="Loombus is confirming your admin role before loading admin tools." loading payload={payload} />;
  if (!isAdmin) return <GateCard title="Admin access denied" message="This area is available only to Loombus admin accounts." payload={payload} />;

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7f7f8] loombus-v2-page-bg text-slate-950">
      <V2TopNav />
      <div className="mx-auto flex max-w-7xl bg-white/40">
        <AdminSidebar />
        <section className="min-w-0 flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-8">
          <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-blue-700">V2 Admin · V1 tool parity</p>
              <h1 className="text-3xl font-black tracking-tight text-slate-950">Admin Overview</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Complete V2 shell overview for the current V1 admin surface. All modules below are active and continue to use existing admin permissions and workflows.</p>
            </div>
            <div className="inline-flex w-fit items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm"><CalendarDays className="size-4 text-blue-700" />Live overview <ChevronRight className="size-4 rotate-90" /></div>
          </header>

          {dataMessage && <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">{dataMessage}</div>}

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{stats.map((stat) => <StatCardView key={stat.label} stat={stat} />)}</section>

          <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-5"><ModerationQueue reports={recentReports} count={counts.openReports} /><RecentActivity activity={recentActivity} /></div>
            <aside className="space-y-4">
              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-lg font-black text-slate-950">Priority Alerts</h2><span className="grid size-7 place-items-center rounded-full bg-red-50 text-sm font-black text-red-600">{formatCount(counts.openReports + counts.supportRequests)}</span></div><div className="mt-4 space-y-4"><Link href="/admin/reports" className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-red-50 text-red-700"><Flag className="size-4" /></span><div className="min-w-0 flex-1"><p className="text-sm font-black text-slate-900">New reports</p><p className="text-xs font-semibold text-slate-500">{formatCount(counts.openReports)} reports need review</p></div></Link><Link href="/admin/support" className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700"><Inbox className="size-4" /></span><div className="min-w-0 flex-1"><p className="text-sm font-black text-slate-900">Support backlog</p><p className="text-xs font-semibold text-slate-500">{formatCount(counts.supportRequests)} requests new or reviewing</p></div></Link><Link href="/admin/safety" className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><TriangleAlert className="size-4" /></span><div className="min-w-0 flex-1"><p className="text-sm font-black text-slate-900">Safety events</p><p className="text-xs font-semibold text-slate-500">{formatCount(counts.safetyEvents)} blocked or warned records</p></div></Link></div></section>
              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-black text-slate-950">Quick Actions</h2><div className="mt-4 grid grid-cols-2 gap-3">{QUICK_ACTIONS.map((action) => { const Icon = action.icon; return <Link key={action.label} href={action.href} className="rounded-xl border border-slate-200 p-4 text-sm font-black text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"><Icon className="mb-3 size-5 text-blue-700" />{action.label}</Link>; })}</div></section>
              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><ShieldAlert className="size-4" /></span><div><h2 className="text-lg font-black text-slate-950">Access model</h2><p className="text-xs font-semibold text-slate-500">v2_shell + admin role required</p></div></div></section>
            </aside>
          </section>

          <section className="mt-6"><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-xl font-black text-slate-950">Complete Admin Tool Surface</h2><p className="mt-1 text-sm font-semibold text-slate-500">Every V1 admin destination is active from the V2 admin shell.</p></div><Link href="/admin" className="hidden rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-blue-50 hover:text-blue-700 sm:inline-flex">Open V1 dashboard</Link></div><AdminModuleGrid counts={counts} /></section>

          <section className="mt-6 grid gap-4 md:grid-cols-4">{BENEFITS.map((benefit) => { const Icon = benefit.icon; return <article key={benefit.label} className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm"><span className="grid size-12 place-items-center rounded-xl bg-blue-50 text-blue-700"><Icon className="size-5" /></span><h3 className="mt-3 text-sm font-black text-blue-700">{benefit.label}</h3><p className="mt-1 text-sm leading-6 text-slate-600">{benefit.detail}</p></article>; })}</section>
        </section>
      </div>
      <MobileBottomNav />
    </main>
  );
}
