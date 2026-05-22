import Link from "next/link";

export default function TermsPage() {
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
          Terms of Service
        </h1>

        <div className="space-y-5 leading-relaxed text-zinc-400">
          <p>
            These Terms of Service are a starter policy page for Loombus. They
            describe the basic expectations for using the platform while the
            final public launch policies are prepared.
          </p>

          <p>
            By using Loombus, members agree to use the platform lawfully,
            respect other users, avoid abuse or harassment, and follow community
            rules shown on the site.
          </p>

          <p>
            Loombus may remove content, limit access, or suspend accounts that
            violate platform rules, threaten safety, misuse the service, or
            interfere with the experience of other members.
          </p>

          <p>
            Paid features, if active on an account, are governed by the plan
            details shown at purchase and any billing terms presented during
            checkout.
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
