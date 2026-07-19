import type { Metadata } from "next";
import Link from "next/link";
import {
  PublicPolicyPage,
  type PublicPolicySection,
} from "@/components/public-policy-page";

const supportEmail = "support@loombus.com";

export const metadata: Metadata = {
  title: "Cookie Use | Loombus",
  description:
    "How Loombus uses cookies, authentication tokens, local storage, session storage, native application storage, and similar technologies.",
  alternates: {
    canonical: "https://loombus.com/cookies",
  },
};

const sections: PublicPolicySection[] = [
  {
    id: "definition",
    title: "Cookies and Similar Technologies",
    paragraphs: [
      <>
        Cookies are small pieces of information stored by a browser. Similar
        technologies include local storage, session storage, authentication
        tokens, device identifiers, native application storage, cached settings,
        service-worker storage, and related mechanisms used to operate an online
        or mobile service.
      </>,
      <>
        This page uses “cookies” as a convenient term for these technologies even
        when the information is stored through a different browser, app, device, or
        authentication mechanism.
      </>,
    ],
  },
  {
    id: "required",
    title: "Strictly Necessary and Core Service Technologies",
    bullets: [
      <>create, maintain, refresh, and end authenticated sessions;</>,
      <>keep protected account, Room, message, billing, support, and administrative pages limited to authorized users;</>,
      <>complete email, Google, Apple, and other supported sign-in or account-recovery flows;</>,
      <>protect against cross-site request forgery, unauthorized access, fraud, spam, abuse, and security threats;</>,
      <>remember routing, account state, consent state, feature state, and technical information required to deliver the service;</>,
      <>support database, storage, file, notification, and API operations that depend on a valid session.</>,
    ],
    paragraphs: [
      <>
        Blocking required technologies can prevent sign-in, break protected
        features, interrupt uploads, remove saved device state, or make Loombus
        unable to confirm your account permissions.
      </>,
    ],
  },
  {
    id: "preferences",
    title: "Preferences and Interface State",
    bullets: [
      <>appearance choice, including Light, Dark, or System mode;</>,
      <>supported navigation, onboarding, composer, filter, search, and workspace state;</>,
      <>dismissed notices, selected tabs, draft-related state, and device-specific feature preferences;</>,
      <>notification permission prompts, saved-session choices, and local biometric-unlock preference where supported by the native app.</>,
    ],
    paragraphs: [
      <>
        Clearing local storage or application data may reset preferences, sign you
        out, remove locally remembered interface state, or require you to complete
        certain setup steps again.
      </>,
    ],
  },
  {
    id: "search-local",
    title: "Search, Local, and Discovery State",
    paragraphs: [
      <>
        Loombus may temporarily store a search term, filter, category, location
        selection, radius, remote status, event date, pagination state, or recent
        destination to provide consistent navigation and reduce repeated input.
      </>,
      <>
        Stored location-related preferences are not the same as continuous GPS
        tracking. A specific device-location feature would request the applicable
        permission before using device location when required.
      </>,
    ],
  },
  {
    id: "ai",
    title: "AI, Usage Limits, and Cached Feature State",
    paragraphs: [
      <>
        Cookies or similar state may help associate an authenticated request with
        the correct subscription, AI usage allowance, cached output, feature
        bucket, rate limit, or abuse-prevention control.
      </>,
      <>
        The substantive prompts, source content, outputs, and usage records
        connected to AI features are described in the{" "}
        <Link href="/privacy" className="text-zinc-200 underline-offset-4 hover:underline">
          Privacy Policy
        </Link>
        . They are not necessarily stored inside a browser cookie.
      </>,
    ],
  },
  {
    id: "billing",
    title: "Billing, App Stores, and Purchase State",
    paragraphs: [
      <>
        Loombus and its payment or app-store providers may use cookies, tokens,
        transaction identifiers, or application storage to initiate checkout,
        return from a billing flow, restore purchases, confirm entitlement, prevent
        duplicate fulfillment, and manage subscription access.
      </>,
      <>
        Payment providers and app stores use their own technologies under their own
        terms and privacy notices. Loombus generally receives transaction and
        entitlement information rather than a complete card number or bank login.
      </>,
    ],
  },
  {
    id: "notifications",
    title: "Push Notifications and Native Application Storage",
    paragraphs: [
      <>
        The mobile applications may store a push-notification registration token,
        permission state, app version, device platform, saved session, and local
        settings needed to deliver supported notifications and maintain account
        access.
      </>,
      <>
        A push token identifies an application installation for notification
        delivery. It is not a biometric template and is not the same as your
        advertising identifier.
      </>,
    ],
  },
  {
    id: "security",
    title: "Security, Fraud Prevention, and Rate Limiting",
    paragraphs: [
      <>
        Loombus may use cookies, tokens, browser identifiers, network information,
        and server-side logs to recognize suspicious sign-in patterns, enforce rate
        limits, prevent repeated abuse, secure support forms, detect automated
        activity, and protect accounts and infrastructure.
      </>,
      <>
        These controls can change without notice because publishing detailed
        security rules could make them easier to evade.
      </>,
    ],
  },
  {
    id: "diagnostics",
    title: "Diagnostics, Reliability, and Performance",
    paragraphs: [
      <>
        Loombus may use technical identifiers and similar technologies to diagnose
        crashes, failed requests, slow loading, broken routes, notification
        failures, upload problems, session errors, and other reliability issues.
      </>,
      <>
        Diagnostic information may be connected to an account when needed to
        reproduce a problem, investigate abuse, or provide support.
      </>,
    ],
  },
  {
    id: "providers",
    title: "Third-Party Service Providers",
    paragraphs: [
      <>
        Authentication, hosting, database, storage, email, push, payment,
        app-store, mapping, geocoding, security, diagnostics, file-processing, and
        AI providers may set or read their own cookies, tokens, SDK state, or
        similar information while providing services to Loombus.
      </>,
      <>
        Loombus does not control every technology used by an external provider.
        The provider’s own terms and privacy notices govern its independent
        practices.
      </>,
    ],
  },
  {
    id: "advertising",
    title: "Advertising and Cross-Site Tracking",
    paragraphs: [
      <>
        As of the effective date, Loombus does not operate a cross-site behavioral
        advertising network and does not use undisclosed advertising pixels to
        follow members across unrelated websites for targeted advertising.
      </>,
      <>
        Loombus may measure its own service reliability, acquisition, and feature
        use. If Loombus introduces materially different advertising or
        cross-context tracking, the applicable notices and consent controls will be
        updated as required.
      </>,
    ],
  },
  {
    id: "management",
    title: "Managing Cookies and Stored State",
    bullets: [
      <>use browser settings to view, block, or delete cookies and site data;</>,
      <>clear local or session storage through browser or device controls;</>,
      <>manage app storage, notification permissions, and biometric-unlock settings through the device operating system or Loombus settings where supported;</>,
      <>use private browsing for a shorter-lived session, understanding that some protected features may not work as expected;</>,
      <>sign out when using a shared device.</>,
    ],
    paragraphs: [
      <>
        Restricting required technology may cause loss of functionality. Browser
        “Do Not Track” signals are not a substitute for required session and
        security storage and may not have a uniform legal or technical meaning.
      </>,
    ],
  },
  {
    id: "retention",
    title: "Retention of Cookie and Similar Data",
    paragraphs: [
      <>
        Session technologies may expire when a session ends, while persistent
        technologies may remain until their expiration, sign-out, deletion,
        application reset, or manual clearing. Server-side records associated with
        a token or identifier may follow different security, billing, audit, or
        retention schedules.
      </>,
    ],
  },
  {
    id: "related",
    title: "Related Policies",
    paragraphs: [
      <>
        Read this page with the{" "}
        <Link href="/privacy" className="text-zinc-200 underline-offset-4 hover:underline">
          Privacy Policy
        </Link>{" "}
        and{" "}
        <Link href="/terms" className="text-zinc-200 underline-offset-4 hover:underline">
          Terms of Service
        </Link>
        . The Privacy Policy explains the broader categories of information
        Loombus processes and the purposes for that processing.
      </>,
    ],
  },
  {
    id: "contact",
    title: "Cookie Questions",
    paragraphs: [
      <>
        Submit a question through{" "}
        <Link href="/support?category=legal" className="text-zinc-200 underline-offset-4 hover:underline">
          Loombus Support
        </Link>{" "}
        or email{" "}
        <a
          href={`mailto:${supportEmail}?subject=Loombus%20Cookie%20Question`}
          className="text-zinc-200 underline-offset-4 hover:underline"
        >
          {supportEmail}
        </a>
        .
      </>,
    ],
  },
];

export default function CookiesPage() {
  return (
    <PublicPolicyPage
      eyebrow="Legal"
      title="Cookie Use"
      description={
        <>
          This page explains the browser, application, session, security, billing,
          preference, and reliability technologies used to operate Loombus.
        </>
      }
      sections={sections}
      effectiveDate="July 18, 2026"
      reviewedDate="July 18, 2026"
    />
  );
}
