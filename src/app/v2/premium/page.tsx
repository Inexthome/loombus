"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  Check,
  ChevronRight,
  CreditCard,
  Crown,
  Database,
  FileText,
  HardDrive,
  Home,
  LayoutList,
  Loader2,
  Lock,
  MessageCircle,
  Network,
  Plus,
  Receipt,
  Search,
  ShieldCheck,
  Sparkles,
  Video,
  WalletCards,
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

type Plan = {
  name: string;
  description: string;
  price: string;
  cadence: string;
  badge?: string;
  cta: string;
  featured?: boolean;
  plus?: boolean;
  features: string[];
};

type UsageItem = {
  label: string;
  value: string;
  progress: number;
  icon: typeof Activity;
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
  { label: "Messages", href: "/v2/messages", icon: Bell },
  { label: "People", href: "/v2/people", icon: Users },
];

const MOBILE_NAV_ITEMS = [
  { label: "Home", href: "/v2", icon: Home },
  { label: "Discussions", href: "/v2/discussions", icon: MessageCircle },
  { label: "Create", href: "/v2/create", icon: Plus, primary: true },
  { label: "Rooms", href: "/v2/rooms", icon: Users },
  { label: "Messages", href: "/v2/messages", icon: Bell },
];

const PLANS: Plan[] = [
  {
    name: "Free",
    description: "Everything you need to get started with signal-first conversations.",
    price: "$0",
    cadence: "forever",
    cta: "Current Plan",
    features: [
      "Up to 250 signals / month",
      "Standard AI tools",
      "Attach files up to 10MB",
      "Video context up to 5 min",
      "5GB storage",
      "Community support",
      "Access on web and mobile",
    ],
  },
  {
    name: "Premium",
    description: "Advanced tools and higher limits for power users and teams.",
    price: "$12.00",
    cadence: "per user / month",
    badge: "Recommended",
    cta: "Current Plan",
    featured: true,
    features: [
      "Up to 2,000 signals / month",
      "Advanced AI tools",
      "Attach files up to 100MB",
      "Video context up to 60 min",
      "50GB storage",
      "Priority support",
      "Access on web and mobile",
      "Custom rooms & permissions",
    ],
  },
  {
    name: "Premium Plus",
    description: "Maximum limits, advanced AI, and priority everything.",
    price: "$24.00",
    cadence: "per user / month",
    badge: "Best Value",
    cta: "Upgrade to Premium Plus",
    plus: true,
    features: [
      "Unlimited signals",
      "Advanced AI tools + early access",
      "Attach files up to 250MB",
      "Video context up to 180 min",
      "250GB storage",
      "Priority support + dedicated rep",
      "Access on web and mobile",
      "Advanced analytics & exports",
      "SAML SSO & SCIM provisioning",
    ],
  },
];

const USAGE: UsageItem[] = [
  { label: "Signals", value: "1,240 / 2,000", progress: 62, icon: Activity },
  { label: "AI Requests", value: "580 / 2,000", progress: 29, icon: Bot },
  { label: "Storage", value: "18.4 GB / 50 GB", progress: 37, icon: HardDrive },
  { label: "Video Context", value: "32 / 60 min", progress: 53, icon: Video },
];

const AI_TOOLS = [
  { label: "Summary", detail: "Instant overviews", icon: FileText, tone: "bg-blue-50 text-blue-700" },
  { label: "Key Takeaways", detail: "Extract the essentials", icon: LayoutList, tone: "bg-violet-50 text-violet-700" },
  { label: "What Changed", detail: "Track updates", icon: Activity, tone: "bg-emerald-50 text-emerald-700" },
  { label: "Conversation Map", detail: "Visualize threads", icon: Network, tone: "bg-blue-50 text-blue-700" },
  { label: "AI Insights", detail: "Deeper understanding", icon: Sparkles, tone: "bg-pink-50 text-pink-700" },
];

const BENEFITS = [
  { label: "Advanced AI Tools", detail: "Access powerful AI features that surface insights fast.", icon: Bot },
  { label: "Higher Limits", detail: "More signals, storage, and video context every month.", icon: Database },
  { label: "Rich Context", detail: "Attach bigger files and longer videos to tell the full story.", icon: HardDrive },
  { label: "Flexible Billing", detail: "Choose monthly or yearly plans that fit your needs.", icon: ShieldCheck },
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
          <Link href="/premium" className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:text-white">Open current Premium</Link>
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

function PlanCard({ plan }: { plan: Plan }) {
  return (
    <article className={`relative flex min-h-full flex-col rounded-[1.5rem] border bg-white p-6 shadow-sm ${plan.featured ? "border-violet-400 ring-2 ring-violet-100" : plan.plus ? "border-amber-200 bg-amber-50/30" : "border-slate-200"}`}>
      {plan.badge && <span className={`absolute right-5 top-5 rounded-full px-3 py-1 text-xs font-black ${plan.plus ? "bg-amber-100 text-amber-700" : "bg-violet-100 text-violet-700"}`}>{plan.badge}</span>}
      <h2 className="mt-4 text-2xl font-black text-slate-950">{plan.name}</h2>
      <p className="mt-3 min-h-[56px] text-sm leading-6 text-slate-600">{plan.description}</p>
      <div className="mt-6">
        <span className="text-4xl font-black tracking-tight text-slate-950">{plan.price}</span>
        <p className="mt-1 text-sm font-semibold text-slate-500">{plan.cadence}</p>
      </div>
      <Link href="/premium" className={`mt-6 rounded-xl border px-4 py-3 text-center text-sm font-black transition ${plan.featured ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-700" : "border-slate-200 bg-white text-blue-700 hover:border-blue-200 hover:bg-blue-50"}`}>{plan.cta}</Link>
      {plan.featured && <p className="mt-3 text-center text-sm font-bold text-emerald-600">✓ You’re on this plan</p>}
      {plan.plus && <Link href="/premium" className="mt-3 text-center text-sm font-black text-blue-700 hover:text-blue-900">Learn more</Link>}
      <ul className="mt-8 space-y-4 text-sm text-slate-700">
        {plan.features.map((feature) => <li key={feature} className="flex gap-3"><Check className="mt-0.5 size-4 shrink-0 text-emerald-600" /><span>{feature}</span></li>)}
      </ul>
    </article>
  );
}

function UsageRow({ item }: { item: UsageItem }) {
  const Icon = item.icon;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="inline-flex items-center gap-3 font-black text-slate-700"><Icon className="size-4 text-blue-700" />{item.label}</span>
        <span className="font-semibold text-slate-500">{item.value}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-200"><div className="h-2 rounded-full bg-blue-600" style={{ width: `${item.progress}%` }} /></div>
    </div>
  );
}

