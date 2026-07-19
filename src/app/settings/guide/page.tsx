import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, PageShell, Panel } from "@/components/ui";
import styles from "@/components/ui/reference-v2.module.css";

export const metadata: Metadata = {
  title: "Loombus Guide | Loombus",
  description:
    "Learn how Loombus discussions, Signal, Search Everything, Ask Loombus AI, Rooms, messages, Local, businesses, Services, Requests, Jobs, Events, Marketplace, appointments, matching, saved knowledge, subscriptions, and safety controls work.",
  alternates: {
    canonical: "https://loombus.com/settings/guide",
  },
};

type GuideSection = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
  callout?: {
    title: string;
    body: string;
    href?: string;
    label?: string;
  };
};

const guideSections: GuideSection[] = [
  {
    id: "getting-started",
    eyebrow: "Start here",
    title: "Getting started",
    body: "Loombus is an everything knowledge platform built for Signal over noise. Begin by completing your profile, selecting your appearance, reading discussions, trying Search Everything, saving useful material, and creating one focused contribution.",
    bullets: [
      "Complete your profile so people understand who they are reading or contacting.",
      "Use Home as the entry point to your personal Loombus workspace.",
      "Use Discussions for public knowledge and Rooms for limited-access community work.",
      "Use Local and the real-world directories when you need a business, Service, Request, Job, Event, or Marketplace listing.",
    ],
  },
  {
    id: "home",
    eyebrow: "Home",
    title: "Home and your Signal hub",
    body: "Home brings important Loombus workspaces together without relying on an endless feed. It helps you move between creating, reading, search, saved items, activity, Stickies, Rooms, Local, Labs, and account tools.",
    bullets: [
      "Needs Attention surfaces activity that may require a response.",
      "Loombus Updates explains meaningful platform changes.",
      "Workspace links move directly to focused areas rather than mixing every task into one feed.",
      "Your available shortcuts can depend on account access and active features.",
    ],
  },
  {
    id: "discussions",
    eyebrow: "Knowledge",
    title: "Reading public discussions",
    body: "Discussions is the public knowledge workspace. Filters, topics, purpose, Reality Lenses, following, activity, and Signal help you find useful conversations.",
    bullets: [
      "All shows the broader public discussion directory.",
      "Following narrows activity to people you follow.",
      "Active emphasizes stronger recent discussion activity.",
      "Saved and Reading History help you return without starting over.",
    ],
  },
  {
    id: "signal",
    eyebrow: "Signal",
    title: "What Signal means",
    body: "Signal is Loombus shorthand for useful activity and contribution. It can help organize discovery using observable platform activity, but it is not identity verification, a credit score, a professional credential, or a guarantee of quality.",
    bullets: [
      "Replies can show that a discussion is developing.",
      "Saves can show that members found material worth returning to.",
      "Views show reading attention, not agreement.",
      "Signal supports discovery and reflection but does not replace judgment.",
    ],
  },
  {
    id: "create",
    eyebrow: "Create",
    title: "Creating a focused discussion",
    body: "A strong discussion has a clear title, written context, a Topic, and a reason for thoughtful participation. Loombus supports open discussion, debate, research-question, and problem-solving structures.",
    bullets: [
      "Choose the closest Topic before publishing.",
      "Use a Reality Lens when lived or real-world context matters.",
      "Use a Purpose Lane and structured fields to tell readers what would move the discussion forward.",
      "Add sources, images, PDFs, links, or Video Context only when they improve understanding.",
    ],
    callout: {
      title: "Video Context supports the written discussion",
      body: "A written discussion remains required. Video Context does not autoplay or display a public view count, and current duration and monthly limits depend on the account plan.",
      href: "/premium",
      label: "Review plan limits",
    },
  },
  {
    id: "state",
    eyebrow: "Understanding",
    title: "State of the Discussion",
    body: "State of the Discussion can organize a thread into summaries, key takeaways, what changed, disagreement structure, conversation maps, and related ideas. Availability and limits can depend on the discussion and account plan.",
    bullets: [
      "Open the original discussion and replies when accuracy matters.",
      "Treat AI-generated organization as assistance rather than verified fact.",
      "Use source context and participant wording to evaluate nuance.",
      "Report an output that is misleading, unsafe, or disconnected from the thread.",
    ],
  },
  {
    id: "search",
    eyebrow: "Search Everything",
    title: "Searching inside Loombus",
    body: "Search Everything searches Loombus content and destinations. It is not Google Search and does not search the general open web. Results can include discussions, replies, people, public pages, authorized Room content, saved items, files, businesses, Services, Requests, Jobs, Events, Marketplace listings, and other supported records.",
    bullets: [
      "Search permissions determine whether private or restricted results can appear.",
      "Finding private content does not make it public.",
      "Use filters and exact terms to narrow a broad result set.",
      "Results can be incomplete, delayed, or incorrectly ranked, so open the source before relying on it.",
    ],
    callout: {
      title: "Search is permission-aware",
      body: "A Room result is returned only when the current account is authorized. Private saved items remain tied to the current account.",
      href: "/search",
      label: "Open Search",
    },
  },
  {
    id: "ask-ai",
    eyebrow: "Ask Loombus AI",
    title: "Grounded answers with source links",
    body: "Ask Loombus AI uses permitted Loombus search sources to generate an answer and can show links to the supporting records. It may still be inaccurate, incomplete, or misleading.",
    bullets: [
      "Ask a focused question and review the returned sources.",
      "Private Room content and private saved notes are excluded from Ask Loombus AI answer context.",
      "Ordinary Search may still show authorized private results that the AI answer does not process.",
      "Do not use an AI answer as emergency, medical, legal, financial, identity, employment, or safety verification.",
    ],
  },
  {
    id: "rooms",
    eyebrow: "Private Rooms",
    title: "Working inside Rooms",
    body: "Rooms are limited-access workspaces for communities, associations, teams, classrooms, neighborhoods, organizations, and other groups. A Room can combine discussions, announcements, calendars, Events, files, resources, Services, tasks, polls, forms, roles, invitations, and membership controls.",
    bullets: [
      "Owners and administrators manage Room settings, access, roles, and supported content.",
      "Members can use the tools allowed by their role.",
      "Room content is separate from the public Discussions directory.",
      "Private means permission-limited, not guaranteed confidential.",
    ],
    callout: {
      title: "Respect Room boundaries",
      body: "Do not share member lists, messages, files, forms, or other Room material outside the intended audience without permission or a lawful basis.",
      href: "/rooms",
      label: "Open Rooms",
    },
  },
  {
    id: "messages",
    eyebrow: "Communication",
    title: "Private messages",
    body: "Messages support direct conversations connected to Loombus activity. Recipients can copy or disclose messages, so do not treat messaging as an absolute-confidentiality channel.",
    bullets: [
      "Keep conversations relevant, lawful, and respectful.",
      "Do not send passwords, verification codes, full payment information, or material you cannot lawfully share.",
      "Use blocking when contact needs to stop.",
      "Use reporting or Support for harassment, scams, threats, unsafe contact, or prohibited files.",
    ],
  },
  {
    id: "saved",
    eyebrow: "Personal library",
    title: "Saved, notes, Stickies, and Reading History",
    body: "Saved is your private working library. Folders and private notes help organize material, Stickies support working memory, and Reading History helps recover recently opened discussions.",
    bullets: [
      "Save material with long-term research, decision, or reference value.",
      "Use private notes for your own context rather than public replies.",
      "Private saved notes are not included in Ask Loombus AI answer context.",
      "Do not store passwords, authentication codes, or highly sensitive records in ordinary notes.",
    ],
  },
  {
    id: "people",
    eyebrow: "Network",
    title: "People, profiles, and following",
    body: "People helps you find contributors and attributable profiles. Following builds a smaller reading circle around members whose work you want to track.",
    bullets: [
      "Profile information helps readers understand perspective and experience.",
      "A profile, badge, Signal indicator, or attribution state is not a background check.",
      "Follow people for contribution rather than popularity.",
      "Blocking limits supported interaction but cannot prevent every public or off-platform contact.",
    ],
  },
  {
    id: "local",
    eyebrow: "Real-world discovery",
    title: "Loombus Local",
    body: "Local brings Businesses, Services, Requests, Jobs, Events, Marketplace listings, and remote opportunities into one place. Supported filters can include text, type, place, radius, remote status, Event date, and availability.",
    bullets: [
      "Distance is an estimate based on the location information available.",
      "Ordinary public distance results are designed not to expose stored exact coordinates.",
      "Written addresses, photos, venues, or descriptions can still reveal a precise location.",
      "Current Local ranking is not sponsored placement or pay-to-rank.",
    ],
    callout: {
      title: "Verify before acting",
      body: "A Local result is a discovery result, not a guarantee that a person, business, item, job, provider, or Event is safe, licensed, available, or suitable.",
      href: "/local",
      label: "Open Local",
    },
  },
  {
    id: "businesses-services",
    eyebrow: "Providers",
    title: "Businesses and Services",
    body: "Businesses provides attributable organization profiles. Services describes what a member or business offers, where it is available, and how a requester can make contact or request an appointment.",
    bullets: [
      "Review the responsible profile, service area, scope, price information, qualifications, and limitations.",
      "Attribution or directory approval is not licensing, insurance, background, or quality verification.",
      "Send only the information needed for an inquiry.",
      "Use qualified professionals and independent verification for high-risk work.",
    ],
  },
  {
    id: "requests-matches",
    eyebrow: "Needs and compatibility",
    title: "Requests and Intelligent Matching",
    body: "Requests lets members describe a service, recommendation, quote, consultation, community-help, or problem-solving need. Intelligent Matching can suggest Request-to-Service or Service-to-Request compatibility.",
    bullets: [
      "Describe the need, timing, budget, location, remote status, and constraints accurately.",
      "A match is a suggestion, not an offer, acceptance, endorsement, or contract.",
      "Review qualifications, price, safety, identity, and fit independently.",
      "Dismiss or report a match that is irrelevant, misleading, or unsafe.",
    ],
  },
  {
    id: "appointments",
    eyebrow: "Scheduling",
    title: "Appointments",
    body: "Appointments helps providers define appointment Services and helps members request or manage supported appointment activity.",
    bullets: [
      "Review the provider, time zone, location or remote method, duration, price, and cancellation terms.",
      "A request is not confirmed until the applicable status says it is confirmed.",
      "Loombus does not guarantee attendance, availability, quality, emergency response, or refunds.",
      "Use ordinary messaging or Support when an appointment record is incorrect or unsafe.",
    ],
  },
  {
    id: "marketplace",
    eyebrow: "Commerce discovery",
    title: "Marketplace",
    body: "Marketplace connects attributable sellers and potential buyers without sponsored placement or pay-to-rank in the current directory.",
    bullets: [
      "Review the item, condition, photos, price, seller, location, and delivery expectations.",
      "Loombus generally does not hold funds, inspect items, provide escrow, or guarantee delivery.",
      "Avoid gift cards, overpayment checks, credential requests, or pressure to pay before verification.",
      "Report illegal, stolen, counterfeit, recalled, deceptive, or unsafe listings.",
    ],
  },
  {
    id: "jobs",
    eyebrow: "Employment",
    title: "Jobs",
    body: "Jobs connects attributable employer or poster profiles with people seeking work. Loombus is a discovery tool, not an employer, recruiter, payroll provider, or background-check service unless expressly stated.",
    bullets: [
      "Verify the employer independently before sharing sensitive information.",
      "Review compensation, classification, location or remote status, qualifications, and application instructions.",
      "Do not pay for a job, deposit a check and return money, or reship packages for an unverified employer.",
      "Report fake roles, discriminatory or illegal postings, trafficking, pyramid schemes, and credential harvesting.",
    ],
  },
  {
    id: "events",
    eyebrow: "Dates and organizers",
    title: "Events",
    body: "Events connects accountable organizers with people seeking in-person or remote activities and can support calendar and reminder workflows.",
    bullets: [
      "Review the organizer, date, time, venue or remote link, cost, age limits, accessibility, and cancellation information.",
      "The organizer is responsible for permits, capacity, safety, venue rules, and promised refunds.",
      "Loombus does not guarantee Event safety, accuracy, attendance, or organizer performance.",
      "Report fake Events, unauthorized ticket offers, dangerous activity, fraud, or harassment.",
    ],
  },
  {
    id: "alerts",
    eyebrow: "Signal Inbox",
    title: "Notifications, reminders, and alerts",
    body: "The Signal Inbox brings together replies, mentions, follows, messages, Room activity, reminders, appointment activity, and supported system notices.",
    bullets: [
      "Use filters and read states to manage a busy inbox.",
      "Push delivery depends on device permission, registration, network, and operating-system behavior.",
      "Manage in-app, device, topic, and supported email preferences in Settings.",
      "A notification can be delayed or fail, so do not rely on it as the only reminder for a critical obligation.",
    ],
  },
  {
    id: "ai-usage",
    eyebrow: "Account-level AI",
    title: "AI Usage",
    body: "AI Usage shows the current plan, monthly metered activity, generated and cached results, failures, feature buckets, limits, and recent AI-assisted events for the signed-in account.",
    bullets: [
      "Cached outputs may be treated differently from newly generated outputs.",
      "Monthly limits depend on entitlement and feature bucket.",
      "Extra AI Packs can add supported usage when offered.",
      "An unavailable or failed AI action does not mean the source content was removed.",
    ],
    callout: {
      title: "Open the account-level meter",
      body: "AI Usage contains private plan and activity information for the current account.",
      href: "/ai-usage",
      label: "Open AI Usage",
    },
  },
  {
    id: "premium",
    eyebrow: "Subscriptions",
    title: "Premium, Premium Plus, and plan limits",
    body: "Paid plans can add expanded AI usage, longer or more frequent Video Context, creator or supporter tools, advanced organization, Room capabilities, and other benefits shown on the current plan page.",
    bullets: [
      "Core discussion, Rooms, Search, following, messaging, calendar viewing, profiles, Signal, basic State, saved items, and supported Video Context remain available without a paid plan.",
      "Review the active plan page and checkout before purchasing.",
      "Manage the subscription through the channel that billed it.",
      "Review the Refund Policy for web and app-store billing boundaries.",
    ],
  },
  {
    id: "appearance",
    eyebrow: "Interface",
    title: "Light, Dark, and System",
    body: "Appearance changes the visual mode on the current device. It does not change content visibility, account permissions, subscription, Room membership, or privacy settings.",
    bullets: [
      "Light uses the brighter Loombus workspace.",
      "Dark uses the low-light workspace.",
      "System follows the device appearance setting.",
      "Report contrast, selected-state, focus, or readability problems through Accessibility Support.",
    ],
  },
  {
    id: "safety",
    eyebrow: "Trust center",
    title: "Safety, privacy, policies, and support",
    body: "Loombus includes reporting, blocking, moderation, access controls, listing review, age-safety protections, account restrictions, and support workflows. These tools reduce risk but do not replace emergency services or independent verification.",
    bullets: [
      "Use the closest in-product report control for a specific record.",
      "Block a member when interaction needs to stop.",
      "Review Community Guidelines, Safety, Privacy, Terms, Cookie Use, Accessibility, Refund, and DMCA information.",
      "Use Support for unresolved account, billing, safety, accessibility, rights, or technical concerns.",
    ],
    callout: {
      title: "Need a direct answer?",
      body: "The Support center searches complete platform guidance and accepts structured requests without requiring you to identify an internal team.",
      href: "/support",
      label: "Open Support",
    },
  },
];

