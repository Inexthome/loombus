import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, PageShell, Panel } from "@/components/ui";

const supportEmail = "support@loombus.com";

export const metadata: Metadata = {
  title: "Cookie Use | Loombus",
  description:
    "Learn how Loombus uses cookies, browser storage, session tokens, and similar technologies for authentication, security, reliability, and platform features.",
  alternates: {
    canonical: "https://loombus.com/cookies",
  },
};

export default function CookiesPage() {
  return (
    <PageShell width="lg">
      <PageHeader
        eyebrow="Legal"
        title="Cookie Use"
        description={
          <>
            This page explains how Loombus uses cookies, browser storage, session
            tokens, and similar technologies to operate the platform, maintain
            account access, protect users, and improve reliability.
          </>
        }
      />

      <div className="space-y-5 leading-relaxed">
        <Panel>
          <h2 className="mb-4 text-2xl font-semibold">1. Cookies and similar technologies</h2>
          <p>
            Cookies are small files or pieces of information stored on a device or
            browser. Similar technologies include local storage, session storage,
            authentication tokens, browser identifiers, and related tools that help
            a service remember information or operate securely.
          </p>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-semibold">2. How Loombus uses them</h2>
          <p>Loombus may use cookies and similar technologies to:</p>
          <ul className="mt-4 list-disc space-y-2 pl-6">
            <li>keep members signed in and maintain secure account sessions;</li>
            <li>support email, Google, and other available authentication methods;</li>
            <li>remember supported interface choices such as appearance;</li>
            <li>protect against fraud, abuse, spam, and unauthorized access;</li>
            <li>provide account, Premium, Labs, saved-library, Rooms, and AI usage features;</li>
            <li>operate reporting, moderation, support, and safety controls;</li>
            <li>diagnose errors, measure reliability, and improve platform performance;</li>
            <li>support required behavior across browsers and devices.</li>
          </ul>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-semibold">3. Required technologies</h2>
          <p>
            Some cookies, tokens, or browser-storage entries are required for
            Loombus to work. These may support login, authentication, routing,
            account access, security, abuse prevention, and protected member
            features.
          </p>
          <p className="mt-4">
            Blocking required technologies may prevent Loombus from keeping you
            signed in, verifying your account, loading protected pages, remembering
            appearance settings, or providing account-based and paid features.
          </p>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-semibold">4. Authentication and sessions</h2>
          <p>
            Loombus uses authentication services to manage account sessions. These
            services may store tokens, session identifiers, or related browser data
            so members can sign in, remain signed in, and access protected features.
          </p>
          <p className="mt-4">
            A third-party sign-in provider may also use cookies or similar
            technologies according to its own terms and privacy practices.
          </p>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-semibold">5. Service providers</h2>
          <p>
            Loombus relies on service providers for functions such as hosting,
            authentication, database storage, payments, email, security,
            diagnostics, AI-assisted features, and infrastructure. Those providers
            may use cookies or similar technologies as part of the services they
            supply.
          </p>
          <p className="mt-4">
            Their technologies are governed by their own terms and policies.
            Loombus does not control every browser-storage practice of an external
            provider.
          </p>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-semibold">6. Diagnostics and reliability</h2>
          <p>
            Loombus may use logs, identifiers, cookies, or similar technologies to
            detect errors, diagnose loading problems, prevent abuse, understand
            platform performance, and improve reliability.
          </p>
          <p className="mt-4">
            This page does not authorize undisclosed advertising pixels,
            cross-site behavioral tracking, or materially different tracking
            practices. If Loombus introduces those practices, the applicable
            notices and policies should be updated before or when they are used.
          </p>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-semibold">7. Managing browser storage</h2>
          <p>
            Most browsers allow you to block, delete, or limit cookies and browser
            storage. These choices may affect how Loombus works. Clearing storage
            can sign you out and remove device-specific settings.
          </p>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-semibold">8. Related policies</h2>
          <p>
            Read this page together with the{" "}
            <Link href="/privacy" className="underline underline-offset-4">
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link href="/terms" className="underline underline-offset-4">
              Terms of Service
            </Link>
            . The Privacy Policy explains more broadly how information connected to
            Loombus may be collected, used, stored, disclosed, and protected.
          </p>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-semibold">9. Updates</h2>
          <p>
            Loombus may update this Cookie Use page as the platform, service
            providers, or legal requirements change. The current version applies
            when posted or otherwise communicated.
          </p>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-semibold">10. Contact</h2>
          <p>
            Cookie or privacy questions may be sent through{" "}
            <Link href="/support?category=legal" className="underline underline-offset-4">
              Loombus Support
            </Link>{" "}
            or by email to{" "}
            <a
              href={`mailto:${supportEmail}?subject=Loombus%20Cookie%20Question`}
              className="underline underline-offset-4"
            >
              {supportEmail}
            </a>
            .
          </p>
          <p className="mt-4 text-sm">Effective date: May 22, 2026</p>
        </Panel>
      </div>
    </PageShell>
  );
}
