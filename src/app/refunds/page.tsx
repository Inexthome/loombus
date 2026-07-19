import type { Metadata } from "next";
import Link from "next/link";
import {
  PublicPolicyPage,
  type PublicPolicySection,
} from "@/components/public-policy-page";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supportEmail = "support@loombus.com";

export const metadata: Metadata = {
  title: "Refund Policy | Loombus",
  description:
    "Cancellation, renewal, refund, app-store, Extra AI Pack, billing-dispute, and user-to-user transaction guidance for Loombus.",
  alternates: {
    canonical: "https://loombus.com/refunds",
  },
};

const sections: PublicPolicySection[] = [
  {
    id: "scope",
    title: "Scope of This Policy",
    paragraphs: [
      <>
        This Refund Policy applies to subscription and add-on purchases that
        Loombus or an authorized app store bills for access to Loombus features.
        It does not automatically apply to a marketplace sale, service payment,
        event fee, job-related arrangement, appointment payment, deposit, or other
        user-to-user transaction.
      </>,
      <>
        The price, billing interval, renewal terms, included features, limits, and
        purchase channel shown at checkout form part of the applicable purchase.
      </>,
    ],
  },
  {
    id: "channels",
    title: "Purchase Channel Controls Billing",
    paragraphs: [
      <>
        A web purchase may be processed through Loombus’s web payment provider. An
        iOS purchase may be processed by Apple through the App Store. The provider
        that billed the purchase generally controls the payment method,
        transaction record, cancellation interface, refund request, and applicable
        store rules.
      </>,
      <>
        Loombus cannot directly issue a refund through a provider when that
        provider requires the account holder to use its own refund process. Support
        may help identify the purchase channel or explain the next step but cannot
        guarantee a provider’s decision.
      </>,
    ],
  },
  {
    id: "subscriptions",
    title: "Subscriptions and Automatic Renewal",
    paragraphs: [
      <>
        A paid plan may renew automatically until cancelled. Review the plan,
        price, billing interval, renewal date, features, usage limits, and
        cancellation terms before completing a purchase.
      </>,
      <>
        Plan benefits can include Premium, Premium Plus, expanded AI use, longer
        or more frequent Video Context, creator or supporter tools, Room-related
        capabilities, or other features described in the purchase flow. Features
        and limits can change as permitted by the Terms and applicable law.
      </>,
    ],
  },
  {
    id: "cancellation",
    title: "Cancellation",
    paragraphs: [
      <>
        Cancel through the billing channel that processed the purchase or through
        the supported Loombus billing tools. Cancellation generally stops a future
        renewal after the cancellation is processed.
      </>,
      <>
        Unless the checkout, provider rules, or applicable law states otherwise,
        cancellation does not automatically reverse a charge already processed or
        provide a prorated refund for the current billing period.
      </>,
      <>
        Paid access may continue until the end of the current period. It may end
        earlier if required by a refund, failed payment, chargeback, app-store
        status, fraud prevention, policy enforcement, account termination, or
        service discontinuation.
      </>,
    ],
  },
  {
    id: "web",
    title: "Web-Billed Purchases",
    paragraphs: [
      <>
        For an eligible web-billed purchase, use the available billing portal or
        contact Loombus Support. Include the account email, charge date, amount,
        invoice or transaction reference, plan, and a concise explanation.
      </>,
      <>
        A refund may be considered for duplicate billing, an obvious processing
        error, verified unauthorized account activity, a failed entitlement
        fulfillment, or another exceptional circumstance. Approval is not
        guaranteed unless required by law.
      </>,
    ],
  },
  {
    id: "apple",
    title: "Apple App Store Purchases",
    paragraphs: [
      <>
        Apple controls billing and refund decisions for purchases charged through
        the Apple App Store. The account holder generally must request an eligible
        refund through Apple’s purchase-support process and manage the subscription
        through Apple account settings.
      </>,
      <>
        Loombus may review entitlement or fulfillment records and may help explain
        whether an account received access. Loombus cannot promise that Apple will
        approve a refund or override Apple’s billing decision.
      </>,
    ],
  },
  {
    id: "refunds",
    title: "General Refund Standard",
    paragraphs: [
      <>
        Unless required by law, promised at checkout, or approved as an exception,
        charges are non-refundable after a billing period begins or an add-on is
        delivered.
      </>,
    ],
    bullets: [
      <>partial or unused billing periods;</>,
      <>member inactivity or failure to use included features;</>,
      <>reaching an AI, Video Context, storage, Room, or other plan limit;</>,
      <>dissatisfaction with an AI output, search result, match, ranking, summary, or feature result;</>,
      <>changes to a feature or limit permitted by the Terms;</>,
      <>moderation, listing removal, Room restriction, account suspension, or termination for a policy or safety reason;</>,
      <>loss caused by a user-to-user transaction or third-party service;</>,
      <>forgetting to cancel before renewal, except where law or provider rules require a different result.</>,
    ],
  },
  {
    id: "extra-ai",
    title: "Extra AI Packs and One-Time Add-Ons",
    paragraphs: [
      <>
        Extra AI Packs or other one-time add-ons may become non-refundable once
        credits, usage rights, or entitlements are delivered, consumed, partially
        consumed, expired under disclosed terms, or connected to account activity.
      </>,
      <>
        If a verified payment succeeded but the purchased entitlement was not
        delivered, Loombus may correct the balance, restore access, or review a
        refund depending on the purchase channel and circumstances.
      </>,
    ],
  },
  {
    id: "technical",
    title: "Technical Problems",
    paragraphs: [
      <>
        A temporary outage, model error, failed notification, device issue,
        unsupported browser, third-party interruption, or isolated feature problem
        does not automatically create a refund right. Contact Support promptly so
        the issue can be documented and an available workaround or correction can
        be evaluated.
      </>,
      <>
        Where a paid feature was materially unavailable for an extended period,
        Loombus may provide an account adjustment, extension, restored entitlement,
        or refund when appropriate and technically possible. This is determined
        case by case unless applicable law requires otherwise.
      </>,
    ],
  },
  {
    id: "fraud",
    title: "Unauthorized Activity and Fraud",
    paragraphs: [
      <>
        Report suspected unauthorized purchases promptly and secure the Loombus
        account, connected email, identity-provider account, device, and payment
        method. Loombus may require identity and transaction verification before
        changing access or providing records.
      </>,
      <>
        Loombus may deny or reverse credits, restrict access, or preserve records
        where it reasonably suspects fraud, account sharing, refund abuse,
        chargeback abuse, stolen payment information, or entitlement manipulation.
      </>,
    ],
  },
  {
    id: "chargebacks",
    title: "Chargebacks and Payment Disputes",
    paragraphs: [
      <>
        Before initiating a chargeback, contact Support when the issue may be a
        duplicate charge, cancellation error, missing entitlement, or account
        problem. This does not limit rights provided by law.
      </>,
      <>
        If a charge is disputed, Loombus or the billing provider may submit account,
        checkout, subscription, invoice, entitlement, usage, support, device,
        fraud, and cancellation records relevant to the dispute. Paid access may be
        restricted while the payment status is unresolved.
      </>,
    ],
  },
  {
    id: "enforcement",
    title: "Policy Enforcement and Refunds",
    paragraphs: [
      <>
        A policy violation, fraud concern, safety restriction, Room enforcement,
        listing removal, or account termination does not automatically create a
        refund right. Paid status does not exempt a user from the Terms,
        Guidelines, Safety rules, or platform protections.
      </>,
    ],
  },
  {
    id: "user-transactions",
    title: "Marketplace, Services, Events, Jobs, and Appointments",
    paragraphs: [
      <>
        Unless a specific checkout expressly states that Loombus billed the
        transaction, payments or promised refunds between users are governed by
        their agreement, the payment method they selected, and applicable law.
        They are not Loombus subscription charges.
      </>,
      <>
        Loombus does not guarantee refunds for an item, service, deposit, event,
        ticket, job-related expense, appointment, or other user-to-user arrangement
        and may not have the ability to reverse the payment.
      </>,
    ],
  },
  {
    id: "request",
    title: "How to Request Billing Help",
    paragraphs: [
      <>
        Loombus is operated by <strong>Loombus LLC</strong>, a Florida limited
        liability company.
      </>,
      <>
        Formal correspondence may be mailed to:
        <br />
        Loombus LLC
        <br />
        2640 Blanding Blvd, Ste 201-167
        <br />
        Middleburg, FL 32068
        <br />
        United States
      </>,
      <>
        Submit a billing request through{" "}
        <Link href="/support?category=billing" className="text-zinc-200 underline-offset-4 hover:underline">
          Loombus Support
        </Link>{" "}
        or email{" "}
        <a
          href={`mailto:${supportEmail}?subject=Loombus%20Billing%20or%20Refund%20Question`}
          className="text-zinc-200 underline-offset-4 hover:underline"
        >
          {supportEmail}
        </a>
        .
      </>,
    ],
    bullets: [
      <>the email associated with the Loombus account;</>,
      <>the purchase channel, if known;</>,
      <>plan or product purchased;</>,
      <>charge date and amount;</>,
      <>invoice, receipt, order, or transaction reference;</>,
      <>whether the purchase appears in web billing or app-store purchase history;</>,
      <>what resolution you are requesting and why.</>,
    ],
  },
];

export default function RefundsPage() {
  return (
    <PublicPolicyPage
      eyebrow="Legal"
      title="Refund Policy"
      description={
        <>
          This Policy explains subscription cancellation, purchase-channel rules,
          refund review, Extra AI Packs, billing disputes, and the boundary between
          Loombus charges and user-to-user transactions.
        </>
      }
      sections={sections}
      effectiveDate="July 18, 2026"
      reviewedDate="July 19, 2026"
    />
  );
}
