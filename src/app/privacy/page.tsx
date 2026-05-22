import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="mb-10 inline-block text-sm text-zinc-500 hover:text-white">
          ← Back to Loombus
        </Link>

        <p className="mb-4 text-sm uppercase tracking-[0.3em] text-zinc-500">
          Legal
        </p>

        <h1 className="mb-6 text-5xl font-semibold tracking-tight">
          Privacy Policy
        </h1>

        <div className="space-y-5 leading-relaxed text-zinc-400">
          <p>
            This Privacy Policy is a starter policy page for Loombus. It
            explains, at a high level, how account and platform information may
            be handled.
          </p>

          <p>
            Loombus may collect account information such as email address,
            profile details, saved items, follows, replies, discussions,
            notifications, and subscription status when those features are used.
          </p>

          <p>
            Loombus uses this information to operate the platform, secure user
            accounts, personalize account features, provide member tools, process
            subscriptions, and improve reliability.
          </p>

          <p>
            Loombus does not display private account information publicly unless
            the user chooses to add it to public-facing profile or discussion
            areas.
          </p>

          <p className="text-zinc-600">
            This page should be reviewed and finalized before broad public
            launch.
          </p>
        </div>
      </div>
    </main>
  );
}
