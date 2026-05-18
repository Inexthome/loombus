export default function AboutPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-4xl">

        <div className="mb-16">
          <h1 className="text-5xl font-semibold tracking-tight">
            About Loombus
          </h1>

          <p className="mt-6 max-w-3xl text-xl leading-relaxed text-zinc-400">
            Loombus is a signal-first discussion platform designed for thoughtful
            conversations, durable knowledge, and meaningful contribution.
          </p>
        </div>

        <div className="space-y-12">

          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
            <h2 className="mb-4 text-3xl font-semibold">
              Our philosophy
            </h2>

            <p className="leading-relaxed text-zinc-400">
              Most platforms optimize for addiction, outrage, virality, and
              endless engagement loops. Loombus is being built around a different
              idea: that thoughtful discussions and valuable insights should
              outlive trends, algorithms, and noise.
            </p>
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
            <h2 className="mb-6 text-3xl font-semibold">
              What Loombus values
            </h2>

            <div className="space-y-4 text-zinc-400">
              <p>• Thoughtful discussions over reactive posting</p>
              <p>• Signal over virality</p>
              <p>• Long-term knowledge over short-term engagement</p>
              <p>• Credibility and contribution over popularity</p>
              <p>• Discovery through substance, not manipulation</p>
            </div>
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
            <h2 className="mb-6 text-3xl font-semibold">
              What Loombus is not
            </h2>

            <div className="space-y-4 text-zinc-400">
              <p>• Not an outrage engine</p>
              <p>• Not optimized for doom scrolling</p>
              <p>• Not designed around vanity metrics</p>
              <p>• Not focused on algorithmic addiction loops</p>
              <p>• Not intended to reward low-effort noise</p>
            </div>
          </section>

        </div>

      </div>
    </main>
  );
}
