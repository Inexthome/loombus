import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, PageShell, Panel } from "@/components/ui";

export const metadata: Metadata = {
  title: "Download Loombus | Loombus",
  description:
    "Download Loombus and join a signal-first discussion platform built for thoughtful conversations, sharper ideas, and cleaner community dialogue.",
  alternates: {
    canonical: "https://loombus.com/download",
  },
};

export default function DownloadPage() {
  return (
    <PageShell width="lg">
      <Link href="/" className="mb-10 inline-block text-sm text-zinc-500 hover:text-white">
        ← Back to Loombus
      </Link>

      <PageHeader
        eyebrow="Download"
        title="Download Loombus"
        description={
          <>
            Get Loombus on mobile and join a signal-first discussion platform
            built for thoughtful conversations instead of endless scrolling.
          </>
        }
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Panel>
          <h2 className="mb-4 text-2xl font-semibold text-white">
            iPhone
          </h2>

          <p className="leading-relaxed text-zinc-400">
            Loombus is available for iPhone. Open the App Store and search for
            Loombus to download the app.
          </p>

          <Link
            href="/signup"
            className="mt-6 inline-flex rounded-full bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200"
          >
            Create an account
          </Link>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-semibold text-white">
            Android
          </h2>

          <p className="leading-relaxed text-zinc-400">
            Android access is being prepared for Google Play. You can still
            create an account and use Loombus on the web while Android release
            work continues.
          </p>

          <Link
            href="/login"
            className="mt-6 inline-flex rounded-full border border-zinc-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-900"
          >
            Login to Loombus
          </Link>
        </Panel>
      </div>
    </PageShell>
  );
}
