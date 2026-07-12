"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  CreditCard,
  FileText,
  Gauge,
  HelpCircle,
  LifeBuoy,
  Mail,
  Minus,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Tags,
  Video,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BillingPortalButton } from "@/components/billing-portal-button";
import { isIosNativeApp } from "@/lib/native-app";
import { supabase } from "@/lib/supabase/client";
import { PremiumPlanCheckoutButton } from "./premium-checkout-button";

type PlanKey = "free" | "premium" | "premium_plus" | "admin";
type PurchasablePlan = "premium" | "premium_plus";

type Entitlement = {
  tier: string | null;
  ai_assisted_enabled: boolean | null;
  monthly_summary_limit: number | null;
  stripe_customer_id: string | null;
};

type ProfileAccount = {
  is_admin: boolean | null;
};

type PlanDefinition = {
  key: "free" | PurchasablePlan;
  label: string;
  monthly: string;
  annual: string;
  standardPrice: string;
  description: string;
  features: string[];
};

type ComparisonRow = {
  feature: string;
  free: string | boolean;
  premium: string | boolean;
  premiumPlus: string | boolean;
};

const plans: PlanDefinition[] = [
  {
    key: "free",
    label: "Free",
    monthly: "$0",
    annual: "No annual charge",
    standardPrice: "Core access",
    description:
      "Core Loombus access for focused discussions, replies, follows, saving, attachments, and limited Video Context.",
    features: [
      "Read, create, and reply to discussions",
      "Follow members and save discussions",
      "Basic Signal Inbox controls",
      "Images and PDF discussion attachments",
      "5 Video Context uploads per month, up to 60 seconds",
    ],
  },
  {
    key: "premium",
    label: "Premium",
    monthly: "$7 / month",
    annual: "$70 / year",
    standardPrice: "Early Access · standard $9/month or $90/year",
    description:
      "For members who want the AI understanding layer, stronger organization, topic alerts, drafts, and longer Video Context.",
    features: [
      "AI summaries, takeaways, thread evolution, and viewpoint maps",
      "Conversation Map and Related Ideas",
      "Higher included monthly AI usage",
      "Saved folders, reading history, and draft mode",
      "Premium email digest and topic alerts",
      "7-day discussion edit window",
      "25 Video Context uploads per month, up to 120 seconds",
    ],
  },
  {
    key: "premium_plus",
    label: "Premium Plus",
    monthly: "$12 / month",
    annual: "$120 / year",
    standardPrice: "Early Access · standard $15/month or $150/year",
    description:
      "For heavier AI use, pre-publishing assistance, private notes, exports, Labs access, and the longest Video Context limits.",
    features: [
      "Everything included with Premium",
      "Highest included monthly AI usage",
      "AI discussion quality check and clarity rewrite",
      "Private notes and saved-discussion exports",
      "Longer discussion posts",
      "Priority Loombus Labs access and voting",
      "Creator and supporter profile tools",
      "50 Video Context uploads per month, up to 3 minutes",
    ],
  },
];

const comparisonRows: ComparisonRow[] = [
  { feature: "Core discussions, replies, follows, and saves", free: true, premium: true, premiumPlus: true },
  { feature: "AI discussion understanding tools", free: false, premium: true, premiumPlus: true },
  { feature: "Included AI usage", free: "Core only", premium: "Higher", premiumPlus: "Highest" },
  { feature: "Premium topic alerts", free: false, premium: true, premiumPlus: true },
  { feature: "Premium email digest", free: false, premium: true, premiumPlus: true },
  { feature: "Draft mode and 7-day edit window", free: false, premium: true, premiumPlus: true },
  { feature: "Quality check and clarity rewrite", free: false, premium: false, premiumPlus: true },
  { feature: "Private notes and exports", free: false, premium: false, premiumPlus: true },
  { feature: "Loombus Labs priority access", free: false, premium: false, premiumPlus: true },
  { feature: "Video Context", free: "5 × 60 sec", premium: "25 × 120 sec", premiumPlus: "50 × 3 min" },
];

const planRank: Record<PlanKey, number> = {
  free: 0,
  premium: 1,
  premium_plus: 2,
  admin: 3,
};

function getCurrentPlan(entitlement: Entitlement | null, isAdmin: boolean): PlanKey {
  if (isAdmin || entitlement?.tier === "admin") return "admin";
  if (!entitlement?.ai_assisted_enabled) return "free";
  if (entitlement.tier === "premium_plus") return "premium_plus";
  if (
    entitlement.tier === "premium" &&
    (entitlement.monthly_summary_limit ?? 0) > 50
  ) {
    return "premium_plus";
  }
  if (entitlement.tier === "premium") return "premium";
  return "free";
}

