import Link from "next/link";

const supportEmail = "support@loombus.com";

export default function AccessibilityPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="mb-10 inline-block text-sm text-zinc-500 hover:text-white">
          ← Back to Loombus
        </Link>

        <p className="mb-4 text-sm uppercase tracking-[0.3em] text-zinc-500">
          Accessibility
        </p>

        <h1 className="mb-6 text-5xl font-semibold tracking-tight">
          Accessibility
        </h1>

        <div className="space-y-5 leading-relaxed text-zinc-400">
          <p>
            Loombus aims to provide a clear, readable, and usable experience for
            members across devices.
          </p>

          <p>
            The platform uses structured pages, readable contrast, keyboard-aware
            forms where practical, and descriptive navigation patterns to support
            broader access.
          </p>

          <p>
            Accessibility will continue improving as the platform grows. Users
            who experience barriers using Loombus should contact support so the
            issue can be reviewed.
          </p>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <p className="mb-3 text-sm uppercase tracking-[0.2em] text-zinc-500">
              Accessibility support
            </p>

            <p className="mb-4 text-zinc-400">
              To report an accessibility barrier, email{" "}
              <a
                href={`mailto:${supportEmail}?subject=Loombus%20Accessibility%20Issue`}
                className="text-zinc-200 underline-offset-4 hover:underline"
              >
                {supportEmail}
              </a>
              .
            </p>

            <a
              href={`mailto:${supportEmail}?subject=Loombus%20Accessibility%20Issue`}
              className="inline-flex rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
            >
              Email accessibility support
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
