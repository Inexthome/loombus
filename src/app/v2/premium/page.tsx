"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bot,
  Bookmark,
  Check,
  ChevronRight,
  CreditCard,
  Crown,
  Database,
  FileText,
  HardDrive,
  LayoutList,
  Loader2,
  Network,
  Receipt,
  ShieldCheck,
  Sparkles,
  Video,
  WalletCards,
} from "lucide-react";
import { purchaseApplePlan } from "@/lib/apple-purchases";
import { isIosNativeApp } from "@/lib/native-app";
import { supabase } from "@/lib/supabase/client";
import {
  getDefaultShellPayload,
  V2ShellGateCard,
  V2ShellMobileNav,
  V2ShellTopNav,
  type ShellPayload,
} from "../v2-shell-components";

type PlanKey = "free" | "premium" | "premium_plus";
type CheckoutPlanKey = "premium_monthly" | "premium_annual" | "premium_plus_monthly" | "premium_plus_annual" | "extra_ai_pack";
type BillingCycle = "monthly" | "annual";
type FeatureStatus = "available" | "planned";

type Entitlement = {
  tier: string | null;
  ai_assisted_enabled: boolean | null;
  monthly_summary_limit: number | null;
  stripe_customer_id?: string | null;
};

type PlanFeature = {
  label: string;
  status: FeatureStatus;
};

type PlanDefinition = {
  key: PlanKey;
  name: string;
  eyebrow: string;
  description: string;
  monthlyPrice: string;
  annualPrice: string;
  annualNote?: string;
  standardNote?: string;
  badge?: string;
  features: PlanFeature[];
  highlighted?: boolean;
};

type CheckoutStatus = {
  kind: "success" | "cancelled";
  planLabel: string;
} | null;

type CdvPurchaseWindow = Window & {
  CdvPurchase?: {
    store?: {
      manageSubscriptions?: () => Promise<void> | void;
    };
  };
};

const PLAN_LABELS: Record<string, string> = {
  premium_monthly: "Premium Monthly",
  premium_annual: "Premium Annual",
  premium_plus_monthly: "Premium Plus Monthly",
  premium_plus_annual: "Premium Plus Annual",
  extra_ai_pack: "Extra AI Pack",
};

const FREE_FEATURES: PlanFeature[] = [
  { label: "Read public discussions", status: "available" },
  { label: "Create discussions", status: "available" },
  { label: "Reply to discussions", status: "available" },
  { label: "Follow people", status: "available" },
  { label: "Basic public profile", status: "available" },
  { label: "Save/bookmark discussions", status: "available" },
  { label: "Basic notifications", status: "available" },
  { label: "Discussion attachments: images and PDFs", status: "available" },
  { label: "Video Context: 5 videos/month, up to 60 seconds each", status: "available" },
];

const PREMIUM_FEATURES: PlanFeature[] = [
  { label: "Everything in Free", status: "available" },
  { label: "AI discussion summaries", status: "available" },
  { label: "AI key takeaways", status: "available" },
  { label: "Thread Evolution / What Changed", status: "available" },
  { label: "Viewpoint Map / Disagreement Mapping", status: "available" },
  { label: "Conversation Map and Related Ideas", status: "available" },
  { label: "Higher monthly AI usage limit", status: "available" },
  { label: "Advanced discussion filters", status: "available" },
  { label: "Saved folders / collections", status: "available" },
  { label: "Personal reading history", status: "available" },
  { label: "Custom profile badge: Premium Member", status: "available" },
  { label: "Better notification controls", status: "available" },
  { label: "Premium email digest", status: "available" },
  { label: "Premium topic alerts", status: "available" },
  { label: "Draft mode for discussions", status: "available" },
  { label: "Extended edit window: 7 days after publishing", status: "available" },
  { label: "Video Context: 25 videos/month, up to 120 seconds each", status: "available" },
];