export default function LoombusGuidePage() {
  return (
    <PageShell width="xl">
      <PageHeader
        eyebrow="Loombus Guide"
        title="How the complete Loombus platform fits together."
        description={
          <>
            Use this guide to understand public knowledge, Signal, Search Everything,
            AI-assisted answers, private Rooms, personal libraries, Local, real-world
            directories, subscriptions, and trust boundaries.
          </>
        }
      >
        <Link href="/support" className={styles.footerAction}>
          Search Support
        </Link>
      </PageHeader>

      <nav className={styles.guideJumpPanel} aria-label="Loombus guide sections">
        <div className={styles.guideJumpHeading}>
          <strong>Jump to a workspace</strong>
          <span>{guideSections.length} guide sections</span>
        </div>
        <div className={styles.guideJumpGrid}>
          {guideSections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className={styles.guideJumpLink}
            >
              {section.title}
            </a>
          ))}
        </div>
      </nav>

      <div className={styles.guideSections}>
        {guideSections.map((section, index) => (
          <Panel key={section.id} className={styles.guideSection}>
            <div className={styles.guideSectionTopline}>
              <div>
                <p>{section.eyebrow}</p>
                <h2 id={section.id}>
                  {index + 1}. {section.title}
                </h2>
              </div>
              <span>{String(index + 1).padStart(2, "0")}</span>
            </div>

            <p className={styles.guideBody}>{section.body}</p>

            <ul className={styles.guideBulletList}>
              {section.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>

            {section.callout && (
              <div className={styles.guideCallout}>
                <div>
                  <strong>{section.callout.title}</strong>
                  <p>{section.callout.body}</p>
                </div>
                {section.callout.href && section.callout.label && (
                  <Link href={section.callout.href}>
                    {section.callout.label}
                  </Link>
                )}
              </div>
            )}
          </Panel>
        ))}
      </div>
    </PageShell>
  );
}
