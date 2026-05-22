import Link from "next/link";

const supportEmail = "support@loombus.com";

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
            requests, contact Loombus at{" "}
            <a
              href={`mailto:${supportEmail}`}
              className="text-zinc-200 underline-offset-4 hover:underline"
            >
              {supportEmail}
            </a>
            .
          </p>

          <p>
            Include your account email, a clear description of the issue, and any
            relevant links or screenshots so the request can be reviewed faster.
          </p>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <p className="mb-3 text-sm uppercase tracking-[0.2em] text-zinc-500">
              Support email
            </p>

            <a
              href={`mailto:${supportEmail}`}
              className="inline-flex rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200"
            >
              Email {supportEmail}
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
