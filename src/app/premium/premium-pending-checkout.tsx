"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { isIosNativeApp } from "@/lib/apple-purchases";

const PENDING_SUBSCRIPTION_INTENT_KEY = "loombus:pending-subscription-intent";

const allowedPlanKeys = new Set([
  "premium_monthly",
  "premium_annual",
  "premium_plus_monthly",
  "premium_plus_annual",
  "extra_ai_pack",
]);

function getPlanLabel(planKey: string) {
  if (planKey === "premium_monthly") return "Premium monthly";
  if (planKey === "premium_annual") return "Premium annual";
  if (planKey === "premium_plus_monthly") return "Premium Plus monthly";
  if (planKey === "premium_plus_annual") return "Premium Plus annual";
  if (planKey === "extra_ai_pack") return "Extra AI Pack";
  return "Premium checkout";
}

export function PremiumPendingCheckout() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("");
  const [starting, setStarting] = useState(false);

  const planKey = useMemo(() => {
    const nextPlan = searchParams.get("plan") ?? "";
    return allowedPlanKeys.has(nextPlan) ? nextPlan : "";
  }, [searchParams]);

  const shouldStartCheckout = searchParams.get("intent") === "checkout" && Boolean(planKey);

  useEffect(() => {
    if (!shouldStartCheckout || !planKey || starting) return;

    let cancelled = false;

    async function startPendingCheckout() {
      setStarting(true);
      setMessage(`Opening ${getPlanLabel(planKey)} checkout...`);

      try {
        const { data: sessionData } = await supabase.auth.getSession();

        if (!sessionData.session) {
          const intentPath = `/premium?intent=checkout&plan=${encodeURIComponent(planKey)}`;
          window.localStorage.setItem(PENDING_SUBSCRIPTION_INTENT_KEY, intentPath);
          window.location.replace(`/login?next=${encodeURIComponent(intentPath)}`);
          return;
        }

        if (isIosNativeApp()) {
          setMessage("Choose your plan again to finish the Apple in-app purchase.");
          window.localStorage.removeItem(PENDING_SUBSCRIPTION_INTENT_KEY);
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

        if (cancelled) return;

        if (!response.ok || !result.url) {
          setMessage(
            result.detail
              ? `${result.error ?? "Unable to start Premium checkout."} ${result.detail}`
              : result.error ?? "Unable to start Premium checkout."
          );
          setStarting(false);
          return;
        }

        window.localStorage.removeItem(PENDING_SUBSCRIPTION_INTENT_KEY);
        window.location.href = result.url;
      } catch (error) {
        if (cancelled) return;
        const errorMessage =
          error instanceof DOMException && error.name === "AbortError"
            ? "Checkout request timed out. Please try again."
            : error instanceof Error
              ? error.message
              : "Unable to start Premium checkout.";

        setMessage(errorMessage);
        setStarting(false);
      }
    }

    void startPendingCheckout();

    return () => {
      cancelled = true;
    };
  }, [planKey, shouldStartCheckout, starting]);

  if (!shouldStartCheckout && !message) return null;

  return (
    <div className="mb-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-400 shadow-2xl shadow-black/30">
      {message || "Preparing checkout..."}
    </div>
  );
}
