import Link from "next/link";

const supportEmail = "support@loombus.com";

export default function SafetyPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="mb-10 inline-block text-sm text-zinc-500 hover:text-white">
          ← Back to Loombus
        </Link>

        <p className="mb-4 text-sm uppercase tracking-[0.3em] text-zinc-500">
          Safety
        </p>

        <h1 className="mb-6 text-5xl font-semibold tracking-tight">
          Safety on Loombus
        </h1>

        <div className="space-y-5 leading-relaxed text-zinc-400">
          <p>
            Loombus is built around high-signal discussion. Safety tools help
            keep conversations thoughtful, respectful, and useful.
          </p>

          <p>
            Members can report profiles, discussions, and replies that appear to
            violate platform expectations. Reports are reviewed through the
            moderation tools available to Loombus administrators.
          </p>

          <p>
            Members can also block other users. Blocking limits unwanted
            interaction and filters blocked users from key member areas.
          </p>

          <p>
            Loombus may limit or remove access for accounts that abuse the
            platform, harass others, spam, impersonate, or repeatedly disrupt
            conversations.
          </p>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <p className="mb-3 text-sm uppercase tracking-[0.2em] text-zinc-500">
              Safety support
            </p>

            <p className="mb-4 text-zinc-400">
              For urgent safety concerns or moderation questions, contact{" "}
              <a
                href={`mailto:${supportEmail}?subject=Loombus%20Safety%20Concern`}
                className="text-zinc-200 underline-offset-4 hover:underline"
              >
                {supportEmail}
              </a>
              .
            </p>

            <a
              href={`mailto:${supportEmail}?subject=Loombus%20Safety%20Concern`}
              className="inline-flex rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
            >
              Email safety support
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
