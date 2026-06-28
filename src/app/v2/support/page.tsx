"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  ChevronRight,
  CreditCard,
  FileText,
  Home,
  Inbox,
  Loader2,
  Lock,
  Mail,
  MessageCircle,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Smartphone,
  TriangleAlert,
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

type HelpCategory = {
  label: string;
  description: string;
  eyebrow: string;
  icon: LucideIcon;
  tone: string;
};

type Article = {
  title: string;
  lane: string;
  readTime: string;
};

type Ticket = {
  title: string;
  number: string;
  status: "Open" | "In Progress" | "Closed";
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

const HELP_CATEGORIES: HelpCategory[] = [
  {
    label: "Account & Login",
    description: "Manage your account, password, and security settings.",
    eyebrow: "Account support",
    icon: UserRound,
    tone: "bg-blue-50 text-blue-700 ring-blue-100",
  },
  {
    label: "Discussions",
    description: "Learn about discussions, replies, and best practices.",
    eyebrow: "Discussion help",
    icon: MessageCircle,
    tone: "bg-violet-50 text-violet-700 ring-violet-100",
  },
  {
    label: "Messages",
    description: "Help with messaging, notifications, and conversation tools.",
    eyebrow: "Message support",
    icon: Mail,
    tone: "bg-blue-50 text-blue-700 ring-blue-100",
  },
  {
    label: "Billing & Payments",
    description: "Subscription plans, invoices, and billing questions.",
    eyebrow: "Premium support",
    icon: CreditCard,
    tone: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  },
  {
    label: "Mobile App",
    description: "Get help using Loombus on your mobile device.",
    eyebrow: "iOS and Android",
    icon: Smartphone,
    tone: "bg-violet-50 text-violet-700 ring-violet-100",
  },
  {
    label: "Safety & Trust",
    description: "Privacy, reporting, and community guidelines.",
    eyebrow: "Safety center",
    icon: ShieldCheck,
    tone: "bg-amber-50 text-amber-700 ring-amber-100",
  },
];

const POPULAR_ARTICLES: Article[] = [
  { title: "Getting started with Loombus", lane: "Beginner guide", readTime: "5 min read" },
  { title: "How to create a discussion", lane: "Discussions", readTime: "3 min read" },
  { title: "Managing notifications", lane: "Messages", readTime: "4 min read" },
  { title: "Inviting members to a room", lane: "Rooms", readTime: "2 min read" },
  { title: "Understanding permissions", lane: "Account", readTime: "4 min read" },
];

const RECENT_TICKETS: Ticket[] = [
  { title: "Can’t reset my password", number: "#5321", status: "Open", time: "1h ago" },
  { title: "Billing invoice question", number: "#5318", status: "In Progress", time: "1d ago" },
  { title: "Feature request: Export data", number: "#5299", status: "Closed", time: "3d ago" },
];

const BENEFITS: Benefit[] = [
  { label: "Fast Answers", detail: "Search help articles and find instant solutions.", icon: MessageCircle },
  { label: "Help by Category", detail: "Browse topics organized to help you solve problems quickly.", icon: Inbox },
  { label: "Contact Support", detail: "Reach out to our team and get personal assistance.", icon: Mail },
  { label: "Built for Trust", detail: "Secure, reliable, and committed to your success.", icon: ShieldCheck },
];

function getDefaultShellPayload(): ShellPayload {
  return {
    version: "v1",
    configured: false,
    authenticated: false,
    flags: DEFAULT_FLAGS,
  };
}

function getTicketStatusClass(status: Ticket["status"]) {
  if (status === "Open") return "bg-emerald-50 text-emerald-700";
  if (status === "In Progress") return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-600";
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

function CategoryCard({ category }: { category: HelpCategory }) {
  const Icon = category.icon;

  return (
    <article className="group relative flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md sm:min-h-[178px] sm:flex-col sm:justify-center sm:p-6 sm:text-center">
      <span className={`grid size-14 shrink-0 place-items-center rounded-2xl ring-1 ${category.tone}`}>
        <Icon className="size-7" />
      </span>
      <div className="min-w-0">
        <h3 className="text-sm font-black text-slate-950 sm:text-base">{category.label}</h3>
        <p className="mt-1 text-xs font-semibold leading-5 text-slate-600 sm:text-sm">{category.description}</p>
        <p className="mt-3 hidden items-center justify-center gap-1 text-xs font-black text-blue-700 sm:flex">
          View articles
          <ChevronRight className="size-3.5" />
        </p>
        <p className="mt-1 text-xs font-black text-blue-700 sm:hidden">{category.eyebrow}</p>
      </div>
      <ChevronRight className="absolute right-4 top-1/2 size-5 -translate-y-1/2 text-blue-700 sm:hidden" />
    </article>
  );
}

function PopularArticlesCard() {
  return (
    <section className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xs font-black uppercase tracking-[0.14em] text-slate-700">Popular Articles</h2>
        <button type="button" className="text-xs font-black text-blue-700">View all</button>
      </div>
      <div className="space-y-4">
        {POPULAR_ARTICLES.map((article) => (
          <article key={article.title} className="flex items-start gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-slate-200 bg-blue-50 text-blue-700">
              <FileText className="size-4" />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-black text-slate-950">{article.title}</h3>
              <p className="text-xs font-semibold text-slate-500">{article.lane} · {article.readTime}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function RecentTicketsCard() {
  return (
    <section className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xs font-black uppercase tracking-[0.14em] text-slate-700">Recent Tickets</h2>
        <button type="button" className="text-xs font-black text-blue-700">View all</button>
      </div>
      <div className="space-y-4">
        {RECENT_TICKETS.map((ticket) => (
          <article key={ticket.number} className="flex items-start gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-blue-700">
              <MessageCircle className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-black text-slate-950">{ticket.title}</h3>
              <p className="text-xs font-semibold text-slate-500">
                {ticket.number}
                <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-black ${getTicketStatusClass(ticket.status)}`}>{ticket.status}</span>
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-500">{ticket.time}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function StatusCard() {
  return (
    <section className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xs font-black uppercase tracking-[0.14em] text-slate-700">System Status</h2>
      <div className="mt-4 flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700">
          <ShieldCheck className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-black text-slate-950">All Systems Operational</h3>
          <p className="text-xs font-semibold text-slate-500">Updated 5 min ago</p>
        </div>
      </div>
      <button type="button" className="mt-4 text-xs font-black text-blue-700">View status</button>
    </section>
  );
}

function ReportIssueCard() {
  return (
    <section className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xs font-black uppercase tracking-[0.14em] text-slate-700">Report an Issue</h2>
      <div className="mt-4 flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-red-50 text-red-600">
          <TriangleAlert className="size-5" />
        </span>
        <div>
          <h3 className="text-sm font-black text-slate-950">Found a bug or unexpected behavior?</h3>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">Help us improve Loombus.</p>
          <button type="button" className="mt-4 inline-flex items-center gap-1 text-xs font-black text-blue-700">
            Report an Issue
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
}

function StillNeedHelpCard() {
  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
      <div className="grid items-center gap-6 p-5 md:grid-cols-[minmax(0,1fr)_260px] md:p-7">
        <div>
          <h2 className="text-xl font-black text-slate-950">Still need help?</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Can&apos;t find what you&apos;re looking for? Contact our support team and we&apos;ll get back to you.</p>
          <button type="button" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-700">
            <MessageCircle className="size-4" />
            Contact Support
          </button>
        </div>
        <div className="hidden justify-end md:flex">
          <div className="relative grid size-40 place-items-center rounded-full bg-blue-50 text-blue-700">
            <MessageCircle className="size-20" />
            <span className="absolute -right-4 top-8 grid size-12 place-items-center rounded-2xl bg-white text-blue-700 shadow-lg">
              <Mail className="size-5" />
            </span>
            <span className="absolute -bottom-2 right-6 grid h-10 w-20 place-items-center rounded-2xl bg-white text-blue-700 shadow-lg">
              <span className="flex gap-1">
                <span className="size-1.5 rounded-full bg-blue-300" />
                <span className="size-1.5 rounded-full bg-blue-500" />
                <span className="size-1.5 rounded-full bg-blue-300" />
              </span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function V2SupportPage() {
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

  if (loading) return <GateCard title="Checking V2 Support access" message="Loombus is verifying access before loading the V2 Support shell." loading />;
  if (!payload?.authenticated) return <GateCard title="Sign in required" message="The V2 Support shell is internal-only right now. Sign in first so Loombus can check your v2_shell access." payload={payload} />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") return <GateCard title="V2 Support is not enabled" message="This account is not currently allowed through the v2_shell flag. Public users remain on V1." payload={payload} />;

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7fbff] text-slate-950">
      <V2TopNav />
      <section className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8">
        <header className="mb-5">
          <p className="mb-2 text-xs font-black uppercase tracking-[0.32em] text-blue-700 md:hidden">Account</p>
          <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Support</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Get help, find answers, and contact the Loombus team.</p>
        </header>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-5">
            <div className="flex gap-3">
              <label className="relative flex-1">
                <span className="sr-only">Search support topics</span>
                <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
                <input type="search" placeholder="Search help articles, topics, and keywords" className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-sm font-semibold text-slate-700 shadow-sm outline-none transition placeholder:text-slate-500 focus:border-blue-300 focus:ring-4 focus:ring-blue-100" />
              </label>
              <button type="button" aria-label="Support filters" className="grid size-14 shrink-0 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-blue-50 hover:text-blue-700 md:hidden">
                <Settings className="size-5" />
              </button>
            </div>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="mb-4 text-lg font-black text-slate-950">How can we help?</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {HELP_CATEGORIES.map((category) => <CategoryCard key={category.label} category={category} />)}
              </div>
            </section>

            <StillNeedHelpCard />
          </div>

          <aside className="space-y-4">
            <PopularArticlesCard />
            <RecentTicketsCard />
            <StatusCard />
            <ReportIssueCard />
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
      <MobileBottomNav />
    </main>
  );
}
