"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  CheckCircle2,
  ChevronRight,
  Clock3,
  CreditCard,
  FileText,
  Mail,
  MessageCircle,
  Search,
  Settings,
  ShieldCheck,
  Smartphone,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import {
  getDefaultShellPayload,
  V2ShellGateCard,
  V2ShellMobileNav,
  V2ShellTopNav,
  type ShellPayload,
} from "../v2-shell-components";

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
  href: string;
};

type TicketPreview = {
  title: string;
  status: string;
  updated: string;
};

type SystemStatusItem = {
  label: string;
  status: string;
  detail: string;
};

type SupportBenefit = {
  label: string;
  detail: string;
  icon: LucideIcon;
};

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

const SUPPORT_ARTICLES: Article[] = [
  { title: "Create and manage discussions", lane: "Discussions", readTime: "Live guide", href: "/v2/discussions" },
  { title: "Account and appearance settings", lane: "Settings", readTime: "Live guide", href: "/v2/settings" },
  { title: "Privacy and security controls", lane: "Security", readTime: "Live guide", href: "/v2/privacy-security" },
  { title: "Premium plans and billing", lane: "Billing", readTime: "Live guide", href: "/v2/premium" },
  { title: "Messages and notifications", lane: "Messages", readTime: "Live guide", href: "/v2/notifications" },
];

const RECENT_TICKETS: TicketPreview[] = [
  { title: "Support ticket history", status: "Read-only preview", updated: "Live ticket feed not connected yet" },
  { title: "Bug report intake", status: "Email handoff", updated: "Opens support email safely" },
  { title: "Admin support queue", status: "Existing route", updated: "Reviewed from admin tools" },
];

const SYSTEM_STATUS: SystemStatusItem[] = [
  { label: "Core Loombus", status: "Manual check", detail: "Use deployed app checks for live incident confirmation." },
  { label: "Billing", status: "Manual check", detail: "Stripe and Apple flows stay on their existing production paths." },
  { label: "Mobile apps", status: "Manual check", detail: "iOS and Android app status should be verified from the stores." },
];

const SUPPORT_BENEFITS: SupportBenefit[] = [
  { label: "Account context", detail: "Report links include the signed-in account email when available.", icon: UserRound },
  { label: "Safe handoff", detail: "Support actions use mailto links and live guide links only from this page.", icon: ShieldCheck },
  { label: "Fast triage", detail: "Categories separate account, billing, messages, mobile, and safety issues.", icon: CheckCircle2 },
  { label: "V2 ready", detail: "The page stays inside the V2 shell with neutral appearance support.", icon: Settings },
];

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

function PopularArticlesCard({ query }: { query: string }) {
  const cleanQuery = query.trim().toLowerCase();
  const articles = SUPPORT_ARTICLES.filter((article) => {
    if (!cleanQuery) return true;
    return [article.title, article.lane].join(" ").toLowerCase().includes(cleanQuery);
  });

  return (
    <section className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xs font-black uppercase tracking-[0.14em] text-slate-700">Popular Articles</h2>
        <span className="text-xs font-black text-slate-400">Live links</span>
      </div>
      <div className="space-y-4">
        {articles.map((article) => (
          <Link key={article.href} href={article.href} className="flex items-start gap-3 rounded-2xl transition hover:bg-blue-50">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-slate-200 bg-blue-50 text-blue-700">
              <FileText className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-black text-slate-950">{article.title}</span>
              <span className="block text-xs font-semibold text-slate-500">{article.lane} · {article.readTime}</span>
            </span>
          </Link>
        ))}
        {articles.length === 0 && <p className="text-sm font-semibold text-slate-500">No matching articles yet.</p>}
      </div>
    </section>
  );
}

function StillNeedHelpCard({ userEmail }: { userEmail: string | null }) {
  const subject = encodeURIComponent("Loombus support request");
  const body = encodeURIComponent(`What do you need help with?\n\nAccount: ${userEmail ?? "Not available"}\nPage: /v2/support\n`);

  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700 ring-1 ring-blue-100">
          <Mail className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-black text-slate-950">Still need help?</h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">Send Loombus support a focused message with your account context included.</p>
          <a href={`mailto:support@loombus.com?subject=${subject}&body=${body}`} className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2 text-sm font-black text-white transition hover:bg-blue-700">
            Contact support
            <ChevronRight className="size-4" />
          </a>
        </div>
      </div>
    </section>
  );
}

