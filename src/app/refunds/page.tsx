import Link from "next/link";
import { LegalReviewNotice, PageHeader, PageShell, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supportEmail = "support@loombus.com";

export default function RefundsPage() {
  return (
    <PageShell width="lg">
      <Link href="/" className="mb-10 inline-block text-sm text-zinc-500 hover:text-white">
        ← Back to Loombus
      </Link>

      <PageHeader
        eyebrow="Legal"
        title="Refund Policy"
        description={
          <>
            This page explains draft refund, cancellation, subscription, and
            Extra AI Pack rules for Loombus paid features.
          </>
        }
      />

      <LegalReviewNotice label="Refund Policy" />

      <div className="space-y-8 leading-relaxed text-zinc-400">
        <Panel>
          <h2 className="mb-4 text-2xl font-semibold text-white">
            1. Current Payment Status
          </h2>

          <p>
            Loombus Premium checkout may operate in test mode before live Stripe
            payments are enabled. Test-mode transactions are not live customer
            charges. Before live payments are accepted, Loombus should confirm
            pricing, refund rules, business identity, payment processor settings,
            tax handling, and attorney-reviewed terms.
          </p>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-semibold text-white">
            2. Subscriptions
          </h2>

          <p>
            Paid Loombus subscriptions may renew automatically according to the
            plan selected at checkout. Users are responsible for reviewing the
            plan, price, billing interval, features, limits, and renewal terms
            before subscribing.
          </p>

          <p className="mt-4">
            When Stripe Billing Portal is available, subscription management,
            payment-method updates, invoice review, and cancellation may be
            handled through the secure billing portal.
          </p>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-semibold text-white">
            3. Cancellation
          </h2>

          <p>
            You may cancel a subscription through the available billing tools or
            by contacting support. Cancellation stops future renewals after the
            cancellation is processed. Unless otherwise stated at checkout or
            required by law, cancellation does not automatically refund charges
            already processed for the current billing period.
          </p>

          <p className="mt-4">
            Access to paid features may continue until the end of the paid
            billing period, or may end earlier if required by payment status,
            fraud prevention, abuse prevention, policy enforcement, or platform
            integrity needs.
          </p>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-semibold text-white">
            4. Refunds
          </h2>

          <p>
            Unless required by law or clearly stated in writing, Loombus does
            not guarantee refunds for subscription periods already started,
            partially used billing periods, unused Premium features, AI usage
            limits, member inactivity, moderation actions, account restrictions,
            or dissatisfaction with AI-assisted outputs.
          </p>

          <p className="mt-4">
            Loombus may review refund requests case by case for duplicate
            charges, obvious billing errors, unauthorized account activity,
            technical checkout problems, or other exceptional circumstances.
            Approval is not guaranteed.
          </p>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-semibold text-white">
            5. Extra AI Packs
          </h2>

          <p>
            Extra AI Packs are intended as one-time add-ons for additional
            AI-assisted actions. Unless otherwise stated at checkout or required
            by law, Extra AI Packs may be non-refundable after credits are
            delivered, consumed, partially consumed, or connected to account
            activity.
          </p>

          <p className="mt-4">
            If an Extra AI Pack is not delivered because of a verified payment
            or fulfillment error, Loombus may correct the credit balance or
            review a refund request.
          </p>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-semibold text-white">
            6. Policy Violations and Account Enforcement
          </h2>

          <p>
            Loombus may restrict, suspend, terminate, or refuse paid-feature
            access if an account violates the Terms, Community Guidelines,
            Safety rules, payment rules, fraud-prevention rules, or platform
            protections. Unless required by law, enforcement action does not
            automatically create a refund right.
          </p>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-semibold text-white">
            7. Chargebacks and Payment Disputes
          </h2>

          <p>
            If you dispute a charge through your payment provider, card issuer,
            bank, or Stripe, Loombus may respond with account, subscription,
            checkout, usage, invoice, support, and platform records. Loombus may
            also restrict account access while payment status is unresolved, if
            necessary to prevent fraud, abuse, or billing risk.
          </p>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-semibold text-white">
            8. Requesting Help
          </h2>

          <p>
            Billing or refund questions may be sent to{" "}
            <a
              href={`mailto:${supportEmail}?subject=Loombus%20Billing%20or%20Refund%20Question`}
              className="text-zinc-200 underline-offset-4 hover:underline"
            >
              {supportEmail}
            </a>
            . Include your account email, invoice or checkout reference if
            available, the date of the charge, and a short explanation.
          </p>

          <p className="mt-4 text-sm text-zinc-600">
            Effective date: May 28, 2026
          </p>
        </Panel>
      </div>
    </PageShell>
  );
}
