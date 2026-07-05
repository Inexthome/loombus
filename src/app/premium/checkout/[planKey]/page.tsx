"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { isIosNativeApp, purchaseApplePlan } from "@/lib/apple-purchases";

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

export default function PremiumCheckoutReturnPage() {
  const params = useParams();
  const rawPlanKey = params?.planKey;
  const planKey = useMemo(() => {
    const nextPlanKey = Array.isArray(rawPlanKey) ? rawPlanKey[0] : rawPlanKey ?? "";
    return allowedPlanKeys.has(nextPlanKey) ? nextPlanKey : "";
  }, [rawPlanKey]);
  const [message, setMessage] = useState("Preparing checkout...");

  useEffect(() => {
    if (!planKey) {
      setMessage("This Premium checkout link is not valid.");
      return;
    }

    let cancelled = false;

    async function startCheckout() {
      setMessage(`Opening ${getPlanLabel(planKey)} checkout...`);

      try {
        const { data: sessionData } = await supabase.auth.getSession();

        if (!sessionData.session) {
          const intentPath = `/premium/checkout/${encodeURIComponent(planKey)}`;
          window.localStorage.setItem(PENDING_SUBSCRIPTION_INTENT_KEY, intentPath);
          window.location.replace(`/login?next=${encodeURIComponent(intentPath)}`);
          return;
        }

        if (isIosNativeApp()) {
          await purchaseApplePlan(planKey);
          window.localStorage.removeItem(PENDING_SUBSCRIPTION_INTENT_KEY);
          setMessage("Apple purchase completed. Your Loombus access is being updated.");
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
      }
    }

    void startCheckout();

    return () => {
      cancelled = true;
    };
  }, [planKey]);

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <section className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-xl flex-col justify-center">
        <div className="rounded-[2rem] border border-zinc-800 bg-zinc-950 p-7 shadow-2xl shadow-black/30">
          <p className="mb-3 text-sm uppercase tracking-[0.3em] text-zinc-500">Loombus Premium</p>
          <h1 className="text-3xl font-semibold tracking-tight">Checkout is opening.</h1>
          <p className="mt-5 leading-relaxed text-zinc-400">{message}</p>
          <Link href="/premium" className="mt-7 inline-flex rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white">
            Back to Premium
          </Link>
        </div>
      </section>
    </main>
  );
}