function getPlanLabel(plan: PlanKey) {
  if (plan === "premium_plus") return "Premium Plus";
  if (plan === "premium") return "Premium";
  if (plan === "admin") return "Admin";
  return "Free";
}

function getAiUsageLabel(plan: PlanKey, entitlement: Entitlement | null) {
  if (plan === "admin") return "Unlimited / Admin";
  const limit = entitlement?.monthly_summary_limit ?? 0;
  if (limit <= 0) return "No Premium AI allowance";
  return `${limit} AI actions per month`;
}

function CheckoutStatus() {
  const searchParams = useSearchParams();
  const checkout = searchParams.get("checkout");
  const plan = searchParams.get("plan");
  const planLabel =
    plan === "premium_monthly"
      ? "Premium Monthly"
      : plan === "premium_annual"
        ? "Premium Annual"
        : plan === "premium_plus_monthly"
          ? "Premium Plus Monthly"
          : plan === "premium_plus_annual"
            ? "Premium Plus Annual"
            : plan === "extra_ai_pack"
              ? "Extra AI Pack"
              : "Loombus plan";

  if (checkout === "success") {
    return (
      <section className="premium-v2-notice is-success" role="status">
        <CheckCircle2 aria-hidden="true" />
        <div>
          <strong>{planLabel} checkout completed.</strong>
          <span>
            Stripe is finishing the entitlement update. Refresh shortly if the current-plan card has not changed yet.
          </span>
        </div>
      </section>
    );
  }

  if (checkout === "cancelled" || checkout === "canceled") {
    return (
      <section className="premium-v2-notice" role="status">
        <X aria-hidden="true" />
        <div>
          <strong>Checkout canceled.</strong>
          <span>No payment was completed, and the current Loombus access remains unchanged.</span>
        </div>
      </section>
    );
  }

  return null;
}

function ComparisonValue({ value }: { value: string | boolean }) {
  if (value === true) {
    return <Check className="premium-v2-check" aria-label="Included" />;
  }
  if (value === false) {
    return <Minus className="premium-v2-minus" aria-label="Not included" />;
  }
  return <span>{value}</span>;
}

function PlanActions({
  plan,
  currentPlan,
  signedIn,
  canManageBilling,
}: {
  plan: PlanDefinition["key"];
  currentPlan: PlanKey;
  signedIn: boolean;
  canManageBilling: boolean;
}) {
  if (!signedIn && plan === "free") {
    return (
      <div className="premium-v2-actions">
        <Link href="/signup" className="premium-v2-primary-action">Choose Free</Link>
        <Link href="/login?next=/premium" className="premium-v2-secondary-action">Log in</Link>
      </div>
    );
  }

  if (signedIn && currentPlan === plan) {
    return (
      <div className="premium-v2-actions">
        <span className="premium-v2-current-badge">Current plan</span>
        {canManageBilling && plan !== "free" ? (
          <div className="premium-v2-embedded-action">
            <BillingPortalButton variant="secondary">Manage billing</BillingPortalButton>
          </div>
        ) : null}
      </div>
    );
  }

  if (signedIn && planRank[currentPlan] > planRank[plan]) {
    return (
      <div className="premium-v2-actions">
        <span className="premium-v2-current-badge">Included with {getPlanLabel(currentPlan)}</span>
      </div>
    );
  }

  if (plan === "free") {
    return (
      <div className="premium-v2-actions">
        <span className="premium-v2-current-badge">Core access included</span>
      </div>
    );
  }

  return (
    <div className="premium-v2-actions premium-v2-checkout-actions">
      <PremiumPlanCheckoutButton
        planKey={plan === "premium" ? "premium_monthly" : "premium_plus_monthly"}
      >
        {signedIn && currentPlan !== "free" ? "Upgrade monthly" : "Start monthly"}
      </PremiumPlanCheckoutButton>
      <PremiumPlanCheckoutButton
        planKey={plan === "premium" ? "premium_annual" : "premium_plus_annual"}
        variant="secondary"
      >
        {signedIn && currentPlan !== "free" ? "Upgrade annually" : "Start annually"}
      </PremiumPlanCheckoutButton>
    </div>
  );
}

