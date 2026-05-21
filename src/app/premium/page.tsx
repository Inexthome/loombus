import Link from "next/link";

const premiumFeatures = [
  {
    title: "AI Thread Summaries",
    description:
      "Quickly understand long discussions with concise AI-assisted summaries.",
  },
  {
    title: "High-Signal Takeaways",
    description:
      "Extract the strongest points, important claims, and useful insights from a thread.",
  },
  {
    title: "Thread Evolution",
    description:
      "See what changed as the conversation developed and where the discussion moved.",
  },
  {
    title: "Viewpoint Mapping",
    description:
      "Map disagreement, assumptions, unresolved questions, and areas of agreement without declaring winners.",
  },
];

export default function PremiumPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 max-w-3xl">
          <p className="mb-3 text-sm uppercase tracking-[0.3em] text-zinc-500">
            Loombus Premium
          </p>

          <h1 className="text-5xl font-semibold tracking-tight md:text-6xl">
            Premium AI-Assisted Layer
          </h1>

          <p className="mt-5 text-lg leading-relaxed text-zinc-400">
            Premium gives members AI tools designed to reduce noise, clarify
            long discussions, and surface stronger signal without replacing
            human conversation.
          </p>
        </div>

        <section className="mb-12 grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
            <p className="mb-3 text-sm uppercase tracking-wide text-zinc-500">
              Early Premium Plan
            </p>

            <div className="mb-5 flex items-end gap-2">
              <span className="text-5xl font-semibold">$9</span>
              <span className="pb-2 text-zinc-500">/ month</span>
            </div>

            <p className="mb-6 leading-relaxed text-zinc-400">
              Suggested founder-stage pricing for the AI-Assisted Layer. Stripe
              checkout will be connected next after billing keys and webhook
              handling are configured.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="rounded-full border border-zinc-600 px-5 py-3 text-sm text-zinc-200 transition hover:border-zinc-400 hover:text-white"
              >
                Create an account
              </Link>

              <Link
                href="/login"
                className="rounded-full border border-zinc-800 px-5 py-3 text-sm text-zinc-400 transition hover:border-zinc-600 hover:text-white"
              >
                Log in
              </Link>
            </div>

            <p className="mt-5 text-sm text-zinc-600">
              Live checkout is not enabled yet. This page prepares the Premium
              subscription surface before Stripe is wired in.
            </p>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
            <p className="mb-3 text-sm uppercase tracking-wide text-zinc-500">
              Included usage
            </p>

            <ul className="space-y-4 text-zinc-400">
              <li>50 AI discussion actions per month during the initial Premium plan.</li>
              <li>Cached AI outputs do not count against monthly generated usage.</li>
              <li>Admin-visible diagnostics for failed AI provider calls.</li>
              <li>Premium/Admin gated access to discussion AI tools.</li>
            </ul>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          {premiumFeatures.map((feature) => (
            <div
              key={feature.title}
              className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6"
            >
              <h2 className="mb-3 text-2xl font-medium">
                {feature.title}
              </h2>

              <p className="leading-relaxed text-zinc-500">
                {feature.description}
              </p>
            </div>
          ))}
        </section>

        <div className="mt-12 rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
          <h2 className="mb-3 text-2xl font-medium">
            Built for signal over noise
          </h2>

          <p className="max-w-3xl leading-relaxed text-zinc-500">
            Loombus Premium should support better reading, better reasoning, and
            better participation. The AI layer is designed to assist members,
            not replace the discussion itself.
          </p>
        </div>
      </div>
    </main>
  );
}