export default function V2PremiumPage() {
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

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

  if (loading) return <GateCard title="Checking V2 Premium access" message="Loombus is verifying access before loading the V2 Premium shell." loading />;
  if (!payload?.authenticated) return <GateCard title="Sign in required" message="The V2 Premium shell is internal-only right now. Sign in first so Loombus can check your v2_shell access." payload={payload} />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") return <GateCard title="V2 Premium is not enabled" message="This account is not currently allowed through the v2_shell flag. Public users remain on V1." payload={payload} />;

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7fbff] text-slate-950">
      <V2TopNav />
      <section className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8">
        <header className="mb-6">
          <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Premium</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Unlock advanced tools, deeper context, and a richer Loombus experience.</p>
        </header>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-5">
            <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm">
              <button type="button" onClick={() => setBillingCycle("monthly")} className={`rounded-full px-6 py-2 text-sm font-black transition ${billingCycle === "monthly" ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:text-blue-700"}`}>Monthly</button>
              <button type="button" onClick={() => setBillingCycle("yearly")} className={`rounded-full px-6 py-2 text-sm font-black transition ${billingCycle === "yearly" ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:text-blue-700"}`}>Yearly</button>
              <span className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700">Save 20%</span>
            </div>

            <section className="grid gap-4 lg:grid-cols-3">
              {PLANS.map((plan) => <PlanCard key={plan.name} plan={plan} />)}
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-black text-slate-950">Premium includes access to all AI Tools</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {AI_TOOLS.map((tool) => {
                  const Icon = tool.icon;
                  return <div key={tool.label} className="rounded-2xl p-3"><span className={`grid size-12 place-items-center rounded-xl ${tool.tone}`}><Icon className="size-5" /></span><h3 className="mt-3 text-sm font-black text-slate-900">{tool.label}</h3><p className="text-xs font-semibold text-slate-500">{tool.detail}</p></div>;
                })}
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-black text-slate-950">Current Plan</h2>
              <div className="mt-5 flex gap-4">
                <span className="grid size-14 place-items-center rounded-2xl bg-violet-600 text-white"><Crown className="size-7" /></span>
                <div>
                  <h3 className="text-xl font-black text-slate-950">Premium</h3>
                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-700">Active</span>
                  <p className="mt-2 text-sm font-semibold text-slate-600">$12.00 / month</p>
                  <p className="text-sm text-slate-500">Renews Jun 20, 2025</p>
                </div>
              </div>
              <Link href="/premium" className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-black text-blue-700 transition hover:bg-blue-50">Manage Plan <ChevronRight className="size-4" /></Link>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black text-slate-950">Usage This Month</h2>
              <div className="mt-5 space-y-5">{USAGE.map((item) => <UsageRow key={item.label} item={item} />)}</div>
              <Link href="/v2/premium" className="mt-5 flex items-center justify-between text-sm font-black text-blue-700">View usage details <ChevronRight className="size-4" /></Link>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black text-slate-950">Manage Billing</h2>
              <div className="mt-4 space-y-4 text-sm">
                <div className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-3 font-black text-slate-700"><CreditCard className="size-4 text-blue-700" />Payment Method</span><span className="text-slate-500">Visa •••• 4242</span></div>
                <div className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-3 font-black text-slate-700"><Receipt className="size-4 text-blue-700" />Billing History</span><Link href="/premium" className="text-blue-700">View past invoices</Link></div>
                <div className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-3 font-black text-slate-700"><WalletCards className="size-4 text-blue-700" />Billing Portal</span><Link href="/premium" className="text-blue-700">Update billing info</Link></div>
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black text-slate-950">Compare Features</h2>
              <Link href="/premium" className="mt-2 flex items-center justify-between text-sm font-semibold text-slate-600">See plan-by-plan comparison <ChevronRight className="size-4 text-blue-700" /></Link>
            </section>
          </aside>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-4">
          {BENEFITS.map((benefit) => {
            const Icon = benefit.icon;
            return <article key={benefit.label} className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm"><span className="grid size-12 place-items-center rounded-xl bg-blue-50 text-blue-700"><Icon className="size-5" /></span><h3 className="mt-3 text-sm font-black text-blue-700">{benefit.label}</h3><p className="mt-1 text-sm leading-6 text-slate-600">{benefit.detail}</p></article>;
          })}
        </section>
      </section>
      <MobileBottomNav />
    </main>
  );
}
