"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { isIosNativeApp, purchaseApplePlan } from "@/lib/apple-purchases";
import { showLoombusPrompt } from "@/lib/loombus-prompt";
import { showSubscriptionWarning } from "@/lib/subscription-access-prompt";

type PremiumPlanCheckoutButtonProps = {
  planKey: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
};

type CanonicalSubscriptionStatus = {
  active?: boolean;
  isAdmin?: boolean;
  billingProvider?: "stripe" | "apple" | null;
  providers?: Array<"stripe" | "apple">;
};

export function PremiumPlanCheckoutButton({
  planKey,
  children,
  variant = "primary",
}: PremiumPlanCheckoutButtonProps) {
  const [startingCheckout, setStartingCheckout] = useState(false);

  async function startCheckout() {
    if (startingCheckout) return;

    setStartingCheckout(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        showSubscriptionWarning({
          title: "Sign in required",
          message: "Sign in before starting a Loombus subscription purchase.",
          actionHref: "/login?next=/premium",
          actionLabel: "Log in",
        });
        return;
      }

      // Fail closed before either Stripe Checkout or StoreKit purchase. The
      // server remains authoritative, but this preflight prevents the Premium
      // UI from initiating a second recurring membership when an active Stripe
      // or Apple membership is already bound to the account.
      const subscriptionResponse = await fetch("/api/billing/subscription-status", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        cache: "no-store",
      });

      if (!subscriptionResponse.ok) {
        showSubscriptionWarning({
          title: "Plan verification unavailable",
          message:
            "Loombus could not verify your current membership. No purchase was started. Please try again shortly.",
        });
        return;
      }

      const subscriptionStatus =
        (await subscriptionResponse.json()) as CanonicalSubscriptionStatus;

      if (subscriptionStatus.active || subscriptionStatus.isAdmin) {
        const providerLabel = subscriptionStatus.providers?.includes("apple")
          ? subscriptionStatus.providers.includes("stripe")
            ? "Apple or Stripe"
            : "Apple"
          : subscriptionStatus.providers?.includes("stripe")
            ? "Stripe"
            : subscriptionStatus.billingProvider === "apple"
              ? "Apple"
              : subscriptionStatus.billingProvider === "stripe"
                ? "Stripe"
                : "your current billing provider";

        showSubscriptionWarning({
          title: "Membership already active",
          message: subscriptionStatus.isAdmin
            ? "Admin access already includes Loombus paid-plan capabilities. No subscription purchase was started."
            : `Your Loombus membership is already active through ${providerLabel}. Use Manage billing to change or cancel the existing membership instead of starting another subscription.`,
        });
        return;
      }

      if (isIosNativeApp()) {
        await purchaseApplePlan(planKey);
        showLoombusPrompt({
          title: "Purchase completed",
          message: "Your Loombus access is being updated.",
          tone: "success",
          autoDismissMs: 3600,
          compact: true,
        });
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
        body: JSON.stringify({ planKey }),
        signal: controller.signal,
      });

      window.clearTimeout(timeoutId);

      const result = await response.json().catch(() => ({
        error: "Checkout returned an unreadable response.",
      }));

      if (!response.ok) {
        showSubscriptionWarning({
          title: "Checkout unavailable",
          message: result.detail
            ? `${result.error ?? "Unable to start Premium checkout."} ${result.detail}`
            : result.error ?? "Unable to start Premium checkout.",
        });
        return;
      }

      if (!result.url) {
        showSubscriptionWarning({
          title: "Checkout unavailable",
          message: "Checkout URL was not returned.",
        });
        return;
      }

      window.location.href = result.url;
    } catch (error) {
      const errorMessage =
        error instanceof DOMException && error.name === "AbortError"
          ? "Checkout request timed out. Please try again."
          : error instanceof Error
            ? error.message
            : "Unable to start Premium checkout.";

      showSubscriptionWarning({
        title: "Checkout unavailable",
        message: errorMessage,
      });
    } finally {
      setStartingCheckout(false);
    }
  }

  const buttonClass =
    variant === "primary"
      ? "inline-flex rounded-full bg-white px-5 py-3 text-sm text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
      : "inline-flex rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700";

  return (
    <button
      type="button"
      onClick={startCheckout}
      disabled={startingCheckout}
      className={buttonClass}
    >
      {startingCheckout ? "Starting checkout..." : children}
    </button>
  );
}
