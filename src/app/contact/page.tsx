import Link from "next/link";
import { ButtonLink, PageHeader, PageShell, Panel } from "@/components/ui";

const supportEmail = "support@loombus.com";

export default function ContactPage() {
  return (
    <PageShell width="lg">
      <Link href="/" className="mb-10 inline-block text-sm text-zinc-500 hover:text-white">
        ← Back to Loombus
      </Link>

      <PageHeader
        eyebrow="Contact"
        title="Contact Loombus"
        description={
          <>
            For account questions, safety concerns, platform feedback, or support
            requests, contact Loombus through the official support email.
          </>
        }
      />

      <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
        <Panel>
          <h2 className="mb-4 text-2xl font-semibold text-white">
            Support email
          </h2>

          <p className="mb-6 leading-relaxed text-zinc-400">
            Contact Loombus at{" "}
            <a
              href={`mailto:${supportEmail}`}
              className="text-zinc-200 underline-offset-4 hover:underline"
            >
              {supportEmail}
            </a>
            . Include your account email, a clear description of the issue, and
            any relevant links or screenshots so the request can be reviewed
            faster.
          </p>

          <a
            href={`mailto:${supportEmail}`}
            className="inline-flex rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200"
          >
            Email {supportEmail}
          </a>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-semibold text-white">
            Helpful links
          </h2>

          <div className="flex flex-col gap-3">
            <ButtonLink href="/safety" variant="secondary">
              Safety
            </ButtonLink>
            <ButtonLink href="/guidelines" variant="secondary">
              Community Guidelines
            </ButtonLink>
            <ButtonLink href="/terms" variant="muted">
              Terms
            </ButtonLink>
            <ButtonLink href="/privacy" variant="muted">
              Privacy Policy
            </ButtonLink>
          </div>
        </Panel>
      </div>
    </PageShell>
  );
}
