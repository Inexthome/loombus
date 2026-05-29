"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

const PLAN_LABELS: Record<string, string> = {
  premium_monthly: "Premium Monthly",
  premium_annual: "Premium Annual",
  premium_plus_monthly: "Premium Plus Monthly",
  premium_plus_annual: "Premium Plus Annual",
  extra_ai_pack: "Extra AI Pack",
};

function getPlanLabel(planKey: string | null) {
  if (!planKey) return "your Loombus plan";
  return PLAN_LABELS[planKey] ?? "your Loombus plan";
}

export function PremiumCheckoutStatusBanner() {
  const searchParams = useSearchParams();
  const checkoutStatus = searchParams.get("checkout");
  const planLabel = getPlanLabel(searchParams.get("plan"));

  if (checkoutStatus === "success") {
    return (
      <section className="mb-10 rounded-3xl border border-emerald-900/60 bg-emerald-950/20 p-6 shadow-2xl shadow-black/30">
        <p className="mb-2 text-sm uppercase tracking-[0.25em] text-emerald-400">
          Payment completed
        </p>

        <h2 className="text-2xl font-semibold tracking-tight text-white">
          {planLabel} checkout was completed.
        </h2>

        <p className="mt-3 max-w-3xl leading-relaxed text-zinc-400">
          Your billing is managed securely through Stripe. If your plan badge or
          AI usage limit does not update immediately, refresh the page in a
          moment while Stripe finishes sending the confirmation webhook.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/settings"
            className="inline-flex rounded-full bg-white px-5 py-3 text-sm text-black transition hover:bg-zinc-200"
          >
            Review account settings
          </Link>

          <Link
            href="/ai-usage"
            className="inline-flex rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
          >
            View AI usage
          </Link>
        </div>
      </section>
    );
  }

  if (checkoutStatus === "cancelled" || checkoutStatus === "canceled") {
    return (
      <section className="mb-10 rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl shadow-black/30">
        <p className="mb-2 text-sm uppercase tracking-[0.25em] text-zinc-500">
          Checkout cancelled
        </p>

        <h2 className="text-2xl font-semibold tracking-tight text-white">
          No payment was completed.
        </h2>

        <p className="mt-3 max-w-3xl leading-relaxed text-zinc-400">
          You can restart checkout whenever you are ready. Your current Loombus
          access remains unchanged.
        </p>
      </section>
    );
  }

  return null;
}
