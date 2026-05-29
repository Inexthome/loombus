import { Suspense } from "react";
import Link from "next/link";
import { BillingPortalButton } from "@/components/billing-portal-button";
import { PremiumPlanCheckoutButton } from "./premium-checkout-button";
import { PremiumCheckoutStatusBanner } from "./premium-checkout-status-banner";

type FeatureStatus = "available" | "planned";

type PlanFeature = {
  label: string;
  status: FeatureStatus;
};

const freeFeatures: PlanFeature[] = [
  { label: "Read public discussions", status: "available" },
  { label: "Create discussions", status: "available" },
  { label: "Reply to discussions", status: "available" },
  { label: "Follow people", status: "available" },
  { label: "Basic public profile", status: "available" },
  { label: "Save/bookmark discussions", status: "available" },
  { label: "Basic notifications", status: "available" },
];

const premiumFeatures: PlanFeature[] = [
  { label: "AI discussion summaries", status: "available" },
  { label: "AI key takeaways", status: "available" },
  { label: "Thread Evolution / What Changed", status: "available" },
  { label: "Viewpoint Map / Disagreement Mapping", status: "available" },
  { label: "Higher monthly AI usage limit", status: "available" },
  { label: "Advanced discussion filters", status: "available" },
  { label: "Saved folders / collections", status: "available" },
  { label: "Personal reading history", status: "available" },
  { label: "Custom profile badge: Premium Member", status: "available" },
  { label: "Better notification controls", status: "available" },
  { label: "Premium email digest", status: "available" },
  { label: "Premium topic alerts", status: "available" },
  { label: "Draft mode for discussions", status: "available" },
  { label: "Extended edit window", status: "available" },
];

const premiumPlusFeatures: PlanFeature[] = [
  {
    label: "Higher included AI usage for summaries, takeaways, viewpoint maps, and thread evolution",
    status: "available",
  },
  { label: "AI discussion quality check before posting", status: "available" },
  { label: "AI rewrite for clarity before posting", status: "available" },
  { label: "Private notes on saved discussions", status: "available" },
  { label: "Export saved discussions and notes", status: "available" },
  { label: "Longer discussion posts", status: "available" },
  { label: "Priority feature access / Loombus Labs", status: "available" },
  { label: "Premium Plus Labs voting", status: "available" },
  { label: "Optional creator/supporter profile tools", status: "available" },
];

