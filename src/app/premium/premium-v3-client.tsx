"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  CreditCard,
  Gauge,
  HelpCircle,
  LifeBuoy,
  Minus,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { BillingPortalButton } from "@/components/billing-portal-button";
import { isIosNativeApp } from "@/lib/apple-purchases";
import {
  AI_ALLOWANCES,
  EARLY_ACCESS_PRICING,
  EARLY_ACCESS_PROMOTION_DURATION_MONTHS,
  EARLY_ACCESS_PROMOTION_END_DATE,
  EARLY_ACCESS_PROMOTION_ENDS_AT,
  LOOMBUS_OFFICIAL_LAUNCH_DATE,
  MASTER_SUBSCRIPTION_ENTITLEMENTS,
  PLAN_RANK,
  SUBSCRIPTION_PLANS,
  resolvePlanFromEntitlementRow,
  type MasterEntitlementValue,
  type SubscriptionPlanId,
} from "@/lib/subscription-entitlements";
import { supabase } from "@/lib/supabase/client";
import { PremiumPlanCheckoutButton } from "./premium-checkout-button";

type CurrentPlan = SubscriptionPlanId | "admin";
type PurchasablePlan = "premium" | "pro";

type Entitlement = {
  tier: string | null;
  ai_assisted_enabled: boolean | null;
  monthly_summary_limit: number | null;
  stripe_customer_id: string | null;
};

type ProfileAccount = {
  is_admin: boolean | null;
};

type CanonicalSubscriptionStatus = {
  plan: SubscriptionPlanId;
  paidPlan: SubscriptionPlanId;
  active: boolean;
  isAdmin: boolean;
  source: "profile_admin" | "general_subscription" | "legacy_ai_entitlement" | "free";
  billingProvider: "stripe" | "apple" | null;
  providers: Array<"stripe" | "apple">;
};

type PlanDefinition = {
  key: SubscriptionPlanId;
  label: string;
  monthly: string;
  annual: string;
  futurePrice: string;
  positioning: string;
  description: string;
  features: string[];
};

const plans: PlanDefinition[] = [
  {
    key: "free",
    label: SUBSCRIPTION_PLANS.free.label,
    monthly: "$0",
    annual: "No annual charge",
    futurePrice: "Core access remains free",
    positioning: SUBSCRIPTION_PLANS.free.positioning,
    description:
      "Participate in Loombus, discover people and ideas, and use the free front-door surfaces without a subscription.",
    features: [
      "Discussions, replies, follows, Topics, People and Following",
      "Local, Businesses, Services, Requests, Jobs, Events and Marketplace",
      "Appointments and core Calendar access",
      "Mutual messaging and limited organization tools",
      "Basic Loombus search, matching, alerts and email digest",
    ],
  },
  {
    key: "premium",
    label: SUBSCRIPTION_PLANS.premium.label,
    monthly: `$${EARLY_ACCESS_PRICING.current.premium.monthlyUsd} / month`,
    annual: `$${EARLY_ACCESS_PRICING.current.premium.annualUsd} / year`,
    futurePrice: `Launch-year promo · standard monthly target $${EARLY_ACCESS_PRICING.futureMonthlyTarget.premium}`,
    positioning: SUBSCRIPTION_PLANS.premium.positioning,
    description:
      "The Loombus intelligence subscription for members who want deeper understanding, stronger search and more control over their knowledge workflow.",
    features: [
      `${AI_ALLOWANCES.premium.understanding} AI discussion-understanding actions per month`,
      "Conversation Map, What Changed, viewpoint mapping and Related Ideas",
      "AI-powered search and enhanced matching",
      "Unlimited saves, folders, private notes and Stickies",
      "Advanced alerts, customizable digest and calendar sync",
      "Enhanced creator profile and basic creator analytics",
    ],
  },
  {
    key: "pro",
    label: SUBSCRIPTION_PLANS.pro.label,
    monthly: `$${EARLY_ACCESS_PRICING.current.pro.monthlyUsd} / month`,
    annual: `$${EARLY_ACCESS_PRICING.current.pro.annualUsd} / year`,
    futurePrice: `Launch-year promo · standard monthly target $${EARLY_ACCESS_PRICING.futureMonthlyTarget.pro}`,
    positioning: SUBSCRIPTION_PLANS.pro.positioning,
    description:
      "Professional leverage on top of Premium: deeper AI capacity, professional identity, booking infrastructure, discovery and economic tools.",
    features: [
      "Everything in Premium",
      `${AI_ALLOWANCES.pro.understanding} AI discussion-understanding actions per month`,
      "Knowledge Graph-assisted AI and advanced creator analytics",
      "Professional portfolio, service profile and booking tools",
      "Expert verification application eligibility; verification is independently approved",
      "Relevance-based professional matching and reduced service fees",
    ],
  },
];