const PREMIUM_PLUS_FEATURES: PlanFeature[] = [
  { label: "Everything in Premium", status: "available" },
  { label: "Highest included AI usage for summaries, takeaways, viewpoint maps, thread evolution, Conversation Map, and Related Ideas", status: "available" },
  { label: "AI discussion quality check before posting", status: "available" },
  { label: "AI rewrite for clarity before posting", status: "available" },
  { label: "Private notes on saved discussions", status: "available" },
  { label: "Export saved discussions and notes", status: "available" },
  { label: "Longer discussion posts", status: "available" },
  { label: "Video Context: 50 videos/month, up to 3 minutes each", status: "available" },
  { label: "Priority feature access / Loombus Labs", status: "available" },
  { label: "Premium Plus Labs voting", status: "available" },
  { label: "Optional creator/supporter profile tools", status: "available" },
];

const PLANS: PlanDefinition[] = [
  {
    key: "free",
    name: "Free",
    eyebrow: "Core access",
    description: "Core Loombus access for reading, posting, replying, following, saving, basic attachments, and limited Video Context.",
    monthlyPrice: "$0",
    annualPrice: "$0",
    features: FREE_FEATURES,
  },
  {
    key: "premium",
    name: "Premium",
    eyebrow: "Early Access pricing",
    description: "Built for members who want AI discussion tools, better organization, draft support, topic alerts, and longer Video Context.",
    monthlyPrice: "$7",
    annualPrice: "$70",
    annualNote: "Early Access annual: $70/year",
    standardNote: "Standard: $9/month or $90/year. You save $2/month or $20/year during Early Access.",
    badge: "Recommended",
    highlighted: true,
    features: PREMIUM_FEATURES,
  },
  {
    key: "premium_plus",
    name: "Premium Plus",
    eyebrow: "Early Access pricing",
    description: "Built for heavier AI usage, Labs access, creator tools, exports, longer posts, pre-posting AI support, and the longest Video Context limits.",
    monthlyPrice: "$12",
    annualPrice: "$120",
    annualNote: "Early Access annual: $120/year",
    standardNote: "Standard: $15/month or $150/year. You save $3/month or $30/year during Early Access.",
    badge: "Best Value",
    features: PREMIUM_PLUS_FEATURES,
  },
];

const AI_TOOLS = [
  { label: "Summary", detail: "AI discussion summaries", icon: FileText },
  { label: "Key Takeaways", detail: "Extract the strongest points", icon: LayoutList },
  { label: "What Changed", detail: "Track thread evolution", icon: Activity },
  { label: "Conversation Map", detail: "Map relationships and ideas", icon: Network },
  { label: "Related Ideas", detail: "Find adjacent signal", icon: Sparkles },
];

const BENEFITS = [
  { label: "Advanced AI Tools", detail: "Summaries, takeaways, disagreement maps, conversation maps, and related ideas.", icon: Bot },
  { label: "Higher Limits", detail: "More AI usage and longer Video Context limits as your plan increases.", icon: Database },
  { label: "Rich Context", detail: "Attach images, PDFs, and videos to support written discussions without creating an endless video feed.", icon: HardDrive },
  { label: "Flexible Billing", detail: "Use monthly, annual, Stripe web checkout, Apple purchases on iOS, and the billing portal where available.", icon: ShieldCheck },
];

function getPlanRank(plan: PlanKey) {
  if (plan === "premium_plus") return 2;
  if (plan === "premium") return 1;
  return 0;
}

function getCurrentPlan(entitlement: Entitlement | null): PlanKey | "admin" {
  if (!entitlement?.ai_assisted_enabled) return "free";
  if (entitlement.tier === "admin") return "admin";
  if (entitlement.tier === "premium_plus") return "premium_plus";
  if (entitlement.tier === "premium" && (entitlement.monthly_summary_limit ?? 0) > 50) return "premium_plus";
  if (entitlement.tier === "premium") return "premium";
  return "free";
}