function FeatureList({ features }: { features: PlanFeature[] }) {
  return (
    <ul className="space-y-3 text-sm leading-relaxed text-zinc-400">
      {features.map((feature) => (
        <li key={feature.label} className="flex gap-3">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-500" />
          <span className="flex flex-wrap items-center gap-2">
            <span>{feature.label}</span>
            {feature.status === "planned" && (
              <span className="rounded-full border border-zinc-800 px-2 py-0.5 text-[0.65rem] uppercase tracking-wide text-zinc-500">
                Planned
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function PremiumPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-6xl">
        <Suspense fallback={null}>
          <PremiumCheckoutStatusBanner />
        </Suspense>

        <div className="mb-14 max-w-3xl">
          <p className="mb-3 text-sm uppercase tracking-[0.3em] text-zinc-500">
            Loombus Premium
          </p>

          <h1 className="text-5xl font-semibold tracking-tight md:text-6xl">
            Choose your Loombus plan.
          </h1>

          <p className="mt-5 text-lg leading-relaxed text-zinc-400">
            Loombus gives every member core discussion access, with Premium
            tiers for stronger AI assistance, better organization, and deeper
            reading tools.
          </p>

          <p className="mt-5 rounded-3xl border border-zinc-800 bg-zinc-950 p-5 text-sm leading-relaxed text-zinc-500 shadow-2xl shadow-black/30">
            Features marked <span className="text-zinc-300">Planned</span> are roadmap items
            and will be built/wired before they are treated as active subscription benefits.
          </p>
        </div>

        <section className="mb-12 grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8 shadow-2xl shadow-black/30">
            <p className="mb-3 text-sm uppercase tracking-wide text-zinc-500">
              Free
            </p>

            <div className="mb-5 flex items-end gap-2">
              <span className="text-5xl font-semibold">$0</span>
              <span className="pb-2 text-zinc-500">/ month</span>
            </div>

            <p className="mb-6 leading-relaxed text-zinc-400">
              Core Loombus access for reading, posting, replying, following,
              and saving high-signal discussions.
            </p>

            <div className="mb-8 flex flex-wrap gap-3">
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

            <FeatureList features={freeFeatures} />
          </div>

          <div className="rounded-3xl border border-zinc-600 bg-zinc-950 p-8 shadow-2xl shadow-white/10">
            <p className="mb-3 text-sm uppercase tracking-wide text-zinc-400">
              Premium
            </p>

            <p className="mb-2 text-sm uppercase tracking-wide text-emerald-400">
              Early Access pricing
            </p>

            <div className="mb-2 flex items-end gap-2">
              <span className="text-5xl font-semibold">$7</span>
              <span className="pb-2 text-zinc-500">/ month</span>
            </div>

            <p className="mb-2 text-sm text-zinc-400">
              Early Access annual: $70/year
            </p>

            <p className="mb-6 text-sm leading-relaxed text-zinc-500">
              Standard: $9/month or $90/year. You save $2/month or $20/year during Early Access.
            </p>

            <div className="mb-8 space-y-3">
              <div className="flex flex-wrap gap-3">
                <PremiumPlanCheckoutButton planKey="premium_monthly">
                  Start Premium monthly
                </PremiumPlanCheckoutButton>

                <PremiumPlanCheckoutButton planKey="premium_annual" variant="secondary">
                  Start Premium annual
                </PremiumPlanCheckoutButton>
              </div>

              <p className="text-xs leading-relaxed text-zinc-600">
                Secure live checkout is handled by Stripe. Your plan is
                activated after payment succeeds.
              </p>
            </div>

            <FeatureList features={premiumFeatures} />
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8 shadow-2xl shadow-black/30">
            <p className="mb-3 text-sm uppercase tracking-wide text-zinc-500">
              Premium Plus
            </p>

            <p className="mb-2 text-sm uppercase tracking-wide text-emerald-400">
              Early Access pricing
            </p>

            <div className="mb-2 flex items-end gap-2">
              <span className="text-5xl font-semibold">$12</span>
              <span className="pb-2 text-zinc-500">/ month</span>
            </div>

            <p className="mb-2 text-sm text-zinc-400">
              Early Access annual: $120/year
            </p>

            <p className="mb-2 text-sm leading-relaxed text-zinc-500">
              Standard: $15/month or $150/year. You save $3/month or $30/year during Early Access.
            </p>

            <p className="mb-6 text-sm leading-relaxed text-zinc-500">
              Built for heavier AI usage, Labs access, creator tools, exports, longer posts, and pre-posting AI support.
            </p>

            <div className="mb-8 space-y-3">
              <div className="flex flex-wrap gap-3">
                <PremiumPlanCheckoutButton planKey="premium_plus_monthly">
                  Start Premium Plus monthly
                </PremiumPlanCheckoutButton>

                <PremiumPlanCheckoutButton planKey="premium_plus_annual" variant="secondary">
                  Start Premium Plus annual
                </PremiumPlanCheckoutButton>
              </div>

              <p className="text-xs leading-relaxed text-zinc-600">
                Secure live checkout is handled by Stripe. Your plan is
                activated after payment succeeds.
              </p>
            </div>

            <FeatureList features={premiumPlusFeatures} />
          </div>
        </section>

        <section className="mb-12 rounded-3xl border border-zinc-800 bg-zinc-950 p-8 shadow-2xl shadow-black/30">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="mb-3 text-sm uppercase tracking-wide text-zinc-500">
                Billing
              </p>

              <h2 className="text-3xl font-semibold tracking-tight">
                Need to manage an existing subscription?
              </h2>

              <p className="mt-4 max-w-2xl leading-relaxed text-zinc-500">
                Open the secure Stripe Billing Portal to update payment details,
                review invoices, or manage your Premium subscription. Review the{" "}
                <Link href="/refunds" className="text-zinc-300 underline-offset-4 hover:underline">
                  Refund Policy
                </Link>{" "}
                before purchasing or managing a paid plan.
              </p>
            </div>

            <BillingPortalButton variant="secondary">
              Manage billing
            </BillingPortalButton>
          </div>
        </section>

        <section className="mb-12 rounded-3xl border border-zinc-800 bg-zinc-950 p-8 shadow-2xl shadow-black/30">
          <div className="grid gap-8 md:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="mb-3 text-sm uppercase tracking-wide text-zinc-500">
                Add-on
              </p>

              <h2 className="text-3xl font-semibold tracking-tight">
                Extra AI Pack
              </h2>
            </div>

            <div>
              <div className="mb-4 flex items-end gap-2">
                <span className="text-4xl font-semibold">$5</span>
                <span className="pb-1 text-zinc-500">
                  for 25 additional AI actions
                </span>
              </div>

              <p className="max-w-2xl leading-relaxed text-zinc-400">
                Optional add-on for members who reach their included monthly AI
                limit and want more summaries, takeaways, viewpoint maps, or
                thread-evolution actions without changing subscription tiers.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <PremiumPlanCheckoutButton planKey="extra_ai_pack">
                  Buy Extra AI Pack
                </PremiumPlanCheckoutButton>
              </div>

              <p className="mt-4 text-sm text-zinc-600">
                Extra AI Pack is a one-time add-on. Credits are fulfilled after
                Stripe checkout succeeds.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-12 rounded-3xl border border-zinc-800 bg-zinc-950 p-8 shadow-2xl shadow-black/30">
          <div className="grid gap-8 md:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="mb-3 text-sm uppercase tracking-wide text-zinc-500">
                Pricing philosophy
              </p>

              <h2 className="text-3xl font-semibold tracking-tight">
                Simple subscription first.
              </h2>
            </div>

            <div className="space-y-4 leading-relaxed text-zinc-400">
              <p>
                Loombus uses subscription pricing first instead of making
                members think about a meter every time they use an AI tool.
              </p>

              <p>
                Extra AI packs can be added for heavier usage, while the core
                experience remains built around clear Free, Premium, and
                Premium Plus plans.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8 shadow-2xl shadow-black/30">
          <h2 className="mb-3 text-2xl font-medium">
            Built for signal over noise
          </h2>

          <p className="max-w-3xl leading-relaxed text-zinc-500">
            The AI layer should help members understand stronger points,
            discussion shifts, and key takeaways without encouraging low-value
            engagement or replacing the conversation itself.
          </p>
        </section>
      </div>
    </main>
  );
}