function RecentTicketsCard() {
  return (
    <section className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xs font-black uppercase tracking-[0.14em] text-slate-700">Recent Tickets</h2>
        <Clock3 className="size-4 text-slate-400" />
      </div>
      <div className="space-y-3">
        {RECENT_TICKETS.map((ticket) => (
          <article key={ticket.title} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm font-black text-slate-950">{ticket.title}</h3>
              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-black text-slate-500 ring-1 ring-slate-200">{ticket.status}</span>
            </div>
            <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{ticket.updated}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function SystemStatusCard() {
  return (
    <section className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xs font-black uppercase tracking-[0.14em] text-slate-700">System Status</h2>
        <ShieldCheck className="size-4 text-emerald-600" />
      </div>
      <div className="space-y-3">
        {SYSTEM_STATUS.map((item) => (
          <article key={item.label} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">
            <span className="mt-1 size-2 shrink-0 rounded-full bg-emerald-500" />
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2 text-sm font-black text-slate-950">
                {item.label}
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-black text-slate-500 ring-1 ring-slate-200">{item.status}</span>
              </span>
              <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">{item.detail}</span>
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}

function ReportIssueCard({ userEmail }: { userEmail: string | null }) {
  const subject = encodeURIComponent("Loombus support issue");
  const body = encodeURIComponent(`Please describe what happened:\n\nAccount: ${userEmail ?? "Not available"}\nPage: /v2/support\n`);

  return (
    <section className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xs font-black uppercase tracking-[0.14em] text-slate-700">Report an Issue</h2>
      <div className="mt-4 flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-red-50 text-red-600">
          <TriangleAlert className="size-5" />
        </span>
        <div>
          <h3 className="text-sm font-black text-slate-950">Found a bug or unexpected behavior?</h3>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">Open a support email with your account context included.</p>
          <a href={`mailto:support@loombus.com?subject=${subject}&body=${body}`} className="mt-4 inline-flex items-center gap-1 text-xs font-black text-blue-700">
            Report an Issue
            <ChevronRight className="size-3.5" />
          </a>
        </div>
      </div>
    </section>
  );
}

function SupportBenefitCard({ benefit }: { benefit: SupportBenefit }) {
  const Icon = benefit.icon;

  return (
    <article className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm">
      <span className="grid size-10 place-items-center rounded-2xl bg-slate-50 text-slate-700 ring-1 ring-slate-200">
        <Icon className="size-5" />
      </span>
      <h3 className="mt-4 text-sm font-black text-slate-950">{benefit.label}</h3>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{benefit.detail}</p>
    </article>
  );
}

export default function V2SupportPage() {
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const categories = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return HELP_CATEGORIES;
    return HELP_CATEGORIES.filter((category) => [category.label, category.description, category.eyebrow].join(" ").toLowerCase().includes(cleanQuery));
  }, [query]);

  async function loadShell() {
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      setUserEmail(data.session?.user.email ?? null);
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

  if (loading) return <V2ShellGateCard title="Checking V2 Support access" message="Loombus is verifying access before loading the V2 Support shell." loading />;
  if (!payload?.authenticated) return <V2ShellGateCard title="Sign in required" message="The V2 Support shell is internal-only right now. Sign in first so Loombus can check your v2_shell access." payload={payload} />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") return <V2ShellGateCard title="V2 Support is not enabled" message="This account is not currently allowed through the v2_shell flag. Public users remain on V1." payload={payload} />;

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7f7f8] loombus-v2-page-bg text-slate-950">
      <V2ShellTopNav />
      <section className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8">
        <header className="mb-5">
          <p className="mb-2 text-xs font-black uppercase tracking-[0.32em] text-blue-700 md:hidden">Account</p>
          <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Support</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Get help, find answers, and contact the Loombus team.</p>
        </header>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-5">
            <div className="flex gap-3">
              <label className="relative flex-1">
                <span className="sr-only">Search support topics</span>
                <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Search help articles, topics, and keywords" className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-sm font-semibold text-slate-700 shadow-sm outline-none transition placeholder:text-slate-500 focus:border-blue-300 focus:ring-4 focus:ring-blue-100" />
              </label>
              <button type="button" aria-label="Support filters" className="grid size-14 shrink-0 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-blue-50 hover:text-blue-700 md:hidden">
                <Settings className="size-5" />
              </button>
            </div>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="mb-4 text-lg font-black text-slate-950">How can we help?</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {categories.map((category) => <CategoryCard key={category.label} category={category} />)}
              </div>
              {categories.length === 0 && <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">No support categories match that search.</p>}
            </section>
          </div>

          <aside className="space-y-4">
            <StillNeedHelpCard userEmail={userEmail} />
            <PopularArticlesCard query={query} />
            <RecentTicketsCard />
            <SystemStatusCard />
            <ReportIssueCard userEmail={userEmail} />
          </aside>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {SUPPORT_BENEFITS.map((benefit) => <SupportBenefitCard key={benefit.label} benefit={benefit} />)}
        </section>
      </section>
      <V2ShellMobileNav />
    </main>
  );
}