function getPlanLabel(plan: PlanKey | "admin") {
  if (plan === "premium_plus") return "Premium Plus";
  if (plan === "premium") return "Premium";
  if (plan === "admin") return "Admin";
  return "Free";
}

function getPlanDescription(plan: PlanKey | "admin") {
  if (plan === "premium_plus") return "Highest AI usage, pre-posting AI support, private notes, exports, Labs access, creator tools, and 3-minute Video Context.";
  if (plan === "premium") return "AI discussion tools, saved folders, drafts, topic alerts, extended editing, and longer Video Context.";
  if (plan === "admin") return "Administrative access with Premium AI tools and operational controls.";
  return "Core Loombus access with basic publishing, replies, saving, and limited Video Context.";
}

function getAiUsageLabel(entitlement: Entitlement | null) {
  const currentPlan = getCurrentPlan(entitlement);
  if (currentPlan === "admin") return "Unlimited/admin";
  const limit = entitlement?.monthly_summary_limit ?? 0;
  return limit > 0 ? `${limit} AI actions/month` : "No Premium AI usage included";
}

function getCheckoutPlanKey(plan: PlanKey, billingCycle: BillingCycle): CheckoutPlanKey | null {
  if (plan === "premium") return billingCycle === "annual" ? "premium_annual" : "premium_monthly";
  if (plan === "premium_plus") return billingCycle === "annual" ? "premium_plus_annual" : "premium_plus_monthly";
  return null;
}

function getCheckoutLabel(plan: PlanDefinition, currentPlan: PlanKey | "admin", billingCycle: BillingCycle) {
  if (plan.key === "free") return currentPlan === "free" ? "Current plan" : `Included with ${getPlanLabel(currentPlan)}`;
  const interval = billingCycle === "annual" ? "annual" : "monthly";
  if (currentPlan === plan.key) return "Current plan";
  if (currentPlan === "admin" || getPlanRank(plan.key) < getPlanRank(currentPlan as PlanKey)) return `Included with ${getPlanLabel(currentPlan)}`;
  return currentPlan === "free" ? `Start ${plan.name} ${interval}` : `Upgrade to ${plan.name} ${interval}`;
}

function getCheckoutStatusFromWindow(): CheckoutStatus {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const status = params.get("checkout");
  const plan = PLAN_LABELS[params.get("plan") ?? ""] ?? "your Loombus plan";
  if (status === "success") return { kind: "success", planLabel: plan };
  if (status === "cancelled" || status === "canceled") return { kind: "cancelled", planLabel: plan };
  return null;
}

async function openAppleSubscriptionManagement() {
  const store = (window as CdvPurchaseWindow).CdvPurchase?.store;
  if (store?.manageSubscriptions) {
    await store.manageSubscriptions();
    return true;
  }
  return false;
}

