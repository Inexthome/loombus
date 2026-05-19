import Link from "next/link";
export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="mx-auto flex max-w-5xl flex-col px-6 py-32">
        
        <div className="mb-10">
          <p className="mb-4 text-sm uppercase tracking-[0.3em] text-zinc-500">
            Early Access
          </p>

          <h1 className="max-w-4xl text-6xl font-semibold leading-tight tracking-tight">
            Signal over noise.
          </h1>

          <p className="mt-8 max-w-2xl text-xl leading-relaxed text-zinc-400">
            A high-signal environment for intelligent discourse,
            trusted knowledge, and meaningful contribution
            in the AI era.
          </p>
        </div>

        <div className="mt-10 flex gap-4">
          
          <Link
            href="/signup"
            className="rounded-full bg-white px-6 py-3 text-black transition hover:bg-zinc-200"
          >
            Request Access
          </Link>

          <Link
            href="/discussions"
            className="rounded-full border border-zinc-700 px-6 py-3 text-zinc-300 transition hover:border-zinc-500 hover:text-white"
          >
            Explore Discussions
          </Link>

        </div>

        <div className="mt-32 grid gap-8 md:grid-cols-3">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <h2 className="mb-3 text-lg font-medium">
              Signal Over Noise
            </h2>

            <p className="text-sm leading-relaxed text-zinc-400">
              Designed to prioritize thoughtful contribution
              instead of engagement farming and algorithmic chaos.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <h2 className="mb-3 text-lg font-medium">
              Trusted Discourse
            </h2>

            <p className="text-sm leading-relaxed text-zinc-400">
              Build meaningful discussions around credibility,
              context, and intellectual depth.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <h2 className="mb-3 text-lg font-medium">
              AI-Assisted Intelligence
            </h2>

            <p className="text-sm leading-relaxed text-zinc-400">
              AI organizes and summarizes information without
              replacing human thought.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}