const currentPlanRank: Record<CurrentPlan, number> = {
  ...PLAN_RANK,
  admin: 3,
};

function getCurrentPlan(
  entitlement: Entitlement | null,
  isAdmin: boolean,
  canonicalStatus: CanonicalSubscriptionStatus | null
): CurrentPlan {
  if (isAdmin || canonicalStatus?.isAdmin || entitlement?.tier === "admin") {
    return "admin";
  }
  if (canonicalStatus) return canonicalStatus.plan;
  return resolvePlanFromEntitlementRow(entitlement);
}

function getPlanLabel(plan: CurrentPlan) {
  if (plan === "admin") return "Admin";
  return SUBSCRIPTION_PLANS[plan].label;
}

function getAiUsageLabel(plan: CurrentPlan, entitlement: Entitlement | null) {
  if (plan === "admin") return "Unlimited / Admin";
  const limit = entitlement?.monthly_summary_limit ?? 0;
  if (limit <= 0) return "No paid AI allowance";
  return `${limit} understanding actions / month`;
}

function formatPromoCountdown(nowMs: number) {
  const remainingMs = Date.parse(EARLY_ACCESS_PROMOTION_ENDS_AT) - nowMs;

  if (remainingMs <= 0) {
    return "Launch-year pricing has ended.";
  }

  const totalMinutes = Math.floor(remainingMs / 60_000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  return `${days}d ${hours}h ${minutes}m remaining`;
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
          ? "Premium Pro Monthly"
          : plan === "premium_plus_annual"
            ? "Premium Pro Annual"
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
            Your purchase provider is finishing the entitlement update. Refresh shortly if your current plan has not changed yet.
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
          <span>No payment was completed and your current Loombus access remains unchanged.</span>
        </div>
      </section>
    );
  }

  return null;
}

