import Link from "next/link";

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="mb-10 inline-block text-sm text-zinc-500 hover:text-white">
          ← Back to Loombus
        </Link>

        <p className="mb-4 text-sm uppercase tracking-[0.3em] text-zinc-500">
          Contact
        </p>

        <h1 className="mb-6 text-5xl font-semibold tracking-tight">
          Contact Loombus
        </h1>

        <div className="space-y-5 leading-relaxed text-zinc-400">
          <p>
            For account questions, safety concerns, platform feedback, or support
            requests, contact Loombus through the official support channel once
            it is published.
          </p>

          <p>
            This page is a starter contact page and should be updated with the
            final support email or contact form before broad public launch.
          </p>
        </div>
      </div>
    </main>
  );
}
