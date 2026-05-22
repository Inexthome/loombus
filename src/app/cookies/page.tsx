import Link from "next/link";

export default function CookiesPage() {
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
          Cookie Use
        </h1>

        <div className="space-y-5 leading-relaxed text-zinc-400">
          <p>
            This Cookie Use page is a starter policy page for Loombus. It
            explains how cookies or similar browser storage may be used.
          </p>

          <p>
            Loombus may use cookies or local browser storage to keep users signed
            in, maintain secure sessions, remember account state, and support
            core platform functionality.
          </p>

          <p>
            Some third-party services used for authentication, hosting, payments,
            analytics, security, or platform operations may also use cookies or
            similar technologies according to their own policies.
          </p>

          <p>
            Users can manage cookies through their browser settings, but blocking
            required cookies may affect login, account access, and platform
            functionality.
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
