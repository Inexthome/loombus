import type { Metadata } from "next";
import Link from "next/link";
import {
  PublicPolicyPage,
  type PublicPolicySection,
} from "@/components/public-policy-page";

const supportEmail = "support@loombus.com";

export const metadata: Metadata = {
  title: "Privacy Policy | Loombus",
  description:
    "How Loombus handles account, age, content, Room, message, file, search, AI, location, business, service, request, job, event, marketplace, appointment, matching, billing, device, and support information.",
  alternates: {
    canonical: "https://loombus.com/privacy",
  },
};

const sections: PublicPolicySection[] = [
  {
    id: "scope",
    title: "Scope and Overview",
    paragraphs: [
      <>
        This Privacy Policy explains how Loombus may collect, use, store,
        disclose, protect, and retain information connected to the website,
        mobile applications, accounts, discussions, messages, private Rooms,
        files, search, AI tools, Local, businesses, services, requests, jobs,
        events, marketplace listings, appointments, matching, subscriptions,
        support, and related platform operations.
      </>,
      <>
        The information processed depends on the features you use, the visibility
        you select, whether you are signed in, your device and application, your
        subscription, your role in a Room or organization, and legal or safety
        requirements.
      </>,
    ],
  },
  {
    id: "account-information",
    title: "Account, Profile, and Authentication Information",
    bullets: [
      <>email address, internal user ID, login method, authentication provider, email-confirmation state, session state, and account creation information;</>,
      <>username, display name, avatar, biography, links, badges, supporter or creator details, notification preferences, topic preferences, and profile settings;</>,
      <>password-reset, recovery, identity-provider, login, logout, saved-session, and security-event information;</>,
      <>account status, warnings, restrictions, suspensions, bans, deactivation, deletion requests, enforcement reasons, administrative notes, and audit records.</>,
    ],
    paragraphs: [
      <>
        Loombus may support email, Google, Apple, and other authentication methods
        that become available. A sign-in provider may send Loombus an account
        identifier, email address, basic profile information, and authentication
        status permitted by that sign-in flow.
      </>,
      <>
        Optional device biometric or passcode unlock is performed by the operating
        system. Loombus does not receive or store your fingerprint or face
        template.
      </>,
    ],
  },
  {
    id: "age",
    title: "Age-Safety Information",
    paragraphs: [
      <>
        Loombus may collect date of birth, age band, age-gate completion state,
        under-13 status, teen status, guardian-required status, and Teen Safety
        Mode signals to determine eligibility and apply age-appropriate controls.
      </>,
      <>
        Exact date of birth is not intended to be displayed publicly. Age-related
        information may be used for private-message controls, contact protections,
        warnings, moderation priority, investigation, legal compliance, and child
        safety.
      </>,
    ],
  },
  {
    id: "discussion-content",
    title: "Discussions, Replies, Profiles, and Activity",
    bullets: [
      <>discussion titles, bodies, structured discussion type, topics, Reality Lenses, purpose, tags, sources, metadata, edits, and publication status;</>,
      <>replies, reply structure, mentions, reactions, saves, follows, blocks, reports, reading history, topic alerts, notifications, and activity records;</>,
      <>images, Video Context, PDFs, links, captions, alt text, filenames, file types, sizes, duration, thumbnails, processing state, and related metadata;</>,
      <>private folders, saved items, private notes, Stickies, drafts, and personal organization information;</>,
      <>Signal-related and State of the Discussion activity, including data used to calculate, explain, cache, or display supported indicators and summaries.</>,
    ],
  },
  {
    id: "rooms",
    title: "Private Rooms and Shared Workspace Information",
    bullets: [
      <>Room name, description, category, owner, administrators, members, invitations, roles, permissions, join and leave records, and access state;</>,
      <>Room discussions, announcements, calendars, events, files, resources, services, tasks, polls, forms, responses, knowledge items, and other workspace records;</>,
      <>Room-level reports, moderation records, member-management actions, audit information, and feature configuration;</>,
      <>search indexes and authorization metadata needed to return Room content only to members who are permitted to access it.</>,
    ],
    paragraphs: [
      <>
        Private Room content is limited by membership and role controls, but Room
        owners, authorized managers, recipients, and other members may be able to
        view, copy, download, or disclose it. Loombus may process limited Room
        information for delivery, support, security, abuse prevention, legal
        compliance, and policy enforcement.
      </>,
    ],
  },
  {
    id: "messages",
    title: "Private Messages and Communication Records",
    paragraphs: [
      <>
        Loombus may process message content, attachments, sender and recipient,
        conversation membership, timestamps, typing state, delivery and read
        state, archive or deletion state, mute settings, report counts, and
        moderation metadata needed to provide private messaging.
      </>,
      <>
        Private messages are not public, but they are not guaranteed to be
        confidential. Recipients can copy or disclose messages. Loombus may access,
        preserve, or disclose message records when reasonably necessary for a
        report, safety issue, support request, security event, legal obligation, or
        enforcement action.
      </>,
    ],
  },
  {
    id: "real-world",
    title: "Businesses, Services, Requests, Jobs, Events, Marketplace, and Appointments",
    bullets: [
      <>business or organization name, responsible owner, description, category, contact details, website, hours, service area, approval state, and management roles;</>,
      <>service title, scope, pricing or price range, availability, location or remote status, qualifications, media, inquiry data, and appointment options;</>,
      <>request title, description, category, budget, location, remote status, timing, requester information, responses, and match state;</>,
      <>job title, employer, role description, compensation information, employment type, location or remote status, application instructions, dates, and poster identity;</>,
      <>event organizer, title, description, date and time, venue or remote information, price, capacity, age or access details, reminders, and attendance-related activity;</>,
      <>marketplace item, seller, description, category, price, condition, location, images, status, trust-review data, watchlist state, and inquiry activity;</>,
      <>appointment service, provider, requester, requested and confirmed time, status, notes, cancellation information, and related communications;</>,
      <>match candidates, compatibility data, match scores, explanations, dismissals, contact actions, and records used to avoid repeating or misapplying suggestions.</>,
    ],
  },
  {
    id: "location",
    title: "Location and Local Discovery Information",
    paragraphs: [
      <>
        When you use Local or create a location-based record, Loombus may process a
        place name, city, region, postal code, address, service area, remote status,
        radius, geocoded coordinates, approximate distance, map-provider response,
        and filter choices.
      </>,
      <>
        Location information may come from what you type or select and from
        geocoding or mapping providers. Loombus does not need continuous device
        location for ordinary Local search unless a specific feature clearly asks
        for it and permission is granted.
      </>,
      <>
        Exact stored coordinates are used for platform calculations and are not
        intended to be exposed in ordinary public distance results. Information
        you place in a public address, description, photo, event venue, service
        area, or contact field may still reveal a precise location.
      </>,
    ],
  },
  {
    id: "search",
    title: "Search, Filters, and Discovery Activity",
    bullets: [
      <>search terms, filter choices, categories, date ranges, remote status, radius, selected place, result type, pagination, and sorting preferences;</>,
      <>results returned, permissions applied, result clicks, destination opened, and whether a query produced no results;</>,
      <>index records, excerpts, titles, metadata, file references, and visibility information needed to search authorized content;</>,
      <>relevance, safety, quality, recency, location, and integrity signals used to organize or restrict results.</>,
    ],
    paragraphs: [
      <>
        Search Everything searches Loombus content and platform destinations. It
        is not an open-web search engine. Search authorization may allow you to
        find private Room content or private saved items you are entitled to view,
        without making those records public.
      </>,
    ],
  },
  {
    id: "ai",
    title: "AI-Assisted Feature Information",
    bullets: [
      <>prompts, instructions, selected actions, discussion content, replies, titles, topics, tags, Reality Lenses, sources, and metadata submitted or required for an AI feature;</>,
      <>generated summaries, key takeaways, rewrites, checks, maps, related ideas, answer text, source links, ratings, feedback, errors, model or provider metadata, and usage events;</>,
      <>subscription tier, monthly limits, cached-output keys, usage counters, Extra AI Pack balances, and abuse-prevention information.</>,
    ],
    paragraphs: [
      <>
        Ask Loombus AI may use permitted Loombus search results to generate a
        grounded answer. Private Room content and private saved notes are excluded
        from Ask Loombus AI answer context. Ordinary search may still show an
        authorized user private results that the AI answer does not process.
      </>,
      <>
        Other AI features may process content that you expressly submit or content
        necessary to generate a requested discussion-level feature. Outputs may be
        stored or cached to display results, manage usage, reduce repeated
        processing, investigate abuse, and improve reliability.
      </>,
      <>
        Do not submit confidential, privileged, regulated, highly sensitive, or
        third-party information unless you have the right to do so and understand
        the processing risk.
      </>,
    ],
  },
  {
    id: "payments",
    title: "Subscriptions, Purchases, and Billing Information",
    bullets: [
      <>plan, entitlement, renewal, trial, cancellation, expiration, upgrade, downgrade, and usage-limit information;</>,
      <>web payment processor customer, checkout, subscription, invoice, transaction, dispute, refund, and fraud-status identifiers;</>,
      <>app-store product, transaction, original-transaction, purchase, restoration, renewal, and entitlement information;</>,
      <>billing support messages, receipt or invoice references, charge dates, and records needed to resolve payment issues.</>,
    ],
    paragraphs: [
      <>
        Full card numbers and bank credentials are generally handled by the
        applicable payment provider or app store rather than stored by Loombus.
        Loombus may receive limited billing and transaction information needed to
        grant access, manage subscriptions, respond to disputes, and prevent fraud.
      </>,
      <>
        User-to-user payments for marketplace items, services, events, jobs, or
        appointments are separate from Loombus subscription billing unless a
        feature expressly states that Loombus processes the transaction.
      </>,
    ],
  },
  {
    id: "devices",
    title: "Device, Application, Technical, and Security Information",
    bullets: [
      <>IP-related information, browser, operating system, device type, app version, language, time zone, network and request metadata;</>,
      <>session identifiers, authentication tokens, cookies, local storage, session storage, appearance setting, feature state, and device-specific preferences;</>,
      <>push-notification token, platform, permission state, delivery status, notification type, and device-registration information;</>,
      <>logs, diagnostics, errors, performance timing, route activity, API status, database events, file-processing events, and service-health information;</>,
      <>security events, rate limits, suspicious activity, blocked requests, failed logins, abuse signals, and integrity checks.</>,
    ],
  },
  {
    id: "support",
    title: "Support, Safety, Legal, and Rights Requests",
    paragraphs: [
      <>
        Loombus may collect the email address, category, subject, description,
        account context, URLs, usernames, screenshots, attachments, device
        information, correspondence, internal status, reviewer notes, and outcome
        connected to a support request.
      </>,
      <>
        Reports, appeals, accessibility requests, privacy requests, copyright or
        DMCA notices, counter-notices, trademark concerns, refund requests, payment
        disputes, law-enforcement requests, and other legal matters may require
        additional identity, contact, signature, ownership, authorization, or
        transaction information.
      </>,
    ],
  },
  {
    id: "sources",
    title: "Sources of Information",
    bullets: [
      <>you, when you create an account, publish content, send a message, search, use AI, submit a listing, manage a Room, make a purchase, or contact support;</>,
      <>other users, Room owners, organizations, businesses, providers, requesters, employers, organizers, sellers, buyers, or reporters who interact with you;</>,
      <>authentication providers, payment processors, app stores, email providers, push-notification services, mapping and geocoding providers, storage providers, security providers, and other service providers;</>,
      <>publicly available information or official records when reasonably used to review attribution, rights, fraud, safety, legal compliance, or a user-submitted claim;</>,
      <>the devices, applications, browsers, systems, and networks used to access Loombus.</>,
    ],
  },
  {
    id: "uses",
    title: "How Loombus Uses Information",
    bullets: [
      <>create, authenticate, maintain, secure, and recover accounts;</>,
      <>display public profiles, content, listings, directories, and activity according to selected visibility;</>,
      <>deliver messages, Room content, files, notifications, reminders, inquiries, applications, appointment requests, and other communications;</>,
      <>operate Search Everything, Local, filters, distance calculations, matching, recommendations, saved tools, and discovery;</>,
      <>provide AI-assisted features, source links, cached outputs, usage limits, and reliability controls;</>,
      <>process subscriptions, purchases, refunds, disputes, app-store entitlements, and billing support;</>,
      <>moderate content, review listings, investigate reports, protect minors, prevent fraud, enforce policies, and respond to security incidents;</>,
      <>measure performance, diagnose errors, maintain infrastructure, conduct audits, test features, and improve the service;</>,
      <>send transactional, account, security, notification, support, policy, and permitted promotional communications;</>,
      <>comply with law, respond to valid legal process, protect rights and safety, resolve disputes, and defend Loombus and its users.</>,
    ],
  },
  {
    id: "visibility",
    title: "Public, Member-Visible, Private, and Restricted Information",
    paragraphs: [
      <>
        Public or member-visible information may include username, display name,
        avatar, biography, badges, public discussions and replies, public follower
        relationships, businesses, services, requests, jobs, events, marketplace
        listings, public profile links, and other activity designated for discovery.
      </>,
      <>
        Private or restricted information may include messages, Room content,
        private notes, saved folders, drafts, account settings, date of birth,
        billing status, support records, reports, moderation records, internal
        location coordinates, and administrative information.
      </>,
      <>
        Feature controls reduce visibility but cannot prevent recipients or
        authorized members from copying or disclosing what they can access.
        Removing content does not retrieve copies already made by others.
      </>,
    ],
  },
  {
    id: "sharing",
    title: "When Loombus Shares or Discloses Information",
    bullets: [
      <>with hosting, database, authentication, storage, email, push, payment, app-store, mapping, geocoding, analytics, diagnostics, security, file-processing, and AI service providers;</>,
      <>with users or the public when you intentionally use a public or shared feature;</>,
      <>with Room owners, managers, organizations, businesses, providers, employers, organizers, sellers, or other counterparties as needed for the interaction you initiate;</>,
      <>with professional advisors, auditors, insurers, contractors, or vendors subject to appropriate obligations;</>,
      <>when required by law, subpoena, court order, warrant, regulatory request, or other valid legal process;</>,
      <>when reasonably necessary to protect a child, respond to a credible threat, investigate fraud or abuse, enforce policies, secure the platform, or protect rights and safety;</>,
      <>in connection with a merger, financing, acquisition, restructuring, bankruptcy, sale of assets, or transfer of platform operations;</>,
      <>with your consent or direction.</>,
    ],
    paragraphs: [
      <>
        Loombus does not currently operate a cross-site behavioral advertising
        network and does not sell personal information to data brokers. If that
        practice materially changes, Loombus will update the applicable notices
        and provide controls required by law.
      </>,
    ],
  },
  {
    id: "retention",
    title: "Data Retention",
    paragraphs: [
      <>
        Loombus retains information for as long as reasonably necessary for the
        purpose collected, account and feature operation, safety, legal compliance,
        billing, dispute resolution, audits, fraud prevention, backups, security,
        and enforcement.
      </>,
      <>
        Retention periods differ by record. Public content may remain until
        removed. Messages, Room records, listings, search indexes, AI outputs,
        support cases, billing records, logs, audit records, and backups may follow
        different operational schedules.
      </>,
      <>
        After deletion or account closure, information may remain temporarily in
        backups, caches, logs, search indexes, legal holds, moderation records,
        transaction records, support records, or material already copied by
        others. Loombus may retain limited information to document consent,
        enforce restrictions, prevent repeat abuse, meet tax or accounting duties,
        handle disputes, and comply with law.
      </>,
    ],
  },
  {
    id: "choices",
    title: "Your Choices and Controls",
    bullets: [
      <>edit supported profile, business, service, request, job, event, marketplace, appointment, and Room information;</>,
      <>choose whether to publish, save, follow, block, report, message, join a Room, enable notifications, or use a location-based filter;</>,
      <>manage supported email, push, topic-alert, appearance, privacy, and account settings;</>,
      <>cancel supported subscriptions through the applicable billing channel;</>,
      <>deactivate an account or submit an account-deletion request through available settings;</>,
      <>contact Loombus about access, correction, deletion, restriction, objection, portability, or appeal rights that may apply in your jurisdiction.</>,
    ],
    paragraphs: [
      <>
        Loombus may need to verify your identity, account authority, jurisdiction,
        or relationship to the requested information. Some requests may be denied
        or limited where permitted by law, including for safety, fraud prevention,
        legal obligations, another person’s rights, or records Loombus must retain.
      </>,
    ],
  },
  {
    id: "communications",
    title: "Email, Push Notifications, and Communications",
    paragraphs: [
      <>
        Loombus may send account confirmation, password reset, login, security,
        message, reply, follow, Room, event, reminder, appointment, subscription,
        billing, support, policy, and service-operation communications.
      </>,
      <>
        You can control supported notification categories and unsubscribe from
        eligible promotional or digest email. Essential account, security,
        transaction, legal, and service messages may still be sent.
      </>,
    ],
  },
  {
    id: "security",
    title: "Security",
    paragraphs: [
      <>
        Loombus uses reasonable technical and organizational measures intended to
        protect information, including authentication, access controls, logging,
        database policies, service-provider protections, and operational review.
      </>,
      <>
        No internet service, mobile app, database, message system, AI provider,
        payment provider, storage service, or transmission method is perfectly
        secure. Loombus cannot guarantee absolute security, permanent availability,
        or that every harmful file, account, or incident will be detected.
      </>,
      <>
        Protect your password, email, identity-provider account, device, recovery
        method, and verification codes. Contact support if you suspect compromise.
      </>,
    ],
  },
  {
    id: "children",
    title: "Children and Teen Privacy",
    paragraphs: [
      <>
        Loombus is not directed to children under 13 and does not knowingly permit
        them to create accounts. If Loombus learns that personal information was
        collected from a child under 13 in violation of applicable requirements,
        Loombus may restrict the account, delete information, seek appropriate
        consent where legally available, and preserve limited records needed for
        safety or legal compliance.
      </>,
      <>
        Teen Safety Mode may apply additional controls to users ages 13 through
        17. Parents or guardians who believe a child under 13 used Loombus or who
        have a safety concern involving a teen may contact Support.
      </>,
    ],
  },
  {
    id: "international",
    title: "International Processing",
    paragraphs: [
      <>
        Loombus is operated from the United States. Information may be processed,
        stored, or transferred in the United States and other countries where
        Loombus or its providers operate. Those countries may have different data
        protection laws.
      </>,
    ],
  },
  {
    id: "changes",
    title: "Changes to This Privacy Policy",
    paragraphs: [
      <>
        Loombus may update this Policy to reflect new features, data practices,
        providers, legal requirements, safety needs, or business changes. The
        updated version applies on the effective date stated in the Policy.
      </>,
      <>
        Material changes may be communicated through Loombus, email, or another
        reasonable method where required or appropriate.
      </>,
    ],
  },
  {
    id: "contact",
    title: "Privacy Contact",
    paragraphs: [
      <>
        Submit a privacy question or request through{" "}
        <Link href="/support?category=legal" className="text-zinc-200 underline-offset-4 hover:underline">
          Loombus Support
        </Link>{" "}
        or email{" "}
        <a
          href={`mailto:${supportEmail}?subject=Loombus%20Privacy%20Request`}
          className="text-zinc-200 underline-offset-4 hover:underline"
        >
          {supportEmail}
        </a>
        . Do not send passwords, verification codes, full payment credentials, or
        unnecessary sensitive records.
      </>,
    ],
  },
];

export default function PrivacyPage() {
  return (
    <PublicPolicyPage
      eyebrow="Legal"
      title="Privacy Policy"
      description={
        <>
          This Policy explains the information Loombus processes across knowledge,
          community, AI, search, location, real-world discovery, commerce,
          subscriptions, safety, and support features.
        </>
      }
      sections={sections}
      effectiveDate="July 18, 2026"
      reviewedDate="July 18, 2026"
    />
  );
}
