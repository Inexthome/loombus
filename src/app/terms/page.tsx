import type { Metadata } from "next";
import Link from "next/link";
import {
  PublicPolicyPage,
  type PublicPolicySection,
} from "@/components/public-policy-page";

const supportEmail = "support@loombus.com";

export const metadata: Metadata = {
  title: "Terms of Service | Loombus",
  description:
    "Terms governing Loombus discussions, accounts, Rooms, messages, AI tools, search, local discovery, businesses, services, requests, jobs, events, marketplace, appointments, matching, subscriptions, and related services.",
  alternates: {
    canonical: "https://loombus.com/terms",
  },
};

const sections: PublicPolicySection[] = [
  {
    id: "agreement",
    title: "Agreement to These Terms",
    paragraphs: [
      <>
        These Terms of Service govern your access to and use of Loombus, including
        its website, mobile applications, accounts, discussions, private Rooms,
        messages, files, search, AI-assisted tools, Local, businesses, services,
        requests, jobs, events, marketplace listings, appointments, matching,
        subscriptions, support, and related features.
      </>,
      <>
        By creating an account, accessing a protected feature, posting or
        uploading content, purchasing a subscription, submitting a listing,
        communicating with another member, or otherwise using Loombus, you agree
        to these Terms, the{" "}
        <Link href="/privacy" className="text-zinc-200 underline-offset-4 hover:underline">
          Privacy Policy
        </Link>
        ,{" "}
        <Link href="/guidelines" className="text-zinc-200 underline-offset-4 hover:underline">
          Community Guidelines
        </Link>
        ,{" "}
        <Link href="/safety" className="text-zinc-200 underline-offset-4 hover:underline">
          Safety information
        </Link>
        , and other policies expressly incorporated into these Terms.
      </>,
      <>
        If you use Loombus for a business, organization, Room, event, employer,
        service provider, seller, or other entity, you represent that you have
        authority to bind that entity, and “you” includes both you and that entity.
      </>,
    ],
  },
  {
    id: "service",
    title: "The Loombus Service",
    paragraphs: [
      <>
        Loombus is an everything knowledge platform designed to connect
        structured discussion, durable knowledge, people, private communities,
        local discovery, real-world opportunities, services, commerce, and
        AI-assisted understanding.
      </>,
      <>
        Features may include public and member pages, discussions, replies,
        profiles, follows, notifications, private messages, Rooms, calendars,
        events, files, resources, tasks, polls, forms, saves, folders, private
        notes, reading history, topic alerts, Video Context, search, Ask Loombus
        AI, State of the Discussion, businesses, services, requests, jobs,
        marketplace listings, appointments, Local, matches, subscriptions, Labs,
        moderation, support, and platform operations.
      </>,
      <>
        Loombus may add, modify, test, limit, reprice, suspend, discontinue, or
        replace any feature or access level at any time. A feature’s presence in a
        policy, plan page, screenshot, roadmap, search result, or previous version
        does not guarantee permanent availability.
      </>,
    ],
  },
  {
    id: "eligibility",
    title: "Eligibility, Age, and Legal Capacity",
    paragraphs: [
      <>
        You may use Loombus only if you can legally agree to these Terms and are
        not prohibited from using the service under applicable law. Loombus is not
        available to children under 13.
      </>,
      <>
        By creating or using an account, you represent that the age information
        you provide is accurate and that you are at least 13. A user under the age
        of majority in the user’s jurisdiction may use Loombus only with
        appropriate parental or guardian permission.
      </>,
      <>
        Members ages 13 through 17 may be subject to Teen Safety Mode, including
        additional messaging, contact, visibility, warning, and moderation
        controls. Loombus may restrict or remove an account associated with false
        age information or under-13 use and may preserve limited records for
        safety, legal compliance, fraud prevention, and platform integrity.
      </>,
    ],
  },
  {
    id: "accounts",
    title: "Accounts, Authentication, and Security",
    paragraphs: [
      <>
        You must provide accurate account information, maintain a valid sign-in
        method, and protect your password, email account, identity-provider
        account, saved session, device unlock, recovery method, and authentication
        codes.
      </>,
      <>
        You are responsible for activity conducted through your account unless
        applicable law provides otherwise. Do not sell, rent, transfer, share,
        sublicense, or provide unauthorized access to an account, Room role,
        business profile, listing-management account, subscription, or
        administrative privilege.
      </>,
      <>
        Notify Loombus promptly if you suspect unauthorized access, impersonation,
        payment fraud, a compromised Room, or misuse of a business or organization
        profile. Loombus may require verification before changing access,
        disclosing account information, or processing certain requests.
      </>,
    ],
  },
  {
    id: "content",
    title: "User Content and Responsibility",
    paragraphs: [
      <>
        “User Content” includes text, discussions, replies, messages, profile
        information, Room content, files, images, video, PDFs, links, forms,
        polls, tasks, calendar entries, business information, services, requests,
        jobs, events, marketplace listings, appointment information, reviews,
        reports, prompts, feedback, and other material you submit or make available.
      </>,
      <>
        You are responsible for your User Content and for having all rights,
        permissions, consents, licenses, releases, and legal authority necessary
        to create, upload, display, distribute, process, search, or share it.
      </>,
      <>
        Loombus does not endorse, verify, guarantee, or assume responsibility for
        User Content, user claims, professional qualifications, identities,
        listings, offers, prices, availability, reviews, source quality, AI
        outputs, third-party links, or conduct between users.
      </>,
    ],
  },
  {
    id: "license",
    title: "License You Grant to Loombus",
    paragraphs: [
      <>
        You retain ownership of User Content. By submitting or making User Content
        available through Loombus, you grant Loombus a worldwide, non-exclusive,
        royalty-free, transferable, and sublicensable license to host, store,
        reproduce, process, format, adapt for technical display, transmit,
        distribute, display, index, search, moderate, analyze, back up, and
        otherwise use that content as reasonably necessary to operate, protect,
        improve, and provide the service.
      </>,
      <>
        The license includes operating public and private visibility controls,
        generating previews and thumbnails, delivering files, creating
        notifications, applying safety systems, supporting authorized search,
        generating requested AI-assisted outputs, presenting Local and matching
        results, and enabling other members to use content through the features you
        select.
      </>,
      <>
        The license is limited by the intended feature and privacy controls. It
        does not authorize Loombus to make private content public merely because
        the platform must store, index, transmit, or process it.
      </>,
      <>
        Removal or account closure may not immediately remove all copies from
        backups, caches, logs, search indexes, moderation records, legal records,
        billing records, reports, AI-output records, or material already copied,
        quoted, downloaded, exported, or shared by others.
      </>,
    ],
  },
  {
    id: "search",
    title: "Search Everything and Indexing",
    paragraphs: [
      <>
        Loombus Search searches content and destinations inside Loombus. It is not
        a general search of the open web. Results may include public content,
        member-visible content, private Room content available to the searching
        member, saved items, files, profiles, listings, and platform pages.
      </>,
      <>
        Search visibility depends on permissions, indexing status, account state,
        feature availability, content type, safety controls, and relevance
        systems. Search results may be incomplete, delayed, stale, duplicated,
        mislabeled, or incorrectly ranked.
      </>,
      <>
        You may not scrape, crawl, harvest, reconstruct, bulk export, reverse
        engineer, or use search to build a competing database, train a model,
        profile users, evade access controls, or collect private information
        without written authorization.
      </>,
    ],
  },
  {
    id: "ai",
    title: "AI-Assisted Features",
    paragraphs: [
      <>
        Loombus may provide summaries, key takeaways, clarity rewrites, discussion
        maps, disagreement analysis, related ideas, quality checks, reply
        suggestions, matching explanations, Ask Loombus AI, and similar tools.
      </>,
      <>
        AI outputs are generated assistance and may be inaccurate, incomplete,
        outdated, biased, unsuitable, or misleading. You must evaluate the
        underlying sources and remain responsible for decisions, posts, messages,
        listings, applications, services, and other actions based on an output.
      </>,
      <>
        Ask Loombus AI is grounded in permitted Loombus sources rather than the
        open web. Private Room content and private saved notes are excluded from
        Ask Loombus AI answer context. Other AI features may process content
        expressly submitted to the feature or content required to provide a
        requested discussion-level output.
      </>,
      <>
        Do not submit confidential, privileged, regulated, highly sensitive, or
        third-party information to an AI feature unless you have authority and
        accept the processing risk. AI features are not legal, medical, financial,
        tax, investment, mental-health, emergency, licensing, employment, or other
        professional advice.
      </>,
    ],
  },
  {
    id: "rooms",
    title: "Private Rooms and Shared Workspaces",
    paragraphs: [
      <>
        Rooms may provide limited-access discussions, announcements, calendars,
        files, resources, services, tasks, polls, forms, events, membership,
        invitations, and role-based controls. Room owners and authorized managers
        are responsible for lawful administration, appropriate membership, clear
        rules, and responsible handling of member information.
      </>,
      <>
        “Private” means limited by product permissions, not absolutely
        confidential. Members can copy or disclose what they access. Loombus may
        process or review Room records for delivery, search for authorized members,
        support, safety, security, abuse prevention, legal compliance, and
        enforcement.
      </>,
      <>
        Room rules cannot override these Terms, platform-wide policies, safety
        controls, intellectual property rights, or applicable law. Loombus may
        restrict a Room, remove content, change access, or remove a Room owner when
        necessary to protect the service or members.
      </>,
    ],
  },
  {
    id: "messages-files",
    title: "Messages, Files, and Video Context",
    paragraphs: [
      <>
        Private messages and Room files are intended for limited audiences, but
        recipients can screenshot, download, forward, copy, or disclose them.
        Do not send credentials, authentication codes, full payment details,
        unlawful material, or information you cannot legally share.
      </>,
      <>
        Attachments and Video Context may be subject to file type, size, duration,
        quantity, storage, plan, moderation, and processing limits. A written
        discussion may be required with Video Context. Loombus may compress,
        transcode, generate previews, scan, restrict, or remove uploads, but does
        not guarantee that every harmful file or link will be detected.
      </>,
    ],
  },
  {
    id: "local",
    title: "Local Discovery and Location",
    paragraphs: [
      <>
        Local may organize businesses, services, requests, jobs, events,
        marketplace listings, and remote opportunities using text, category,
        place, service area, event date, remote status, availability, radius, and
        approximate distance.
      </>,
      <>
        Distance is an estimate and can be affected by geocoding, place selection,
        service-area data, network conditions, and incomplete listings. Loombus
        does not guarantee that a result is physically nearby, available, open, or
        permitted to operate in a location.
      </>,
      <>
        Public pages are designed not to expose stored exact coordinates through
        ordinary distance results. You remain responsible for the address,
        location, photos, contact information, and other details you choose to
        publish.
      </>,
    ],
  },
  {
    id: "businesses",
    title: "Businesses and Organization Profiles",
    paragraphs: [
      <>
        A business or organization profile must be attributable to a responsible
        person or entity. The profile owner is responsible for accurate names,
        affiliations, service areas, contact information, hours, offerings,
        credentials, and authority to act for the organization.
      </>,
      <>
        Approval, attribution, appearance in a directory, or access to management
        tools is not an endorsement, license verification, insurance check,
        background check, financial review, or guarantee of quality or legality.
      </>,
    ],
  },
  {
    id: "services-requests",
    title: "Services, Requests, and Appointments",
    paragraphs: [
      <>
        Providers are responsible for accurately describing scope, price,
        qualifications, licensing, insurance, availability, location, limitations,
        cancellation terms, and other material conditions. Requesters are
        responsible for describing lawful needs and providing information they are
        authorized to share.
      </>,
      <>
        Appointment tools support scheduling and communication. They do not create
        a guarantee of attendance, availability, quality, response time, emergency
        service, licensing, payment, refund, or successful performance.
      </>,
      <>
        Unless Loombus expressly agrees otherwise, a contract for services is
        between the requester and provider. Loombus is not the contractor,
        professional, employer, agent, insurer, licensing authority, escrow
        provider, or guarantor.
      </>,
    ],
  },
  {
    id: "matching",
    title: "Intelligent Matching",
    paragraphs: [
      <>
        Matching may compare structured Requests and Services and return
        compatibility suggestions or explanations. A match can be affected by
        incomplete, inaccurate, outdated, or user-supplied information.
      </>,
      <>
        A match, match score, explanation, or directory position is not an
        endorsement, professional recommendation, credential check, safety
        certification, offer, acceptance, contract, or guarantee. Users must
        conduct their own evaluation before contacting, hiring, paying, meeting,
        or sharing sensitive information.
      </>,
    ],
  },
  {
    id: "marketplace",
    title: "Marketplace",
    paragraphs: [
      <>
        Marketplace enables attributable users to publish and discover listings.
        Unless a specific Loombus checkout expressly states otherwise, Loombus is
        not the seller, buyer, payment processor, escrow provider, shipping
        provider, inspector, authenticator, insurer, or party to a transaction.
      </>,
      <>
        Sellers are responsible for lawful ownership, accurate description,
        condition, pricing, safety disclosures, images, availability, taxes,
        delivery, returns they promise, and compliance with laws governing the
        item. Buyers are responsible for evaluating the seller, item, payment
        method, legality, and transaction risk.
      </>,
      <>
        Prohibited or restricted listings include illegal, stolen, counterfeit,
        recalled, dangerously defective, exploitative, infringing, fraudulent, or
        unlawfully regulated goods and services. Loombus may reject or remove a
        listing without completing an investigation or transaction.
      </>,
    ],
  },
  {
    id: "jobs",
    title: "Jobs and Employment Opportunities",
    paragraphs: [
      <>
        Job posters are responsible for accurate employer identity, role,
        compensation, classification, location or remote status, qualifications,
        sponsorship, schedule, application process, and legal compliance.
        Applicants are responsible for verifying the employer and deciding what
        information to provide.
      </>,
      <>
        Loombus is not an employer, recruiter, staffing agency, background-check
        provider, payroll provider, immigration advisor, or guarantor unless
        expressly identified as such for a particular role. A listing, approval,
        attribution, or search position is not an endorsement.
      </>,
      <>
        Loombus may restrict fake jobs, fee scams, discriminatory or illegal
        postings, trafficking, reshipping, check fraud, pyramid schemes, deceptive
        recruiting, credential harvesting, and other unsafe or misleading
        opportunities.
      </>,
    ],
  },
  {
    id: "events",
    title: "Events",
    paragraphs: [
      <>
        Event organizers are responsible for accurate dates, times, locations,
        remote access, prices, capacity, age restrictions, accessibility details,
        permits, safety planning, venue compliance, cancellation notices, and
        refunds they promise.
      </>,
      <>
        Loombus is not the organizer, venue, ticket seller, security provider,
        transportation provider, insurer, or guarantor unless expressly stated.
        Attendance and participation are at the user’s own risk, subject to
        applicable law.
      </>,
    ],
  },
  {
    id: "communications",
    title: "User-to-User Communications and Off-Platform Activity",
    paragraphs: [
      <>
        Loombus may provide messaging, inquiries, applications, appointment
        requests, listing contact, Room invitations, and other communication tools.
        Loombus does not control communications or conduct that move outside the
        service.
      </>,
      <>
        These Terms and the Guidelines may still apply to off-platform conduct when
        it originates on Loombus, targets a Loombus member, evades enforcement, or
        creates a material safety, fraud, legal, or platform-integrity risk.
      </>,
    ],
  },
  {
    id: "prohibited",
    title: "Prohibited Conduct",
    bullets: [
      <>harassment, threats, stalking, doxxing, hate-driven conduct, exploitation, grooming, or unsafe contact with minors;</>,
      <>fraud, scams, impersonation, fake identities, deceptive listings, fake reviews, fabricated credentials, or misleading affiliations;</>,
      <>spam, scraping, crawling, harvesting, automated abuse, coordinated manipulation, or fake engagement;</>,
      <>malware, phishing, harmful code, credential theft, security testing without authorization, or attempts to disrupt the service;</>,
      <>bypassing subscriptions, rate limits, age controls, moderation, blocks, Room permissions, suspensions, or other access restrictions;</>,
      <>illegal, infringing, non-consensual, exploitative, dangerous, or unlawfully regulated content, goods, services, jobs, or events;</>,
      <>misuse of search, AI, matching, location, reporting, support, files, payments, or administrative tools;</>,
      <>using Loombus in a way that creates unreasonable legal, regulatory, security, safety, operational, reputational, or financial risk.</>,
    ],
  },
  {
    id: "subscriptions",
    title: "Subscriptions, Paid Features, and Plan Limits",
    paragraphs: [
      <>
        Loombus may offer Premium, Premium Plus, Extra AI Packs, Room-related
        upgrades, creator or supporter tools, expanded AI usage, longer Video
        Context, and other paid features. Current pricing, billing interval,
        benefits, limits, and renewal terms are shown in the applicable purchase
        flow.
      </>,
      <>
        Paid access does not guarantee uninterrupted service, permanent features,
        AI accuracy, search position, visibility, audience growth, employment,
        sales, appointments, matches, revenue, or any other result.
      </>,
      <>
        Subscription cancellation and refund rules are described in the{" "}
        <Link href="/refunds" className="text-zinc-200 underline-offset-4 hover:underline">
          Refund Policy
        </Link>
        . Purchases billed by an app store may be governed by that store’s billing,
        cancellation, and refund process.
      </>,
    ],
  },
  {
    id: "payments",
    title: "Payments, Taxes, and User Transactions",
    paragraphs: [
      <>
        Loombus may use third-party payment processors or app stores for
        subscription and add-on purchases. You authorize the applicable provider
        to charge the payment method associated with your purchase, including
        recurring charges disclosed at checkout.
      </>,
      <>
        You are responsible for taxes, fees, accurate billing information, and
        charges arising from your account, subject to applicable law. Failed
        payments, chargebacks, fraud indicators, or processor action may result in
        restricted paid access while the issue is reviewed.
      </>,
      <>
        User-to-user payments for marketplace items, services, jobs, event
        admission, appointments, or other arrangements are separate from Loombus
        subscription charges unless Loombus expressly processes the transaction.
        Loombus is not responsible for those outside payments or disputes.
      </>,
    ],
  },
  {
    id: "moderation",
    title: "Moderation, Approval, Enforcement, and Appeals",
    paragraphs: [
      <>
        Loombus may review, label, reduce visibility, reject, remove, disable,
        quarantine, preserve, investigate, suspend, terminate, or refuse content,
        files, listings, Rooms, profiles, payments, features, or accounts when it
        believes action is appropriate for policy, safety, legal, security, fraud,
        billing, operational, or business reasons.
      </>,
      <>
        Approval workflows and trust controls do not create a duty to verify every
        fact or detect every violation. Loombus may act before completing an
        investigation and is not required to disclose confidential detection,
        moderation, or security methods.
      </>,
      <>
        You may submit a focused appeal through Support. Loombus may uphold,
        modify, or reverse an action, request more information, or decline further
        review. Restoration is not guaranteed.
      </>,
    ],
  },
  {
    id: "intellectual-property",
    title: "Loombus Intellectual Property and Rights Complaints",
    paragraphs: [
      <>
        Loombus software, design, branding, interfaces, documentation, databases,
        selection and arrangement, and other platform materials are owned by
        Loombus, its owner, licensors, or service providers, except for User
        Content and third-party materials.
      </>,
      <>
        You may not copy, sell, reproduce, modify, distribute, reverse engineer,
        scrape, frame, mirror, create derivative services from, or misuse Loombus
        materials except as expressly permitted by the service or applicable law.
      </>,
      <>
        Copyright concerns may be submitted through the{" "}
        <Link href="/dmca" className="text-zinc-200 underline-offset-4 hover:underline">
          Copyright and DMCA Process
        </Link>
        . Other rights concerns may be submitted through Support.
      </>,
    ],
  },
  {
    id: "privacy",
    title: "Privacy, Cookies, and Security",
    paragraphs: [
      <>
        The{" "}
        <Link href="/privacy" className="text-zinc-200 underline-offset-4 hover:underline">
          Privacy Policy
        </Link>{" "}
        explains how Loombus handles information, including content, Rooms,
        messages, location-related data, search activity, AI usage, listings,
        subscriptions, device information, and support records. The{" "}
        <Link href="/cookies" className="text-zinc-200 underline-offset-4 hover:underline">
          Cookie Use page
        </Link>{" "}
        explains cookies, browser storage, session tokens, and similar
        technologies.
      </>,
      <>
        No online service can guarantee perfect security, uninterrupted access, or
        permanent preservation. You are responsible for securing your account and
        making independent copies of information you cannot afford to lose.
      </>,
    ],
  },
  {
    id: "third-parties",
    title: "Third-Party Services and Links",
    paragraphs: [
      <>
        Loombus may rely on hosting, database, authentication, app-store, payment,
        storage, email, push-notification, mapping, geocoding, security,
        diagnostics, analytics, file-processing, and AI providers.
      </>,
      <>
        Third-party services and links are governed by their own terms and privacy
        practices. Loombus is not responsible for their availability, content,
        pricing, decisions, security, data practices, transactions, or conduct.
      </>,
    ],
  },
  {
    id: "disclaimers",
    title: "Disclaimers",
    paragraphs: [
      <>
        To the maximum extent permitted by law, Loombus is provided on an “AS IS”
        and “AS AVAILABLE” basis. Loombus makes no warranty that the service,
        content, search, AI, matching, listings, locations, files, communications,
        subscriptions, or third-party services will be accurate, complete, secure,
        uninterrupted, error-free, lawful, suitable, profitable, or free from
        harmful content or conduct.
      </>,
      <>
        Loombus disclaims express, implied, statutory, and other warranties,
        including warranties of merchantability, fitness for a particular purpose,
        non-infringement, title, accuracy, quiet enjoyment, availability, and
        security, to the extent permitted by law.
      </>,
    ],
  },
  {
    id: "liability",
    title: "Limitation of Liability",
    paragraphs: [
      <>
        To the maximum extent permitted by law, Loombus, its owner, operators,
        affiliates, contractors, representatives, licensors, and service providers
        will not be liable for indirect, incidental, special, consequential,
        exemplary, punitive, reliance, reputational, lost-profit, lost-revenue,
        lost-opportunity, lost-data, business-interruption, personal-interaction,
        or other intangible damages arising from or related to Loombus.
      </>,
      <>
        This limitation includes claims involving User Content, user conduct,
        listings, sales, services, jobs, events, appointments, matches, AI
        outputs, search results, location information, files, messages, Room
        activity, moderation, security incidents, account restrictions, payments,
        or inability to use the service.
      </>,
      <>
        To the maximum extent permitted by law, Loombus’s total aggregate
        liability for a claim will not exceed the greater of the amount you paid
        Loombus for the service giving rise to the claim during the six months
        before the event or one hundred U.S. dollars ($100). Nothing excludes
        liability that cannot legally be excluded or limited.
      </>,
    ],
  },
  {
    id: "indemnity",
    title: "Indemnification",
    paragraphs: [
      <>
        To the maximum extent permitted by law, you agree to defend, indemnify, and
        hold harmless Loombus, its owner, operators, affiliates, contractors,
        representatives, licensors, and service providers from claims, demands,
        damages, losses, liabilities, costs, and expenses, including reasonable
        attorneys’ fees, arising from your User Content, listings, transactions,
        services, jobs, events, Room administration, use or misuse of Loombus,
        violation of these Terms, violation of law, or violation of another
        person’s rights.
      </>,
    ],
  },
  {
    id: "termination",
    title: "Suspension, Termination, and Service Discontinuation",
    paragraphs: [
      <>
        You may stop using Loombus at any time. Account deactivation or deletion
        requests are subject to the Privacy Policy, technical limitations,
        retention needs, outstanding disputes, safety records, legal obligations,
        billing, and content already shared with others.
      </>,
      <>
        Loombus may suspend, restrict, terminate, or refuse an account or feature
        for violations, fraud, abuse, security risk, payment issues, legal risk,
        prolonged inactivity, operational needs, discontinuation, or other lawful
        business reasons.
      </>,
      <>
        Provisions that by their nature should survive termination will survive,
        including ownership, licenses needed for retained records, disclaimers,
        limitations, indemnity, disputes, and enforcement rights.
      </>,
    ],
  },
  {
    id: "disputes",
    title: "Governing Law, Venue, and Claim Limits",
    paragraphs: [
      <>
        These Terms and disputes relating to Loombus are governed by the laws of
        the State of Florida, without regard to conflict-of-law principles, except
        where applicable law requires otherwise.
      </>,
      <>
        To the maximum extent permitted by law, disputes must be brought in the
        state or federal courts located in Florida, and you consent to their
        jurisdiction and venue.
      </>,
      <>
        To the maximum extent permitted by law, claims must be brought on an
        individual basis and not as a plaintiff or class member in a class,
        collective, consolidated, private-attorney-general, or representative
        proceeding.
      </>,
      <>
        To the maximum extent permitted by law, a claim arising from Loombus must
        be brought within one year after the event giving rise to it or it is
        barred.
      </>,
    ],
  },
  {
    id: "general",
    title: "General Terms",
    paragraphs: [
      <>
        These Terms and incorporated policies form the agreement between you and
        Loombus concerning the service. If a provision is unenforceable, the
        remaining provisions remain effective. Failure to enforce a provision is
        not a waiver.
      </>,
      <>
        You may not assign these Terms without written permission. Loombus may
        assign them as part of a merger, financing, restructuring, sale, transfer,
        or change in platform operations.
      </>,
      <>
        Headings are for convenience. Electronic notices and records may satisfy
        legal writing requirements where permitted.
      </>,
    ],
  },
  {
    id: "changes",
    title: "Changes to These Terms",
    paragraphs: [
      <>
        Loombus may update these Terms to reflect new features, operational
        practices, legal requirements, safety needs, pricing, or business changes.
        The updated version becomes effective when posted or on a later date
        stated in the notice.
      </>,
      <>
        Material changes may be communicated through the service, email, or another
        reasonable method. Continued use after the effective date means you accept
        the updated Terms.
      </>,
    ],
  },
  {
    id: "contact",
    title: "Contact",
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
        Questions about these Terms may be submitted through{" "}
        <Link href="/support?category=legal" className="text-zinc-200 underline-offset-4 hover:underline">
          Loombus Support
        </Link>{" "}
        or emailed to{" "}
        <a
          href={`mailto:${supportEmail}?subject=Loombus%20Terms%20Question`}
          className="text-zinc-200 underline-offset-4 hover:underline"
        >
          {supportEmail}
        </a>
        .
      </>,
    ],
  },
];

export default function TermsPage() {
  return (
    <PublicPolicyPage
      eyebrow="Legal"
      title="Terms of Service"
      description={
        <>
          These Terms govern the complete Loombus service, including knowledge
          features, private communities, AI, search, local discovery, real-world
          directories, user-to-user activity, and paid access.
        </>
      }
      sections={sections}
      effectiveDate="July 18, 2026"
      reviewedDate="July 19, 2026"
    />
  );
}
