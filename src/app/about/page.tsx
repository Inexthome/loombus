import type { Metadata } from "next";
import Link from "next/link";
import {
  PublicPolicyPage,
  type PublicPolicySection,
} from "@/components/public-policy-page";

export const metadata: Metadata = {
  title: "About Loombus | Loombus",
  description:
    "Learn how Loombus connects knowledge, people, private communities, local discovery, services, commerce, and AI-assisted understanding around Signal over noise.",
  alternates: {
    canonical: "https://loombus.com/about",
  },
};

const sections: PublicPolicySection[] = [
  {
    id: "purpose",
    title: "Why Loombus Exists",
    paragraphs: [
      <>
        Most online platforms are organized around feeds, reaction loops,
        popularity signals, advertising pressure, and content that disappears as
        quickly as it arrives. Loombus is built around a different premise:
        knowledge, useful context, credible contribution, real-world coordination,
        and thoughtful disagreement should remain findable and useful.
      </>,
      <>
        The platform principle is <strong className="text-zinc-200">Signal over noise</strong>.
        Signal means substance that helps someone understand, decide, connect,
        organize, solve, learn, or act. It is not a promise that every post,
        listing, match, AI answer, or recommendation is correct.
      </>,
    ],
  },
  {
    id: "everything-knowledge-platform",
    title: "An Everything Knowledge Platform",
    paragraphs: [
      <>
        Loombus is growing beyond a discussion feed into an everything knowledge
        platform. It brings together public discussions, structured replies,
        people, topics, saved learning, private Rooms, files, calendars,
        businesses, services, requests, jobs, events, marketplace listings,
        appointments, local discovery, and intelligent matching.
      </>,
      <>
        “Everything” describes the breadth of useful activity that can be organized
        inside Loombus. It does not mean that Loombus contains the entire internet,
        verifies every claim, replaces every specialized service, or guarantees
        that every category is available in every location.
      </>,
    ],
  },
  {
    id: "structured-knowledge",
    title: "Structured Discussions and Durable Knowledge",
    paragraphs: [
      <>
        Discussions can be organized as open discussions, debates, research
        questions, or problem-solving threads. Topic, Reality Lens, purpose, tags,
        sources, attachments, and structured fields give readers context before
        they reply.
      </>,
      <>
        The State of the Discussion can present summaries, key takeaways, what
        changed, disagreement structure, conversation maps, related ideas, and
        other tools that help members understand a thread without replacing the
        original discussion or the judgment of its participants.
      </>,
    ],
  },
  {
    id: "search",
    title: "Search Everything Inside Loombus",
    paragraphs: [
      <>
        Loombus Search is designed to find authorized content and destinations
        inside Loombus. Depending on your access, results may include discussions,
        replies, people, topics, public pages, saved items, private Room content,
        Room resources, files, events, services, businesses, jobs, marketplace
        listings, requests, and other platform records.
      </>,
      <>
        Loombus Search is not Google Search and is not a general search of the open
        web. Results are governed by Loombus permissions, indexing, visibility,
        relevance, safety controls, and feature availability. Private content is
        not made public merely because it is searchable by an authorized member.
      </>,
    ],
  },
  {
    id: "ai",
    title: "AI-Assisted Understanding",
    paragraphs: [
      <>
        Ask Loombus AI and related tools can organize, summarize, rewrite, compare,
        or explain content using Loombus sources that the feature is permitted to
        process. Where source links are shown, members can open the underlying
        material and evaluate the answer.
      </>,
      <>
        AI output can be incomplete, inaccurate, or misleading. It is assistance,
        not authority. Private Room content and private saved notes are excluded
        from Ask Loombus AI answer context even though authorized members may be
        able to find some private content through ordinary search.
      </>,
    ],
  },
  {
    id: "rooms",
    title: "Private Rooms and Shared Workspaces",
    paragraphs: [
      <>
        Rooms are member-controlled spaces for communities, associations,
        classrooms, organizations, teams, neighborhoods, families, and other
        groups. A Room may include discussions, announcements, calendars, events,
        files, resources, tasks, polls, forms, services, roles, invitations, and
        membership controls.
      </>,
      <>
        “Private” means access is limited by Room permissions. It does not create
        an absolute guarantee of confidentiality. Room members can copy or share
        what they can access, Room owners and authorized administrators may manage
        content, and Loombus may review or preserve records for safety, support,
        security, legal compliance, or enforcement.
      </>,
    ],
  },
  {
    id: "real-world",
    title: "Real-World Discovery and Coordination",
    paragraphs: [
      <>
        Loombus Local brings attributable businesses, services, requests, jobs,
        events, marketplace listings, and remote opportunities into one discovery
        experience. Members may filter by text, place, distance, category,
        availability, remote status, or event date where supported.
      </>,
      <>
        Local distance and relevance are designed to support useful discovery
        without exposing exact stored coordinates to the public. Loombus does not
        use sponsored placement or pay-to-rank in the current Local and Marketplace
        directories. Availability, ranking, and filters may change as the service
        develops.
      </>,
    ],
  },
  {
    id: "matching",
    title: "Requests, Services, Appointments, and Matching",
    paragraphs: [
      <>
        Members and attributable organizations can describe services they offer,
        needs they are trying to solve, and appointment options. Intelligent
        Matching can identify possible Request-to-Service or Service-to-Request
        compatibility based on structured information.
      </>,
      <>
        A match is a suggestion, not an endorsement, credential check, guarantee,
        contract, background check, insurance verification, or promise of quality.
        The people involved remain responsible for evaluating identity,
        qualifications, price, safety, legality, and fit.
      </>,
    ],
  },
  {
    id: "commerce-employment-events",
    title: "Marketplace, Jobs, and Events",
    paragraphs: [
      <>
        Marketplace listings connect attributable sellers with potential buyers.
        Jobs connect attributable employers or posters with potential applicants.
        Events connect organizers with people seeking real-world or virtual
        activities.
      </>,
      <>
        Loombus provides discovery, communication, and organizational tools. Unless
        Loombus expressly says otherwise for a specific transaction, it is not the
        seller, employer, recruiter, service provider, event organizer, landlord,
        insurer, licensing authority, escrow service, or party to an agreement
        between members.
      </>,
    ],
  },
  {
    id: "signal-score",
    title: "Signal and Contribution",
    paragraphs: [
      <>
        Signal indicators may consider useful activity such as discussion quality,
        replies, saves, clarity, evidence, participation, or other platform
        signals. They are intended to support discovery and reflection rather than
        popularity contests.
      </>,
      <>
        A Signal Score, badge, match score, profile label, or platform ranking is
        not a credit score, identity verification, professional license,
        employment reference, safety certification, or guarantee that a person or
        claim is trustworthy.
      </>,
    ],
  },
  {
    id: "membership",
    title: "Free Access and Optional Subscriptions",
    paragraphs: [
      <>
        Core participation remains available without a paid subscription,
        including supported discussion, Room, search, following, messaging,
        calendar-viewing, profile, Signal, basic State of the Discussion, saved,
        and Video Context features.
      </>,
      <>
        Premium and Premium Plus may add expanded AI usage, longer or more frequent
        Video Context, creator or supporter tools, advanced organization,
        additional Room capabilities, and other benefits described on the current
        plan page. Plans, limits, and features can change.
      </>,
    ],
  },
  {
    id: "video",
    title: "Video Context and Attachments",
    paragraphs: [
      <>
        Video Context lets a member add a limited video to support a written
        discussion. A written discussion remains required, and videos do not
        autoplay or display a public view count. Current plan limits are described
        on the Premium and creation pages.
      </>,
      <>
        Loombus may also support images, PDFs, Room files, marketplace images,
        business materials, event information, and other uploads. Members remain
        responsible for rights, accuracy, safety, accessibility, and lawful use of
        uploaded material.
      </>,
    ],
  },
  {
    id: "not-a-replacement",
    title: "What Loombus Does Not Replace",
    bullets: [
      <>independent judgment and verification;</>,
      <>licensed legal, medical, financial, tax, investment, mental-health, or safety advice;</>,
      <>emergency services or crisis response;</>,
      <>professional licensing, insurance, background checks, or government records;</>,
      <>a binding guarantee of identity, quality, availability, employment, payment, or performance;</>,
      <>the original source material behind an AI summary or search result.</>,
    ],
  },
  {
    id: "values",
    title: "What Loombus Values",
    bullets: [
      <>thoughtful contribution over reactive posting;</>,
      <>credible context over empty engagement;</>,
      <>organized knowledge over disposable scrolling;</>,
      <>constructive disagreement over personal attack;</>,
      <>attributable real-world activity over anonymous manipulation;</>,
      <>privacy-aware access controls over indiscriminate exposure;</>,
      <>AI that supports human understanding rather than replacing responsibility;</>,
      <>clean discovery without sponsored placement or pay-to-rank where Loombus states that model applies.</>,
    ],
  },
  {
    id: "trust-center",
    title: "Trust, Safety, and Transparency",
    paragraphs: [
      <>
        Loombus publishes separate{" "}
        <Link href="/guidelines" className="text-zinc-200 underline-offset-4 hover:underline">
          Community Guidelines
        </Link>
        ,{" "}
        <Link href="/safety" className="text-zinc-200 underline-offset-4 hover:underline">
          Safety information
        </Link>
        ,{" "}
        <Link href="/privacy" className="text-zinc-200 underline-offset-4 hover:underline">
          Privacy Policy
        </Link>
        ,{" "}
        <Link href="/terms" className="text-zinc-200 underline-offset-4 hover:underline">
          Terms of Service
        </Link>
        , and{" "}
        <Link href="/accessibility" className="text-zinc-200 underline-offset-4 hover:underline">
          Accessibility information
        </Link>{" "}
        so members can understand the expectations and limitations attached to
        each part of the platform.
      </>,
      <>
        Questions and concerns can be submitted through{" "}
        <Link href="/support" className="text-zinc-200 underline-offset-4 hover:underline">
          Loombus Support
        </Link>
        .
      </>,
    ],
  },
];

export default function AboutPage() {
  return (
    <PublicPolicyPage
      eyebrow="About"
      title="About Loombus"
      description={
        <>
          Loombus is an everything knowledge platform built for Signal over noise.
          It connects structured discussion, people, private communities, real-world
          discovery, services, commerce, and AI-assisted understanding in one place.
        </>
      }
      sections={sections}
      reviewedDate="July 18, 2026"
    />
  );
}
