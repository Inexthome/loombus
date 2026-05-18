export default function GuidelinesPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-4xl">

        <div className="mb-16">
          <h1 className="text-5xl font-semibold tracking-tight">
            Community Guidelines
          </h1>

          <p className="mt-6 max-w-3xl text-xl leading-relaxed text-zinc-400">
            Loombus is designed for thoughtful, high-signal discussion.
            These guidelines exist to protect clarity, trust, and meaningful participation.
          </p>
        </div>

        <div className="space-y-12">

          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
            <h2 className="mb-4 text-3xl font-semibold">
              Contribute thoughtfully
            </h2>

            <p className="leading-relaxed text-zinc-400">
              Discussions should aim to inform, explore, question, teach,
              analyze, or meaningfully contribute. Low-effort spam,
              manipulative engagement tactics, and intentionally disruptive
              behavior are discouraged.
            </p>
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
            <h2 className="mb-4 text-3xl font-semibold">
              Respect others
            </h2>

            <p className="leading-relaxed text-zinc-400">
              Disagreement is acceptable. Harassment, threats, hate-driven
              conduct, targeted abuse, impersonation, or intimidation are not.
            </p>
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
            <h2 className="mb-4 text-3xl font-semibold">
              Avoid manipulation
            </h2>

            <p className="leading-relaxed text-zinc-400">
              Coordinated manipulation, engagement farming, fake activity,
              automated spam, or attempts to artificially inflate visibility
              undermine the platform’s purpose.
            </p>
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
            <h2 className="mb-4 text-3xl font-semibold">
              Signal over noise
            </h2>

            <p className="leading-relaxed text-zinc-400">
              Loombus prioritizes durable value over short-term attention.
              Users are encouraged to contribute discussions that remain useful,
              insightful, or intellectually valuable over time.
            </p>
          </section>

        </div>

      </div>
    </main>
  );
}
