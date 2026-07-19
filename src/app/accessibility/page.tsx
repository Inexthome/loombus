import type { Metadata } from "next";
import Link from "next/link";
import {
  PublicPolicyPage,
  type PublicPolicySection,
} from "@/components/public-policy-page";

const supportEmail = "support@loombus.com";

export const metadata: Metadata = {
  title: "Accessibility | Loombus",
  description:
    "Loombus accessibility approach for keyboard, screen-reader, zoom, contrast, themes, motion, forms, media, files, mobile applications, and support.",
  alternates: {
    canonical: "https://loombus.com/accessibility",
  },
};

const sections: PublicPolicySection[] = [
  {
    id: "commitment",
    title: "Accessibility Commitment",
    paragraphs: [
      <>
        Loombus aims to make its knowledge, community, communication, discovery,
        commerce, and support features usable by people with a broad range of
        visual, auditory, physical, speech, cognitive, neurological, and
        situational access needs.
      </>,
      <>
        Accessibility is an ongoing engineering and content responsibility, not a
        one-time certification. Loombus is continuing to evaluate new and existing
        features as the platform expands.
      </>,
    ],
  },
  {
    id: "standard",
    title: "Accessibility Standard and Goal",
    paragraphs: [
      <>
        Loombus uses the Web Content Accessibility Guidelines, WCAG 2.2 Level AA,
        as a reference target for web accessibility work where applicable. This is
        a development goal and does not claim that every page, state, native
        component, user upload, PDF, or third-party service currently conforms.
      </>,
      <>
        Native iOS and Android experiences are also evaluated against the
        accessibility capabilities and guidance provided by their operating
        systems.
      </>,
    ],
  },
  {
    id: "structure",
    title: "Page Structure and Navigation",
    bullets: [
      <>meaningful headings and logical content order;</>,
      <>descriptive page titles, links, buttons, labels, and navigation landmarks;</>,
      <>consistent routes and recognizable interaction patterns where practical;</>,
      <>skip, focus, or landmark behavior that helps users reach primary content;</>,
      <>avoiding reliance on color, location, or icon shape as the only way to communicate meaning.</>,
    ],
  },
  {
    id: "keyboard",
    title: "Keyboard and Focus Access",
    bullets: [
      <>interactive controls should be reachable and operable without a pointing device;</>,
      <>focus should remain visible and move in a logical order;</>,
      <>dialogs, menus, search overlays, dropdowns, composer tools, and forms should manage focus predictably;</>,
      <>keyboard users should be able to dismiss supported overlays and avoid focus traps;</>,
      <>timing or hover-only interactions should have an accessible alternative where practical.</>,
    ],
    paragraphs: [
      <>
        Report any control that cannot be reached, activated, exited, or understood
        using a keyboard or comparable assistive input.
      </>,
    ],
  },
  {
    id: "screen-readers",
    title: "Screen Readers, Names, and Semantics",
    bullets: [
      <>form inputs should have programmatically associated names and instructions;</>,
      <>icons that convey no additional meaning should be hidden from assistive technology;</>,
      <>status, validation, loading, error, notification, and success messages should be announced appropriately where practical;</>,
      <>tables, lists, headings, regions, buttons, and links should use meaningful semantics;</>,
      <>dynamic experiences should preserve context when content updates.</>,
    ],
  },
  {
    id: "visual",
    title: "Contrast, Color, Themes, and Readability",
    paragraphs: [
      <>
        Loombus supports Light, Dark, and System appearance modes. The platform
        aims to maintain readable text, controls, borders, selected states, error
        states, and focus indicators across supported themes.
      </>,
      <>
        Text should not require color alone to understand status. Members who find
        a contrast, theme, font, spacing, or selected-state issue should report the
        exact page, theme, device, and control.
      </>,
    ],
  },
  {
    id: "zoom-reflow",
    title: "Zoom, Reflow, Text Size, and Orientation",
    bullets: [
      <>web content should remain usable at supported browser zoom and text enlargement levels;</>,
      <>mobile layouts should reflow without requiring unnecessary horizontal scrolling for ordinary reading;</>,
      <>controls should remain large enough to identify and activate where practical;</>,
      <>content should not be unnecessarily locked to one device orientation;</>,
      <>important information should not disappear solely because the viewport is narrow or text is enlarged.</>,
    ],
  },
  {
    id: "motion",
    title: "Motion, Animation, and Time",
    paragraphs: [
      <>
        Loombus aims to avoid unnecessary flashing and to respect reduced-motion
        preferences where supported. Autoplay is not used for Video Context.
      </>,
      <>
        Features that update, dismiss, expire, or move should provide enough time
        and control for users where the product purpose allows. Report animation,
        motion, or timing that causes disorientation or prevents completion.
      </>,
    ],
  },
  {
    id: "forms",
    title: "Forms, Errors, and Authentication",
    bullets: [
      <>required fields, formats, and constraints should be explained clearly;</>,
      <>errors should identify the affected field and provide a usable correction path;</>,
      <>authentication and recovery instructions should not rely on memory or inaccessible puzzles where avoidable;</>,
      <>support, reporting, listing, Room, appointment, event, job, service, request, and marketplace forms should preserve understandable labels and states;</>,
      <>password, verification, and billing flows may include third-party interfaces with separate accessibility behavior.</>,
    ],
  },
  {
    id: "search-ai",
    title: "Search and AI-Assisted Features",
    paragraphs: [
      <>
        Search results, filters, source links, loading states, result counts, no
        result states, and permission boundaries should be understandable through
        keyboard and assistive technology.
      </>,
      <>
        Ask Loombus AI answers should identify source links where provided and
        should not require a user to rely on visual layout alone to understand the
        answer. AI output may still be inaccurate and does not replace accessible
        access to the original source.
      </>,
    ],
  },
  {
    id: "media",
    title: "Images, Video Context, Audio, and User Media",
    paragraphs: [
      <>
        Loombus provides fields or product patterns for accessible description
        where supported, but much of the platform’s media is uploaded by users.
        The member or organization publishing media is responsible for providing
        accurate captions, transcripts, alt text, descriptions, or equivalent
        access when needed and available.
      </>,
      <>
        Video Context does not autoplay and does not display a public view count.
        Captions, audio description, transcription, and player accessibility may
        vary by media, device, browser, operating system, and implementation.
      </>,
    ],
  },
  {
    id: "files",
    title: "PDFs, Documents, Room Files, and Attachments",
    paragraphs: [
      <>
        User-uploaded PDFs, images, documents, forms, flyers, resumes, job
        materials, marketplace images, and event files may not be accessible even
        when the surrounding Loombus page is accessible.
      </>,
      <>
        Publishers should use selectable text, meaningful reading order, document
        headings, tagged PDFs, descriptive filenames, alt text, accessible form
        fields, and an accessible HTML alternative when practical.
      </>,
    ],
  },
  {
    id: "local-maps",
    title: "Local Discovery, Distance, and Location Content",
    paragraphs: [
      <>
        Local Discovery should provide text-based results and filters rather than
        requiring a visual map alone. Distance, place, remote status, and event
        date should be available in text where supported.
      </>,
      <>
        Business owners, providers, employers, organizers, and sellers should
        describe entrances, remote access, mobility barriers, sensory conditions,
        accommodations, and other accessibility information accurately when it is
        relevant to a listing.
      </>,
    ],
  },
  {
    id: "mobile",
    title: "Mobile Applications and Device Features",
    paragraphs: [
      <>
        The native applications rely partly on iOS and Android accessibility
        services, including screen readers, text sizing, display scaling, switch
        control, voice control, captions, reduced motion, contrast, and device
        authentication.
      </>,
      <>
        A barrier may occur only on a specific app version, operating system,
        device size, orientation, or permission state. Include these details in an
        accessibility report.
      </>,
    ],
  },
  {
    id: "third-party",
    title: "Third-Party Services",
    paragraphs: [
      <>
        Authentication providers, payment processors, app stores, email links,
        maps, external websites, embedded media, and files can have accessibility
        limitations outside Loombus’s direct control.
      </>,
      <>
        Loombus will consider reasonable alternatives or workarounds when a
        third-party dependency creates a material barrier, but cannot guarantee
        changes to an external service.
      </>,
    ],
  },
  {
    id: "known-limitations",
    title: "Known and Potential Limitations",
    bullets: [
      <>rapidly evolving pages may contain inconsistent labels, focus behavior, contrast, or responsive states;</>,
      <>user-generated content may lack alt text, captions, transcripts, structure, or plain-language explanation;</>,
      <>complex visualizations, maps, conversation structures, charts, or AI outputs may need improved nonvisual equivalents;</>,
      <>private Room files and imported documents may not have been created accessibly;</>,
      <>third-party checkout, sign-in, maps, app-store, or linked content may behave differently;</>,
      <>older pages or experimental Labs features may lag behind the current accessibility target.</>,
    ],
  },
  {
    id: "request",
    title: "Requesting Assistance or an Accommodation",
    paragraphs: [
      <>
        Contact Loombus when a barrier prevents you from creating an account,
        accessing content, managing a subscription, using a safety tool, submitting
        a listing, participating in a Room, contacting a provider, or completing
        another important action.
      </>,
      <>
        Loombus may provide instructions, an alternative support path, a content
        explanation, or another reasonable response depending on the feature and
        available resources. A request does not require you to disclose a diagnosis.
      </>,
    ],
  },
  {
    id: "report",
    title: "How to Report an Accessibility Barrier",
    bullets: [
      <>the exact page, feature, or URL;</>,
      <>what you were trying to do and what prevented completion;</>,
      <>device, operating system, browser or app version, and appearance mode;</>,
      <>assistive technology and version, if you are comfortable sharing it;</>,
      <>keyboard steps, screen-reader announcement, screenshot, recording, or error text that helps reproduce the issue;</>,
      <>an accessible way for Loombus to respond to you.</>,
    ],
    paragraphs: [
      <>
        Submit the report through{" "}
        <Link href="/support?category=accessibility" className="text-zinc-200 underline-offset-4 hover:underline">
          Loombus Support
        </Link>{" "}
        or email{" "}
        <a
          href={`mailto:${supportEmail}?subject=Loombus%20Accessibility%20Issue`}
          className="text-zinc-200 underline-offset-4 hover:underline"
        >
          {supportEmail}
        </a>
        .
      </>,
    ],
  },
  {
    id: "response",
    title: "Accessibility Feedback Review",
    paragraphs: [
      <>
        Accessibility reports may be logged, reproduced, prioritized, tested, and
        connected to product changes. Priority can consider whether the barrier
        blocks account access, safety, legal information, payment management,
        communication, or a core platform task.
      </>,
      <>
        Loombus does not retaliate against a person for making a good-faith
        accessibility request or reporting a barrier.
      </>,
    ],
  },
];

export default function AccessibilityPage() {
  return (
    <PublicPolicyPage
      eyebrow="Accessibility"
      title="Accessibility"
      description={
        <>
          Loombus is working toward a clear, operable, understandable, and robust
          experience across web, iOS, Android, user-generated content, files, and
          third-party integrations.
        </>
      }
      sections={sections}
      reviewedDate="July 18, 2026"
    />
  );
}