function ComparisonValue({ value }: { value: MasterEntitlementValue }) {
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
  plan: SubscriptionPlanId;
  currentPlan: CurrentPlan;
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

  if (signedIn && currentPlanRank[currentPlan] > currentPlanRank[plan]) {
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

  if (signedIn && currentPlan !== "free") {
    return (
      <div className="premium-v2-actions">
        {canManageBilling ? (
          <div className="premium-v2-embedded-action">
            <BillingPortalButton variant="secondary">
              Manage billing
            </BillingPortalButton>
          </div>
        ) : (
          <Link
            href="/support#contact-support"
            className="premium-v2-secondary-action"
          >
            Ask about billing
          </Link>
        )}
      </div>
    );
  }

  const purchasablePlan = plan as PurchasablePlan;
  const monthlyKey =
    purchasablePlan === "premium"
      ? "premium_monthly"
      : "premium_plus_monthly";
  const annualKey =
    purchasablePlan === "premium"
      ? "premium_annual"
      : "premium_plus_annual";

  return (
    <div className="premium-v2-actions premium-v2-checkout-actions">
      <PremiumPlanCheckoutButton planKey={monthlyKey}>
        Start monthly
      </PremiumPlanCheckoutButton>
      <PremiumPlanCheckoutButton planKey={annualKey} variant="secondary">
        Start annually
      </PremiumPlanCheckoutButton>
    </div>
  );
}

export default function PremiumV3Client() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [canonicalStatus, setCanonicalStatus] =
    useState<CanonicalSubscriptionStatus | null>(null);
  const [promoCountdown, setPromoCountdown] = useState(
    `Ends ${EARLY_ACCESS_PROMOTION_END_DATE}`
  );

  useEffect(() => {
    const updateCountdown = () => setPromoCountdown(formatPromoCountdown(Date.now()));
    updateCountdown();
    const timer = window.setInterval(updateCountdown, 60_000);
    return () => window.clearInterval(timer);
  }, []);

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
            setCanonicalStatus(null);
          }
          return;
        }

        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) throw new Error("Missing authenticated billing session.");

        const [subscriptionResponse, entitlementResult, profileResult] =
          await Promise.all([
            fetch("/api/billing/subscription-status", {
              method: "GET",
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
              cache: "no-store",
            }),
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

        if (!subscriptionResponse.ok) {
          throw new Error("Canonical subscription status could not be verified.");
        }
        if (entitlementResult.error) throw entitlementResult.error;
        if (profileResult.error) throw profileResult.error;

        const subscriptionStatus =
          (await subscriptionResponse.json()) as CanonicalSubscriptionStatus;

        if (!mounted) return;

        setSignedIn(true);
        setCanonicalStatus(subscriptionStatus);
        setEntitlement((entitlementResult.data ?? null) as Entitlement | null);
        setIsAdmin(Boolean((profileResult.data as ProfileAccount | null)?.is_admin));
      } catch (error) {
        console.error("Unable to load Premium plan state.", error);
        if (mounted) {
          setCanonicalStatus(null);
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
    () => getCurrentPlan(entitlement, isAdmin, canonicalStatus),
    [canonicalStatus, entitlement, isAdmin]
  );
  const nativeIos = typeof window !== "undefined" && isIosNativeApp();
  const hasStripeCustomer = Boolean(entitlement?.stripe_customer_id);
  const hasStripeProvider = canonicalStatus?.providers.includes("stripe") ?? false;
  const hasAppleProvider = canonicalStatus?.providers.includes("apple") ?? false;
  const canManageBilling =
    signedIn &&
    (nativeIos || hasStripeProvider || hasAppleProvider || hasStripeCustomer);
  const aiUsage = getAiUsageLabel(currentPlan, entitlement);
  const billingLabel = loading
    ? "Checking"
    : !signedIn
      ? "Sign in required"
      : hasAppleProvider && hasStripeProvider
        ? "Apple + Stripe"
        : hasAppleProvider
          ? "Apple subscription"
          : hasStripeProvider || hasStripeCustomer
            ? "Stripe portal available"
            : nativeIos
              ? "Apple subscriptions"
              : currentPlan === "free"
                ? "No paid subscription"
                : "Billing source unavailable";

  return (
    <main className="premium-v2-page">
      <div className="premium-v2-shell">
        <CheckoutStatus />

        <header className="premium-v2-hero">
          <div>
            <p className="premium-v2-eyebrow">Premium & Plan Center</p>
            <h1>Free participation. Paid intelligence. Pro leverage.</h1>
            <p>
              The master subscription model keeps Loombus participation open while paid plans add intelligence, productivity and professional leverage. Trust signals are earned, never purchased.
            </p>
          </div>
          <div className="premium-v2-hero-actions">
            <Link href="/ai-usage" className="premium-v2-primary-action"><Gauge aria-hidden="true" />AI usage</Link>
            <Link href="/support" className="premium-v2-secondary-action"><LifeBuoy aria-hidden="true" />Get support</Link>
          </div>
        </header>

        <section className="premium-v3-promo" aria-label="Launch-year pricing">
          <Sparkles aria-hidden="true" />
          <div>
            <strong>Launch-year pricing is active. {promoCountdown}</strong>
            <span>
              Loombus officially launched June 15, 2026. Premium is $7/month or $70/year and Premium Pro is $12/month or $120/year for the first {EARLY_ACCESS_PROMOTION_DURATION_MONTHS} months. This pricing ends June 14, 2027 at 11:59 PM ET; standard pricing begins June 15, 2027. Standard monthly targets are $12 and $19. Join before the launch-year window closes.
            </span>
            <span className="premium-v2-standard">
              Official launch: {LOOMBUS_OFFICIAL_LAUNCH_DATE} · Standard-pricing start: {EARLY_ACCESS_PROMOTION_END_DATE}
            </span>
          </div>
        </section>

        <section className="premium-v2-account-card" aria-label="Current plan">
          <div className="premium-v2-account-icon"><CreditCard aria-hidden="true" /></div>
          <div className="premium-v2-account-copy">
            <p className="premium-v2-eyebrow">Your account</p>
            {loading ? (
              <><h2>Checking current plan…</h2><p>Loombus is reading the verified subscription state.</p></>
            ) : !signedIn ? (
              <><h2>Sign in to see your current plan.</h2><p>Plan comparison is public. Sign in before purchase or billing management.</p></>
            ) : (
              <><h2>{getPlanLabel(currentPlan)}</h2><p>Included AI usage: {aiUsage}.</p></>
            )}
          </div>
          <div className="premium-v2-account-facts">
            <div><span>Plan</span><strong>{loading ? "Checking" : signedIn ? getPlanLabel(currentPlan) : "Not signed in"}</strong></div>
            <div><span>AI access</span><strong>{loading ? "Checking" : signedIn ? aiUsage : "Sign in required"}</strong></div>
            <div><span>Billing</span><strong>{billingLabel}</strong></div>
          </div>
          <div className="premium-v2-account-actions">
            {!signedIn && !loading ? (
              <><Link href="/login?next=/premium" className="premium-v2-primary-action">Log in</Link><Link href="/signup" className="premium-v2-secondary-action">Create account</Link></>
            ) : canManageBilling ? (
              <div className="premium-v2-embedded-action"><BillingPortalButton>Manage billing</BillingPortalButton></div>
            ) : signedIn ? (
              <Link href="/support#contact-support" className="premium-v2-secondary-action">Ask about billing</Link>
            ) : null}
          </div>
        </section>

        {loadError ? <div className="premium-v2-inline-error">{loadError}</div> : null}

        <section className="premium-v2-section-heading">
          <div>
            <p className="premium-v2-eyebrow">Plans</p>
            <h2>Free, Premium, and Premium Pro.</h2>
            <p>Admin access is assigned operationally and is not sold as a subscription.</p>
          </div>
          <span><ShieldCheck aria-hidden="true" />Current prices shown before purchase</span>
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
                <p className="premium-v3-positioning">{plan.positioning}</p>
                <h3>{plan.monthly}</h3>
                <p className="premium-v2-annual">{plan.annual}</p>
                <p className="premium-v2-standard">{plan.futurePrice}</p>
                <p className="premium-v2-plan-description">{plan.description}</p>
                <PlanActions plan={plan.key} currentPlan={currentPlan} signedIn={signedIn} canManageBilling={canManageBilling} />
                <ul>
                  {plan.features.map((feature) => (
                    <li key={feature}><Check aria-hidden="true" /><span>{feature}</span></li>
                  ))}
                </ul>
              </article>
            );
          })}
        </section>

        <section id="master-entitlements" className="premium-v2-comparison-card">
          <div className="premium-v2-card-heading">
            <div>
              <p className="premium-v2-eyebrow">Master entitlement map</p>
              <h2>One source of truth for plan access.</h2>
              <p>
                Free owns participation, Premium owns intelligence and productivity, and Premium Pro owns professional leverage. Legacy premium_plus billing keys remain internal so existing Stripe and Apple subscriptions are not crossed or broken.
              </p>
            </div>
            <ShieldCheck aria-hidden="true" />
          </div>
          <div className="premium-v2-table-wrap premium-v3-master-table">
            <table>
              <thead><tr><th>Capability</th><th>Free</th><th>Premium</th><th>Premium Pro</th></tr></thead>
              <tbody>
                {MASTER_SUBSCRIPTION_ENTITLEMENTS.map((group) => (
                  <Fragment key={group.label}>
                    <tr className="premium-v3-group-row"><th colSpan={4}>{group.label}</th></tr>
                    {group.rows.map((row) => (
                      <tr key={`${group.label}-${row.capability}`}>
                        <th scope="row">{row.capability}</th>
                        <td><ComparisonValue value={row.free} /></td>
                        <td><ComparisonValue value={row.premium} /></td>
                        <td><ComparisonValue value={row.pro} /></td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="premium-v3-trust-card">
          <ShieldCheck aria-hidden="true" />
          <div>
            <strong>Trust is not a subscription perk.</strong>
            <p>
              Premium Pro can unlock the application and professional infrastructure around expert verification, but a subscription never grants or guarantees verification. Search, jobs and professional matching remain relevance and eligibility based; Loombus does not sell ranking.
            </p>
          </div>
        </section>

        <section className="premium-v2-benefit-grid">
          <article><Bot aria-hidden="true" /><div><h3>Premium = intelligence</h3><p>AI understanding, AI-powered search, organization, alerts and productivity form the core paid upgrade.</p><Link href="/ai-usage">Review AI usage <ArrowRight aria-hidden="true" /></Link></div></article>
          <article><Sparkles aria-hidden="true" /><div><h3>Pro = leverage</h3><p>Professional identity, discovery, booking infrastructure, advanced analytics and economic benefits give Pro a distinct job.</p><Link href="#master-entitlements">Compare access <ArrowRight aria-hidden="true" /></Link></div></article>
          <article><ShieldCheck aria-hidden="true" /><div><h3>No tier crossover</h3><p>The public Pro name maps to the existing premium_plus purchase keys while plan resolution is centralized in the master entitlement model.</p></div></article>
        </section>

        <section className="premium-v2-addon-card">
          <div>
            <p className="premium-v2-eyebrow">Optional add-on</p>
            <h2>Extra AI Pack</h2>
            <p>25 additional AI actions for $5. This remains a one-time purchase, not a subscription tier.</p>
          </div>
          <div className="premium-v2-addon-price"><strong>$5</strong><span>25 actions</span></div>
          <div className="premium-v2-checkout-actions"><PremiumPlanCheckoutButton planKey="extra_ai_pack">Buy Extra AI Pack</PremiumPlanCheckoutButton></div>
        </section>

        <section className="premium-v2-billing-grid">
          <article>
            <ReceiptText aria-hidden="true" />
            <h3>Manage or cancel billing</h3>
            <p>Stripe subscriptions use the secure Billing Portal. App Store subscriptions remain managed through Apple.</p>
            {canManageBilling ? <div className="premium-v2-embedded-action"><BillingPortalButton variant="secondary">Open billing management</BillingPortalButton></div> : <Link href="/support#contact-support">Contact support</Link>}
          </article>
          <article>
            <HelpCircle aria-hidden="true" />
            <h3>Need billing help?</h3>
            <p>Loombus does not guess a billing source when the verified entitlement record does not expose one.</p>
            <Link href="/support#contact-support">Get billing support</Link>
          </article>
        </section>

        <footer className="premium-v2-footer-note">
          <CreditCard aria-hidden="true" />
          <p>Paid subscriptions renew through the purchase provider until canceled. Current launch-year pricing and the billing interval are shown before purchase.</p>
        </footer>
      </div>
    </main>
  );
}