import Link from "next/link";
import { PageHeader, PageShell, Panel } from "@/components/ui";

const supportEmail = "support@loombus.com";

export default function AccessibilityPage() {
  return (
    <PageShell width="lg">
      <Link href="/" className="mb-10 inline-block text-sm text-zinc-500 hover:text-white">
        ← Back to Loombus
      </Link>

      <PageHeader
        eyebrow="Accessibility"
        title="Accessibility"
        description={
          <>
            Loombus aims to provide a clear, readable, and usable experience for
            members across devices.
          </>
        }
      />

      <div className="space-y-8">
        <Panel>
          <h2 className="mb-4 text-2xl font-semibold text-white">
            Our approach
          </h2>

          <p className="leading-relaxed text-zinc-400">
            The platform uses structured pages, readable contrast, keyboard-aware
            forms where practical, and descriptive navigation patterns to support
            broader access.
          </p>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-semibold text-white">
            Ongoing improvement
          </h2>

          <p className="leading-relaxed text-zinc-400">
            Accessibility will continue improving as the platform grows. Users
            who experience barriers using Loombus should contact support so the
            issue can be reviewed.
          </p>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-semibold text-white">
            Accessibility support
          </h2>

          <p className="mb-5 leading-relaxed text-zinc-400">
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
        </Panel>
      </div>
    </PageShell>
  );
}