export default function PremiumV2Client() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadPlanState() {
      setLoading(true);
      setLoadError("");

      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        const user = userData.user;

        if (!user) {
          if (mounted) {
            setSignedIn(false);
            setEntitlement(null);
            setIsAdmin(false);
          }
          return;
        }

        const [entitlementResult, profileResult] = await Promise.all([
          supabase
            .from("user_ai_entitlements")
            .select("tier, ai_assisted_enabled, monthly_summary_limit, stripe_customer_id")
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("profiles")
            .select("is_admin")
            .eq("id", user.id)
            .maybeSingle(),
        ]);

        if (entitlementResult.error) throw entitlementResult.error;
        if (profileResult.error) throw profileResult.error;
        if (!mounted) return;

        setSignedIn(true);
        setEntitlement((entitlementResult.data ?? null) as Entitlement | null);
        setIsAdmin(Boolean((profileResult.data as ProfileAccount | null)?.is_admin));
      } catch (error) {
        console.error("Unable to load Premium plan state.", error);
        if (mounted) {
          setLoadError("Your current plan could not be verified. Plan information remains available below.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadPlanState();
    return () => {
      mounted = false;
    };
  }, []);

  const currentPlan = useMemo(
    () => getCurrentPlan(entitlement, isAdmin),
    [entitlement, isAdmin]
  );
  const nativeIos = typeof window !== "undefined" && isIosNativeApp();
  const hasStripeCustomer = Boolean(entitlement?.stripe_customer_id);
  const canManageBilling = signedIn && (nativeIos || hasStripeCustomer);
  const aiUsage = getAiUsageLabel(currentPlan, entitlement);

  return (
    <main className="premium-v2-page">
      <div className="premium-v2-shell">
        <CheckoutStatus />

        <header className="premium-v2-hero">
          <div>
            <p className="premium-v2-eyebrow">Premium & Plan Center</p>
            <h1>Choose the depth of Loombus that fits you.</h1>
            <p>
              Core discussion access remains available to every member. Paid plans add the AI understanding layer, deeper organization, stronger creation tools, and expanded Video Context without changing Loombus into a scroll-first platform.
            </p>
          </div>
          <div className="premium-v2-hero-actions">
            <Link href="/ai-usage" className="premium-v2-primary-action"><Gauge aria-hidden="true" />AI usage</Link>
            <Link href="/support" className="premium-v2-secondary-action"><LifeBuoy aria-hidden="true" />Get support</Link>
          </div>
        </header>

        <section className="premium-v2-account-card" aria-label="Current plan">
          <div className="premium-v2-account-icon"><CreditCard aria-hidden="true" /></div>
          <div className="premium-v2-account-copy">
            <p className="premium-v2-eyebrow">Your account</p>
            {loading ? (
              <>
                <h2>Checking current plan…</h2>
                <p>Loombus is reading the current entitlement record.</p>
              </>
            ) : !signedIn ? (
              <>
                <h2>Sign in to see your current plan.</h2>
                <p>Plan comparison remains public. Sign in before starting checkout or managing an existing subscription.</p>
              </>
            ) : (
              <>
                <h2>{getPlanLabel(currentPlan)}</h2>
                <p>Included AI usage: {aiUsage}.</p>
              </>
            )}
          </div>
          <div className="premium-v2-account-facts">
            <div><span>Plan</span><strong>{loading ? "Checking" : signedIn ? getPlanLabel(currentPlan) : "Not signed in"}</strong></div>
            <div><span>AI access</span><strong>{loading ? "Checking" : signedIn ? aiUsage : "Sign in required"}</strong></div>
            <div><span>Billing management</span><strong>{loading ? "Checking" : !signedIn ? "Sign in required" : canManageBilling ? nativeIos ? "Apple subscriptions" : "Stripe portal available" : currentPlan === "free" ? "No active paid path detected" : "Billing source not exposed"}</strong></div>
          </div>
          <div className="premium-v2-account-actions">
            {!signedIn && !loading ? (
              <>
                <Link href="/login?next=/premium" className="premium-v2-primary-action">Log in</Link>
                <Link href="/signup" className="premium-v2-secondary-action">Create account</Link>
              </>
            ) : canManageBilling ? (
              <div className="premium-v2-embedded-action">
                <BillingPortalButton>Manage billing</BillingPortalButton>
              </div>
            ) : signedIn ? (
              <Link href="/support#contact-support" className="premium-v2-secondary-action">Ask about billing</Link>
            ) : null}
          </div>
        </section>

        {loadError ? <div className="premium-v2-inline-error">{loadError}</div> : null}

        <section className="premium-v2-section-heading">
          <div>
            <p className="premium-v2-eyebrow">Plans</p>
            <h2>Free, Premium, and Premium Plus.</h2>
            <p>Admin access is assigned operationally and is not sold as a subscription.</p>
          </div>
          <span><ShieldCheck aria-hidden="true" />Prices are shown before purchase</span>
        </section>

        <section className="premium-v2-plan-grid">
          {plans.map((plan) => {
            const isCurrent = signedIn && currentPlan === plan.key;
            return (
              <article key={plan.key} className={`premium-v2-plan-card${plan.key === "premium" ? " is-featured" : ""}${isCurrent ? " is-current" : ""}`}>
                <div className="premium-v2-plan-topline">
                  <span>{plan.label}</span>
                  {isCurrent ? <strong>Current</strong> : plan.key === "premium" ? <strong>Popular</strong> : null}
                </div>
                <h3>{plan.monthly}</h3>
                <p className="premium-v2-annual">{plan.annual}</p>
                <p className="premium-v2-standard">{plan.standardPrice}</p>
                <p className="premium-v2-plan-description">{plan.description}</p>
                <PlanActions
                  plan={plan.key}
                  currentPlan={currentPlan}
                  signedIn={signedIn}
                  canManageBilling={canManageBilling}
                />
                <ul>
                  {plan.features.map((feature) => (
                    <li key={feature}><Check aria-hidden="true" /><span>{feature}</span></li>
                  ))}
                </ul>
              </article>
            );
          })}
        </section>

        <section className="premium-v2-comparison-card">
          <div className="premium-v2-card-heading">
            <div>
              <p className="premium-v2-eyebrow">Compare access</p>
              <h2>See what changes between plans.</h2>
              <p>Signal remains the platform identity. Premium adds depth and control rather than paywalling basic participation.</p>
            </div>
            <Sparkles aria-hidden="true" />
          </div>
          <div className="premium-v2-table-wrap">
            <table>
              <thead><tr><th>Capability</th><th>Free</th><th>Premium</th><th>Premium Plus</th></tr></thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.feature}>
                    <th scope="row">{row.feature}</th>
                    <td><ComparisonValue value={row.free} /></td>
                    <td><ComparisonValue value={row.premium} /></td>
                    <td><ComparisonValue value={row.premiumPlus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="premium-v2-benefit-grid">
          <article><Bot aria-hidden="true" /><div><h3>AI understanding</h3><p>Summaries, takeaways, viewpoint mapping, thread evolution, Conversation Map, and Related Ideas remain attached to discussions.</p><Link href="/ai-usage">Review AI usage <ArrowRight aria-hidden="true" /></Link></div></article>
          <article><Tags aria-hidden="true" /><div><h3>Topic alerts</h3><p>Premium and Admin members can follow supported Signal Topics and receive new-discussion alerts through the existing topic-alert system.</p><Link href="/settings#topics">Manage topic alerts <ArrowRight aria-hidden="true" /></Link></div></article>
          <article><Mail aria-hidden="true" /><div><h3>Email digest</h3><p>Premium and Admin accounts can enable a daily or weekly summary of recent Loombus Signal.</p><Link href="/settings#signal">Manage Signal delivery <ArrowRight aria-hidden="true" /></Link></div></article>
          <article><Video aria-hidden="true" /><div><h3>Video Context</h3><p>Video supports written discussions rather than replacing them with a video feed. Upload count and duration expand by plan.</p><Link href="/settings/guide#video-context">Read the guide <ArrowRight aria-hidden="true" /></Link></div></article>
        </section>

        <section className="premium-v2-addon-card">
          <div>
            <p className="premium-v2-eyebrow">Optional add-on</p>
            <h2>Extra AI Pack</h2>
            <p>25 additional AI actions for $5. This is a one-time Stripe purchase, not a subscription tier.</p>
          </div>
          <div className="premium-v2-addon-price"><strong>$5</strong><span>25 actions</span></div>
          <div className="premium-v2-checkout-actions">
            <PremiumPlanCheckoutButton planKey="extra_ai_pack">Buy Extra AI Pack</PremiumPlanCheckoutButton>
          </div>
        </section>

        <section className="premium-v2-billing-grid">
          <article>
            <ReceiptText aria-hidden="true" />
            <h3>Manage, cancel, or review billing</h3>
            <p>Stripe subscriptions are managed in the secure Billing Portal. App Store subscriptions are managed through Apple. The current entitlement record does not expose a verified renewal date or scheduled-cancellation date on this page.</p>
            {canManageBilling ? <div className="premium-v2-embedded-action"><BillingPortalButton variant="secondary">Open billing management</BillingPortalButton></div> : <Link href="/support#contact-support">Contact support</Link>}
          </article>
          <article>
            <FileText aria-hidden="true" />
            <h3>Policies and purchase terms</h3>
            <p>Review cancellation, refund, privacy, and platform terms before purchasing or changing a plan.</p>
            <div className="premium-v2-policy-links"><Link href="/refunds">Refund Policy</Link><Link href="/terms">Terms</Link><Link href="/privacy">Privacy Policy</Link></div>
          </article>
          <article>
            <HelpCircle aria-hidden="true" />
            <h3>Billing state unavailable?</h3>
            <p>An active entitlement can come from Stripe, Apple, or administrative access. Loombus does not guess the billing source when the verified record does not expose it.</p>
            <Link href="/support#contact-support">Get billing support</Link>
          </article>
        </section>

        <footer className="premium-v2-footer-note">
          <CreditCard aria-hidden="true" />
          <p>Premium subscriptions renew automatically through the purchase provider until canceled through that provider. Pricing and the billing interval are shown before purchase.</p>
        </footer>
      </div>
    </main>
  );
}
