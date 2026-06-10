"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BillingPortalButton } from "@/components/billing-portal-button";
import { supabase } from "@/lib/supabase/client";
import { PremiumPlanCheckoutButton } from "./premium-checkout-button";

type PlanKey =
  | "free"
  | "premium"
  | "premium_plus";

type CheckoutPlanKey =
  | "premium_monthly"
  | "premium_annual"
  | "premium_plus_monthly"
  | "premium_plus_annual";

type Entitlement = {
  tier: string | null;
  ai_assisted_enabled: boolean | null;
  monthly_summary_limit: number | null;
};

type PremiumPlanActionsProps = {
  plan: PlanKey;
};

function getCurrentPlan(entitlement: Entitlement | null): PlanKey {
  if (!entitlement?.ai_assisted_enabled) {
    return "free";
  }

  if (entitlement.tier === "premium_plus" || entitlement.tier === "admin") {
    return "premium_plus";
  }

  if (
    entitlement.tier === "premium" &&
    (entitlement.monthly_summary_limit ?? 0) > 50
  ) {
    return "premium_plus";
  }

  if (entitlement.tier === "premium") {
    return "premium";
  }

  return "free";
}

function planRank(plan: PlanKey) {
  if (plan === "premium_plus") return 2;
  if (plan === "premium") return 1;
  return 0;
}

function planLabel(plan: PlanKey) {
  if (plan === "premium_plus") return "Premium Plus";
  if (plan === "premium") return "Premium";
  return "Free";
}

function checkoutButtonLabel(planKey: CheckoutPlanKey, currentPlan: PlanKey) {
  const isUpgrade = currentPlan !== "free";

  if (planKey === "premium_monthly") {
    return isUpgrade ? "Upgrade to Premium monthly" : "Start Premium monthly";
  }

  if (planKey === "premium_annual") {
    return isUpgrade ? "Upgrade to Premium annual" : "Start Premium annual";
  }

  if (planKey === "premium_plus_monthly") {
    return isUpgrade ? "Upgrade to Premium Plus monthly" : "Start Premium Plus monthly";
  }

  return isUpgrade ? "Upgrade to Premium Plus annual" : "Start Premium Plus annual";
}

function CurrentBadge({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex rounded-full border border-zinc-700 bg-black px-5 py-3 text-sm text-zinc-300">
      {children}
    </div>
  );
}

export function PremiumPlanActions({ plan }: PremiumPlanActionsProps) {
  const [loaded, setLoaded] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadPlan() {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;

      if (!isMounted) {
        return;
      }

      setIsLoggedIn(Boolean(userId));

      if (!userId) {
        setEntitlement(null);
        setLoaded(true);
        return;
      }

      const { data } = await supabase
        .from("user_ai_entitlements")
        .select("tier, ai_assisted_enabled, monthly_summary_limit")
        .eq("user_id", userId)
        .maybeSingle();

      if (!isMounted) {
        return;
      }

      setEntitlement((data ?? null) as Entitlement | null);
      setLoaded(true);
    }

    loadPlan();

    return () => {
      isMounted = false;
    };
  }, []);

  const currentPlan = useMemo(() => getCurrentPlan(entitlement), [entitlement]);
  const currentRank = planRank(currentPlan);
  const targetRank = planRank(plan);

  if (!loaded) {
    return (
      <div className="inline-flex rounded-full border border-zinc-800 px-5 py-3 text-sm text-zinc-500">
        Checking plan...
      </div>
    );
  }

  if (!isLoggedIn) {
    if (plan === "free") {
      return (
        <div className="flex flex-wrap gap-3">
          <Link
            href="/signup"
            className="inline-flex rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
          >
            Choose Free
          </Link>

          <Link
            href="/login"
            className="inline-flex rounded-full border border-zinc-800 px-5 py-3 text-sm text-zinc-500 transition hover:border-zinc-600 hover:text-white"
          >
            Log in
          </Link>
        </div>
      );
    }

    return (
      <div className="flex flex-wrap gap-3">
        {plan === "premium" ? (
          <>
            <PremiumPlanCheckoutButton planKey="premium_monthly">
              Start Premium monthly
            </PremiumPlanCheckoutButton>

            <PremiumPlanCheckoutButton planKey="premium_annual" variant="secondary">
              Start Premium annual
            </PremiumPlanCheckoutButton>
          </>
        ) : (
          <>
            <PremiumPlanCheckoutButton planKey="premium_plus_monthly">
              Start Premium Plus monthly
            </PremiumPlanCheckoutButton>

            <PremiumPlanCheckoutButton planKey="premium_plus_annual" variant="secondary">
              Start Premium Plus annual
            </PremiumPlanCheckoutButton>
          </>
        )}
      </div>
    );
  }

  if (plan === currentPlan) {
    return (
      <div className="flex flex-wrap gap-3">
        <CurrentBadge>Current plan</CurrentBadge>
        <BillingPortalButton variant="secondary">
          Manage billing
        </BillingPortalButton>
      </div>
    );
  }

  if (targetRank < currentRank) {
    return (
      <CurrentBadge>
        Included with {planLabel(currentPlan)}
      </CurrentBadge>
    );
  }

  if (plan === "free") {
    return (
      <CurrentBadge>
        Current plan
      </CurrentBadge>
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      {plan === "premium" ? (
        <>
          <PremiumPlanCheckoutButton planKey="premium_monthly">
            {checkoutButtonLabel("premium_monthly", currentPlan)}
          </PremiumPlanCheckoutButton>

          <PremiumPlanCheckoutButton planKey="premium_annual" variant="secondary">
            {checkoutButtonLabel("premium_annual", currentPlan)}
          </PremiumPlanCheckoutButton>
        </>
      ) : (
        <>
          <PremiumPlanCheckoutButton planKey="premium_plus_monthly">
            {checkoutButtonLabel("premium_plus_monthly", currentPlan)}
          </PremiumPlanCheckoutButton>

          <PremiumPlanCheckoutButton planKey="premium_plus_annual" variant="secondary">
            {checkoutButtonLabel("premium_plus_annual", currentPlan)}
          </PremiumPlanCheckoutButton>
        </>
      )}
    </div>
  );
}