function FeatureList({ features }: { features: PlanFeature[] }) {
  return (
    <ul className="mt-7 space-y-3 text-sm leading-6 text-slate-600">
      {features.map((feature) => (
        <li key={feature.label} className="flex gap-3">
          <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
          <span className="flex flex-wrap items-center gap-2">
            <span>{feature.label}</span>
            {feature.status === "planned" ? <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-black text-slate-500 ring-1 ring-slate-200">Planned</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

function StatusBanner({ status }: { status: CheckoutStatus }) {
  if (!status) return null;
  const success = status.kind === "success";
  return (
    <section className={`mb-6 rounded-[1.5rem] border p-5 shadow-sm ${success ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
      <p className="text-xs font-black uppercase tracking-[0.22em]">{success ? "Payment completed" : "Checkout cancelled"}</p>
      <h2 className="mt-2 text-xl font-black text-slate-950">{success ? `${status.planLabel} checkout was completed.` : "No payment was completed."}</h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
        {success ? "If your plan badge or AI usage limit does not update immediately, refresh in a moment while the payment confirmation finishes." : "You can restart checkout whenever you are ready. Your current Loombus access remains unchanged."}
      </p>
    </section>
  );
}

function CheckoutActionButton({ children, planKey, variant = "primary", onAfterPurchase }: { children: ReactNode; planKey: CheckoutPlanKey; variant?: "primary" | "secondary"; onAfterPurchase: () => void }) {
  const [startingCheckout, setStartingCheckout] = useState(false);
  const [message, setMessage] = useState("");

  async function startCheckout() {
    if (startingCheckout) return;
    setMessage("");
    setStartingCheckout(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        window.location.href = `/login?next=${encodeURIComponent("/v2/premium")}`;
        return;
      }

      if (isIosNativeApp()) {
        await purchaseApplePlan(planKey);
        setMessage("Apple purchase completed. Your Loombus access is being updated.");
        onAfterPurchase();
        return;
      }

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 20000);
      const response = await fetch("/api/billing/create-checkout-session", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ planKey, returnPath: "/v2/premium" }),
        signal: controller.signal,
      });
      window.clearTimeout(timeoutId);

      const result = await response.json().catch(() => ({ error: "Checkout returned an unreadable response." }));
      if (!response.ok) {
        setMessage(result.detail ? `${result.error ?? "Unable to start Premium checkout."} ${result.detail}` : result.error ?? "Unable to start Premium checkout.");
        return;
      }
      if (!result.url) {
        setMessage("Checkout URL was not returned.");
        return;
      }
      window.location.href = result.url;
    } catch (error) {
      const errorMessage = error instanceof DOMException && error.name === "AbortError" ? "Checkout request timed out. Please try again." : error instanceof Error ? error.message : "Unable to start Premium checkout.";
      setMessage(errorMessage);
    } finally {
      setStartingCheckout(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={startCheckout}
        disabled={startingCheckout}
        className={`inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${variant === "primary" ? "bg-amber-300 text-slate-950 hover:bg-amber-400" : "border border-slate-200 bg-white text-amber-800 hover:border-amber-200 hover:bg-amber-50"}`}
      >
        {startingCheckout ? "Starting checkout..." : children}
      </button>
      {message ? <p className="text-xs font-semibold leading-5 text-slate-500">{message}</p> : null}
    </div>
  );
}

function BillingPortalAction({ children = "Manage billing", onAfterPortal }: { children?: ReactNode; onAfterPortal?: () => void }) {
  const [openingPortal, setOpeningPortal] = useState(false);
  const [message, setMessage] = useState("");

  async function openBillingPortal() {
    if (openingPortal) return;
    setOpeningPortal(true);
    setMessage("");

    if (isIosNativeApp()) {
      try {
        const opened = await openAppleSubscriptionManagement();
        setMessage(opened ? "Apple subscription management opened." : "To manage Apple subscriptions, open iPhone Settings, tap your Apple ID, then Subscriptions.");
      } catch {
        setMessage("To manage Apple subscriptions, open iPhone Settings, tap your Apple ID, then Subscriptions.");
      } finally {
        setOpeningPortal(false);
      }
      return;
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        window.location.href = `/login?next=${encodeURIComponent("/v2/premium")}`;
        return;
      }

      const response = await fetch("/api/billing/create-portal-session", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ returnPath: "/v2/premium" }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.url) {
        setMessage(result.error ?? "Unable to open billing portal.");
        return;
      }
      onAfterPortal?.();
      window.location.href = result.url;
    } catch {
      setMessage("Unable to open billing portal.");
    } finally {
      setOpeningPortal(false);
    }
  }

  return (
    <div className="space-y-2">
      <button type="button" onClick={openBillingPortal} disabled={openingPortal} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-amber-800 transition hover:border-amber-200 hover:bg-amber-50 disabled:opacity-60">
        {openingPortal ? "Opening billing..." : children}
        {!openingPortal ? <ChevronRight className="size-4" /> : null}
      </button>
      {message ? <p className="text-xs font-semibold leading-5 text-slate-500">{message}</p> : null}
    </div>
  );
}

function PlanAction({ plan, billingCycle, currentPlan, onRefresh }: { plan: PlanDefinition; billingCycle: BillingCycle; currentPlan: PlanKey | "admin"; onRefresh: () => void }) {
  const checkoutPlanKey = getCheckoutPlanKey(plan.key, billingCycle);
  const label = getCheckoutLabel(plan, currentPlan, billingCycle);
  const currentRank = currentPlan === "admin" ? 3 : getPlanRank(currentPlan);
  const targetRank = getPlanRank(plan.key);

  if (plan.key === currentPlan) {
    return (
      <div className="space-y-2">
        <div className="rounded-xl bg-slate-950 px-4 py-3 text-center text-sm font-black text-white">Current plan</div>
        <BillingPortalAction onAfterPortal={onRefresh}>Manage billing</BillingPortalAction>
      </div>
    );
  }

  if (plan.key === "free" || targetRank < currentRank) {
    return <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-black text-slate-600">{label}</div>;
  }

  if (!checkoutPlanKey) return null;

  return (
    <CheckoutActionButton planKey={checkoutPlanKey} variant={plan.highlighted ? "primary" : "secondary"} onAfterPurchase={onRefresh}>
      {label}
    </CheckoutActionButton>
  );
}

function PlanCard({ plan, billingCycle, currentPlan, onRefresh }: { plan: PlanDefinition; billingCycle: BillingCycle; currentPlan: PlanKey | "admin"; onRefresh: () => void }) {
  const price = billingCycle === "annual" ? plan.annualPrice : plan.monthlyPrice;
  const cadence = plan.key === "free" ? "forever" : billingCycle === "annual" ? "/ year" : "/ month";

  return (
    <article className={`relative flex min-h-full flex-col rounded-[1.5rem] border bg-white p-6 shadow-sm ${plan.highlighted ? "border-amber-300 ring-2 ring-amber-100" : "border-slate-200"}`}>
      {plan.badge ? <span className="absolute right-5 top-5 rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-800 ring-1 ring-amber-200">{plan.badge}</span> : null}
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{plan.eyebrow}</p>
      <h2 className="mt-4 text-2xl font-black text-slate-950">{plan.name}</h2>
      <p className="mt-3 min-h-[72px] text-sm leading-6 text-slate-600">{plan.description}</p>
      <div className="mt-6">
        <span className="text-4xl font-black tracking-tight text-slate-950">{price}</span>
        <span className="ml-2 text-sm font-semibold text-slate-500">{cadence}</span>
      </div>
      {billingCycle === "annual" && plan.annualNote ? <p className="mt-2 text-sm font-bold text-emerald-700">{plan.annualNote}</p> : null}
      {plan.standardNote ? <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">{plan.standardNote}</p> : null}
      <div className="mt-6"><PlanAction plan={plan} billingCycle={billingCycle} currentPlan={currentPlan} onRefresh={onRefresh} /></div>
      <FeatureList features={plan.features} />
    </article>
  );
}

function InfoCard({ children, icon: Icon, title }: { children: ReactNode; icon: LucideIcon; title: string }) {
  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-2xl bg-amber-50 text-amber-800 ring-1 ring-amber-200"><Icon className="size-5" /></span>
        <h2 className="font-black text-slate-950">{title}</h2>
      </div>
      <div className="mt-4 text-sm leading-6 text-slate-600">{children}</div>
    </section>
  );
}

export default function V2PremiumPage() {
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [checkoutStatus, setCheckoutStatus] = useState<CheckoutStatus>(null);
  const [message, setMessage] = useState("");

  async function loadPage() {
    setLoading(true);
    setMessage("");
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const userId = data.session?.user.id ?? null;

      const response = await fetch("/api/v2/shell", { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined });
      const nextPayload = (await response.json().catch(() => getDefaultShellPayload())) as ShellPayload;
      setPayload(nextPayload);

      if (userId) {
        const { data: entitlementData, error } = await supabase
          .from("user_ai_entitlements")
          .select("tier, ai_assisted_enabled, monthly_summary_limit, stripe_customer_id")
          .eq("user_id", userId)
          .maybeSingle();
        if (error) setMessage(error.message);
        setEntitlement((entitlementData ?? null) as Entitlement | null);
      } else {
        setEntitlement(null);
      }
    } catch {
      setPayload(getDefaultShellPayload());
      setEntitlement(null);
      setMessage("Unable to load Premium billing state safely.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setCheckoutStatus(getCheckoutStatusFromWindow());
    void loadPage();
    const { data } = supabase.auth.onAuthStateChange(() => void loadPage());
    return () => data.subscription.unsubscribe();
  }, []);

  const currentPlan = useMemo(() => getCurrentPlan(entitlement), [entitlement]);
  const currentPlanLabel = getPlanLabel(currentPlan);
  const currentPlanDescription = getPlanDescription(currentPlan);

  if (loading) return <V2ShellGateCard title="Checking V2 Premium access" message="Loombus is verifying access before loading the V2 Premium page." loading />;
  if (!payload?.authenticated) return <V2ShellGateCard title="Sign in required" message="Sign in first so Loombus can check your V2 access and load live Premium billing options." payload={payload} />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") return <V2ShellGateCard title="V2 Premium is not enabled" message="This account is not currently allowed through the v2_shell flag. Public users remain on the current experience." payload={payload} />;

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7fbff] loombus-v2-page-bg text-slate-950">
      <V2ShellTopNav />
      <section className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8">
        <StatusBanner status={checkoutStatus} />
        {message ? <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">{message}</div> : null}

        <header className="mb-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-800">Loombus Premium</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Choose your Loombus plan.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">Core discussion access stays available for every member. Paid tiers add deeper AI assistance, better organization, longer Video Context, and stronger creation tools.</p>
          </div>
          <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Current Plan</p>
            <div className="mt-3 flex items-center gap-3">
              <span className="grid size-12 place-items-center rounded-2xl bg-amber-50 text-amber-800 ring-1 ring-amber-200"><Crown className="size-6" /></span>
              <div>
                <h2 className="text-lg font-black text-slate-950">{currentPlanLabel}</h2>
                <p className="text-xs font-semibold text-slate-500">{getAiUsageLabel(entitlement)}</p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">{currentPlanDescription}</p>
            <div className="mt-4"><BillingPortalAction onAfterPortal={() => void loadPage()}>Manage billing</BillingPortalAction></div>
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-6">
            <div className="flex flex-wrap items-center gap-3 rounded-[1.25rem] border border-slate-200 bg-white p-3 shadow-sm">
              <button type="button" onClick={() => setBillingCycle("monthly")} className={`rounded-full px-5 py-2 text-sm font-black transition ${billingCycle === "monthly" ? "bg-amber-300 text-slate-950" : "text-slate-500 hover:bg-amber-50 hover:text-amber-800"}`}>Monthly</button>
              <button type="button" onClick={() => setBillingCycle("annual")} className={`rounded-full px-5 py-2 text-sm font-black transition ${billingCycle === "annual" ? "bg-amber-300 text-slate-950" : "text-slate-500 hover:bg-amber-50 hover:text-amber-800"}`}>Annual</button>
              <span className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700 ring-1 ring-emerald-200">Early Access annual savings</span>
            </div>

            <section className="grid gap-4 lg:grid-cols-3">
              {PLANS.map((plan) => <PlanCard key={plan.key} plan={plan} billingCycle={billingCycle} currentPlan={currentPlan} onRefresh={() => void loadPage()} />)}
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-black text-slate-950">Premium includes access to Loombus AI Tools</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">These tools support written discussions instead of replacing them with a feed.</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {AI_TOOLS.map((tool) => {
                  const Icon = tool.icon;
                  return <div key={tool.label} className="rounded-2xl border border-slate-100 bg-slate-50 p-3"><span className="grid size-12 place-items-center rounded-xl bg-amber-50 text-amber-800 ring-1 ring-amber-200"><Icon className="size-5" /></span><h3 className="mt-3 text-sm font-black text-slate-900">{tool.label}</h3><p className="text-xs font-semibold text-slate-500">{tool.detail}</p></div>;
                })}
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="grid gap-6 md:grid-cols-[0.8fr_1.2fr] md:items-center">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Add-on</p>
                  <h2 className="mt-2 text-2xl font-black text-slate-950">Extra AI Pack</h2>
                </div>
                <div>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-black text-slate-950">$5</span>
                    <span className="pb-1 text-sm font-semibold text-slate-500">for 25 additional AI actions</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">Optional one-time add-on for members who reach their included monthly AI limit without changing subscription tiers.</p>
                  <div className="mt-5 max-w-sm"><CheckoutActionButton planKey="extra_ai_pack" variant="secondary" onAfterPurchase={() => void loadPage()}>Buy Extra AI Pack</CheckoutActionButton></div>
                </div>
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <InfoCard title="Live Plan State" icon={Activity}>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3"><span className="font-bold text-slate-700">Tier</span><span className="font-black text-slate-950">{currentPlanLabel}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="font-bold text-slate-700">AI access</span><span className="font-black text-slate-950">{entitlement?.ai_assisted_enabled ? "Enabled" : "Not enabled"}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="font-bold text-slate-700">Included AI usage</span><span className="font-black text-slate-950">{getAiUsageLabel(entitlement)}</span></div>
              </div>
            </InfoCard>

            <InfoCard title="Billing" icon={CreditCard}>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2 font-bold text-slate-700"><Receipt className="size-4 text-amber-700" />Invoices</span><span className="text-slate-500">Portal</span></div>
                <div className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2 font-bold text-slate-700"><WalletCards className="size-4 text-amber-700" />Payment method</span><span className="text-slate-500">Portal</span></div>
                <BillingPortalAction onAfterPortal={() => void loadPage()}>Open billing portal</BillingPortalAction>
              </div>
            </InfoCard>

            <InfoCard title="Subscription Details" icon={ShieldCheck}>
              <div className="space-y-3">
                <p>Premium Monthly and Premium Annual are auto-renewable subscriptions.</p>
                <p>Premium Plus Monthly and Premium Plus Annual are auto-renewable subscriptions.</p>
                <p>Pricing is shown before purchase and your plan is activated after payment succeeds.</p>
                <p>Review the <Link href="/privacy" className="font-black text-amber-800">Privacy Policy</Link>, <Link href="/terms" className="font-black text-amber-800">Terms</Link>, and <a href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/" target="_blank" rel="noopener noreferrer" className="font-black text-amber-800">Apple Standard EULA</a>.</p>
              </div>
            </InfoCard>

            <InfoCard title="Video Context" icon={Video}>
              <p>Video Context is designed to support written discussions, not replace them with a video feed. Videos remain attached to discussions and are limited by plan.</p>
            </InfoCard>
          </aside>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-4">
          {BENEFITS.map((benefit) => {
            const Icon = benefit.icon;
            return <article key={benefit.label} className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm"><span className="grid size-12 place-items-center rounded-xl bg-amber-50 text-amber-800 ring-1 ring-amber-200"><Icon className="size-5" /></span><h3 className="mt-3 text-sm font-black text-slate-950">{benefit.label}</h3><p className="mt-1 text-sm leading-6 text-slate-600">{benefit.detail}</p></article>;
          })}
        </section>
      </section>
      <V2ShellMobileNav />
    </main>
  );
}
