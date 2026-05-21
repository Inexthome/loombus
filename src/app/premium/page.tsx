import Link from "next/link";
import { PremiumPlanCheckoutButton } from "./premium-checkout-button";

const freeFeatures = [
  "Read public discussions",
  "Create discussions",
  "Reply to discussions",
  "Follow people",
  "Basic public profile",
  "Save/bookmark discussions",
  "Basic notifications",
];

const premiumFeatures = [
  "AI discussion summaries",
  "AI key takeaways",
  "Higher monthly AI usage limit",
  "Advanced discussion filters",
  "Saved folders / collections",
  "Personal reading history",
  "Custom profile badge: Premium Member",
  "Early access to new features",
  "Better notification controls",
  "Draft mode for discussions",
  "Extended edit window",
];

const premiumPlusFeatures = [
  "More AI summaries and key takeaways",
  "AI discussion quality check before posting",
  "AI rewrite for clarity before posting",
  "Private notes on saved discussions",
  "Export saved discussions and notes",
  "Longer discussion posts",
  "Priority feature access",
  "Optional creator/supporter profile tools",
];

function FeatureList({ features }: { features: string[] }) {
  return (
    <ul className="space-y-3 text-sm leading-relaxed text-zinc-400">
      {features.map((feature) => (
        <li key={feature} className="flex gap-3">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-500" />
          <span>{feature}</span>
        </li>
      ))}
    </ul>
  );
}

export default function PremiumPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-6xl">
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
        </div>

        <section className="mb-12 grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
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
                className="rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Choose Free
              </Link>

              <Link
                href="/login"
                className="rounded-full border border-zinc-800 px-5 py-3 text-sm text-zinc-500 transition hover:border-zinc-600 hover:text-white"
              >
                Log in
              </Link>
            </div>

            <FeatureList features={freeFeatures} />
          </div>

          <div className="rounded-3xl border border-zinc-600 bg-zinc-950 p-8 shadow-2xl shadow-white/5">
            <p className="mb-3 text-sm uppercase tracking-wide text-zinc-400">
              Premium
            </p>

            <div className="mb-2 flex items-end gap-2">
              <span className="text-5xl font-semibold">$7</span>
              <span className="pb-2 text-zinc-500">/ month</span>
            </div>

            <p className="mb-6 text-sm text-zinc-500">
              Or $70/year. Best starting plan for AI-assisted reading and
              organization.
            </p>

            <div className="mb-8 flex flex-wrap gap-3">
              <PremiumPlanCheckoutButton planKey="premium_monthly">
                Choose Premium Monthly
              </PremiumPlanCheckoutButton>

              <PremiumPlanCheckoutButton
                planKey="premium_annual"
                variant="secondary"
              >
                Choose Premium Annual
              </PremiumPlanCheckoutButton>
            </div>

            <FeatureList features={premiumFeatures} />
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
            <p className="mb-3 text-sm uppercase tracking-wide text-zinc-500">
              Premium Plus
            </p>

            <div className="mb-2 flex items-end gap-2">
              <span className="text-5xl font-semibold">$12</span>
              <span className="pb-2 text-zinc-500">/ month</span>
            </div>

            <p className="mb-6 text-sm text-zinc-500">
              Or $120/year. Built for heavier AI usage and advanced tools.
            </p>

            <div className="mb-8 flex flex-wrap gap-3">
              <PremiumPlanCheckoutButton planKey="premium_plus_monthly">
                Choose Plus Monthly
              </PremiumPlanCheckoutButton>

              <PremiumPlanCheckoutButton
                planKey="premium_plus_annual"
                variant="secondary"
              >
                Choose Plus Annual
              </PremiumPlanCheckoutButton>
            </div>

            <FeatureList features={premiumPlusFeatures} />
          </div>
        </section>

        <section className="mb-12 rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
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
                <span className="text-4xl font-semibold">$3</span>
                <span className="pb-1 text-zinc-500">
                  for 25 additional AI actions
                </span>
              </div>

              <p className="max-w-2xl leading-relaxed text-zinc-400">
                Optional add-on for members who reach their included monthly AI
                limit and want more summaries, takeaways, viewpoint maps, or
                thread-evolution actions without changing subscription tiers.
              </p>

              <p className="mt-4 text-sm text-zinc-600">
                Extra AI Pack checkout will be wired separately because it is a
                one-time add-on, not a subscription plan.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-12 rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
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

        <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
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
