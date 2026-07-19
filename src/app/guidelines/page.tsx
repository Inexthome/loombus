import type { Metadata } from "next";
import Link from "next/link";
import {
  PublicPolicyPage,
  type PublicPolicySection,
} from "@/components/public-policy-page";

const supportEmail = "support@loombus.com";

export const metadata: Metadata = {
  title: "Community Guidelines | Loombus",
  description:
    "Community standards for Loombus discussions, Rooms, messages, listings, businesses, services, requests, jobs, events, marketplace activity, AI use, and platform integrity.",
  alternates: {
    canonical: "https://loombus.com/guidelines",
  },
};

const sections: PublicPolicySection[] = [
  {
    id: "scope",
    title: "Scope of These Guidelines",
    paragraphs: [
      <>
        These Guidelines apply across Loombus, including discussions, replies,
        profiles, messages, private Rooms, Room resources, files, polls, forms,
        events, businesses, services, requests, jobs, marketplace listings,
        appointments, local discovery, matches, AI-assisted features, reports,
        support requests, and any other feature connected to a Loombus account.
      </>,
      <>
        Content can violate these Guidelines even when it is not public. Privacy or
        Room membership does not permit harassment, exploitation, fraud, illegal
        activity, unsafe contact, malware, infringement, or abuse of another
        person.
      </>,
    ],
  },
  {
    id: "signal",
    title: "Signal Over Noise",
    paragraphs: [
      <>
        Loombus exists to help people inform, explore, question, clarify, analyze,
        teach, organize, solve, or constructively challenge. Members should provide
        enough context for others to understand the purpose of a discussion,
        listing, request, service, event, job, or other contribution.
      </>,
      <>
        Repetitive posting, meaningless engagement farming, fabricated urgency,
        keyword stuffing, link dumping, misleading tags, fake scarcity, and
        low-effort content designed only to attract attention may be limited or
        removed.
      </>,
    ],
  },
  {
    id: "disagreement",
    title: "Respectful Disagreement and Good-Faith Participation",
    paragraphs: [
      <>
        Members may strongly challenge ideas, evidence, policies, institutions,
        products, services, organizations, and public claims. Criticism should
        address the substance rather than becoming a campaign of personal abuse.
      </>,
      <>
        Do not derail discussions through repeated bad-faith demands, sealioning,
        dogpiling, intimidation, deliberate misquotation, fabricated evidence,
        coordinated disruption, or attempts to punish someone for a lawful
        viewpoint.
      </>,
    ],
  },
  {
    id: "harassment",
    title: "Harassment, Threats, Stalking, and Targeted Abuse",
    bullets: [
      <>threatening, encouraging, celebrating, or coordinating violence or serious harm;</>,
      <>repeated unwanted contact after a person has clearly asked for it to stop;</>,
      <>stalking, tracking, coercion, blackmail, extortion, intimidation, or doxxing;</>,
      <>targeted slurs, humiliation, sexual harassment, degrading edits, or abusive dogpiling;</>,
      <>using multiple accounts, Rooms, messages, listings, or support requests to continue blocked contact;</>,
      <>encouraging others to contact, report, review, follow, confront, or punish a target;</>,
      <>threatening a person’s employment, housing, family, immigration status, education, reputation, or safety as a method of coercion.</>,
    ],
  },
  {
    id: "hate",
    title: "Hate, Dehumanization, and Protected Groups",
    paragraphs: [
      <>
        Loombus does not allow attacks, dehumanization, exclusion, harassment, or
        violence directed at people because of protected characteristics or
        identity-based traits. This includes slurs, claims that a group is
        inherently subhuman or dangerous, praise for identity-based violence, and
        calls to deny basic rights or participation through unlawful discrimination.
      </>,
      <>
        Educational, documentary, counterspeech, news, research, or historical
        discussion may include sensitive material when the context is clear and
        the purpose is not to praise, recruit, threaten, or target.
      </>,
    ],
  },
  {
    id: "minors",
    title: "Child Safety and Teen Protection",
    bullets: [
      <>sexual exploitation material, sexualized depictions of minors, grooming, or attempts to obtain sexual material from a minor;</>,
      <>unsafe adult-to-minor contact, secrecy demands, coercion, manipulation, trafficking, or requests to move a minor into a hidden channel;</>,
      <>content that identifies or exposes a minor’s precise location, school routine, private contact information, or other sensitive details without a legitimate and lawful reason;</>,
      <>selling, requesting, or facilitating age-restricted or illegal goods or services to minors;</>,
      <>using jobs, casting, mentorship, services, marketplace listings, Rooms, or events as a pretext for exploitation.</>,
    ],
    paragraphs: [
      <>
        Members under 13 may not use Loombus. Users ages 13 through 17 may receive
        Teen Safety Mode protections. Adults must exercise additional care when
        interacting with teens and must not exploit differences in age, authority,
        employment, education, housing, money, or access.
      </>,
    ],
  },
  {
    id: "self-harm",
    title: "Self-Harm, Suicide, Violence, and Dangerous Activity",
    paragraphs: [
      <>
        Do not encourage, instruct, celebrate, pressure, or coordinate self-harm,
        suicide, violent wrongdoing, abuse, torture, trafficking, terrorism,
        dangerous challenges, or other conduct likely to cause serious injury.
      </>,
      <>
        Good-faith recovery, prevention, news, research, and support discussions
        are allowed when they do not provide operational assistance for harm or
        target a vulnerable person. Loombus is not an emergency service.
      </>,
    ],
  },
  {
    id: "privacy",
    title: "Privacy, Doxxing, and Non-Consensual Material",
    bullets: [
      <>home addresses, precise live locations, private phone numbers, private email addresses, credentials, authentication tokens, or government identifiers;</>,
      <>financial account details, card information, medical records, educational records, confidential business records, or protected legal communications;</>,
      <>non-consensual intimate images, sexual recordings, private images, or manipulated intimate material;</>,
      <>private Room content, messages, files, forms, or member lists shared outside their intended audience without permission or a valid legal basis;</>,
      <>personal data collected through scraping, data brokerage, credential stuffing, or deceptive forms.</>,
    ],
    paragraphs: [
      <>
        Publicly available information can still be abusive when compiled or
        presented to enable harassment, discrimination, fraud, or physical harm.
      </>,
    ],
  },
  {
    id: "identity-deception",
    title: "Identity, Impersonation, Deception, and Fraud",
    bullets: [
      <>impersonating a person, employer, business, public agency, professional, organizer, seller, or Loombus representative;</>,
      <>misrepresenting affiliation, authority, credentials, licenses, insurance, ownership, location, availability, inventory, compensation, or pricing;</>,
      <>phishing, advance-fee fraud, fake checks, overpayment schemes, romance scams, investment scams, account recovery scams, or payment diversion;</>,
      <>fabricated reviews, endorsements, testimonials, applications, references, work history, attendance, transactions, or engagement;</>,
      <>coordinated inauthentic behavior, undisclosed bot networks, sockpuppet accounts, or attempts to manufacture consensus;</>,
      <>using synthetic media or AI content to falsely depict a real person, event, product, property, document, credential, or result.</>,
    ],
  },
  {
    id: "misinformation",
    title: "Harmful Misinformation and Misleading Claims",
    paragraphs: [
      <>
        Members should distinguish fact, opinion, prediction, satire, personal
        experience, and allegation. Sources should be represented honestly. Do not
        knowingly alter context, fabricate citations, present an AI output as
        verified evidence, or make materially false claims that create a
        foreseeable risk of fraud, injury, unlawful discrimination, or public harm.
      </>,
      <>
        Loombus may label, reduce visibility, remove, or require clarification for
        content that appears materially deceptive, dangerous, manipulated, or
        falsely authoritative. Disagreement alone is not a violation.
      </>,
    ],
  },
  {
    id: "rooms-messages",
    title: "Private Rooms, Messages, and Shared Workspaces",
    bullets: [
      <>respect Room membership, role, invitation, and content-access boundaries;</>,
      <>do not enter, remain in, copy from, or distribute material from a Room through deception or technical bypass;</>,
      <>do not use a Room, message thread, form, poll, calendar, task, or file area to coordinate prohibited conduct;</>,
      <>Room owners and moderators must not use their authority for retaliation, coercion, unlawful discrimination, surveillance abuse, or concealment of serious safety concerns;</>,
      <>do not upload malware, credential-harvesting documents, unsafe macros, or files designed to compromise a member or device.</>,
    ],
    paragraphs: [
      <>
        Room owners are responsible for setting clear expectations and managing
        access responsibly. Loombus may enforce platform-wide rules regardless of
        a Room’s internal rules.
      </>,
    ],
  },
  {
    id: "marketplace",
    title: "Marketplace Listings and Transactions",
    paragraphs: [
      <>
        Marketplace listings must accurately describe the item, condition, price,
        seller, material limitations, pickup or delivery expectations, and any
        known safety issue. Stock images, edited images, or AI-generated images
        must not create a materially false impression of the actual item.
      </>,
    ],
    bullets: [
      <>illegal, stolen, counterfeit, fraudulently obtained, recalled, or dangerously defective goods;</>,
      <>firearms, ammunition, explosives, destructive devices, or regulated weapons where listing or transfer would be unlawful or unsafe;</>,
      <>controlled substances, illicit drugs, prescription drugs, illegal drug paraphernalia, or regulated medical products offered unlawfully;</>,
      <>human remains, exploitative sexual material, sexual services, trafficking-related offers, or material involving child exploitation;</>,
      <>stolen credentials, financial accounts, identity documents, private data, access tokens, hacked accounts, malware, or circumvention tools;</>,
      <>wildlife, protected species, hazardous materials, or regulated goods offered contrary to law;</>,
      <>pyramid schemes, deceptive investment opportunities, fake giveaways, gambling schemes, or listings designed primarily to move a user into a scam.</>,
    ],
  },
  {
    id: "business-services",
    title: "Businesses, Services, Requests, and Appointments",
    bullets: [
      <>business and provider profiles must identify the responsible person or organization accurately;</>,
      <>services must not claim licenses, certifications, insurance, bonding, experience, results, or availability that the provider does not have;</>,
      <>requests must describe a legitimate need and may not solicit illegal, exploitative, discriminatory, dangerous, or deceptive work;</>,
      <>appointment availability, cancellation terms, pricing, deposits, locations, and remote or in-person status must be represented accurately;</>,
      <>providers must not use inquiries, requests, appointments, or matches to harvest data, pressure users, evade consent, or impose undisclosed fees;</>,
      <>emergency medical, mental-health, legal, financial, electrical, security, or other high-risk services must not be presented in a way that falsely implies Loombus verification or guaranteed suitability.</>,
    ],
  },
  {
    id: "jobs",
    title: "Jobs, Hiring, and Work Opportunities",
    bullets: [
      <>job postings must identify the attributable employer or responsible poster and describe the role honestly;</>,
      <>do not post nonexistent jobs, fake interviews, reshipping schemes, mystery-shopper scams, check-cashing schemes, trafficking offers, or work that requires unlawful conduct;</>,
      <>do not demand payment, gift cards, cryptocurrency, credentials, account access, or unnecessary sensitive information as a condition of applying;</>,
      <>compensation, classification, location, remote status, schedule, qualifications, sponsorship, and material conditions must not be intentionally misleading;</>,
      <>employment discrimination, harassment, retaliation, or exclusion that violates applicable law is prohibited;</>,
      <>recruiting for deceptive multi-level marketing, pyramid, or investment schemes is prohibited.</>,
    ],
    paragraphs: [
      <>
        Loombus does not verify every employer, applicant, license, background,
        compensation claim, or job condition. Employers and applicants must perform
        their own due diligence.
      </>,
    ],
  },
  {
    id: "events",
    title: "Events and Organizers",
    bullets: [
      <>organizers must accurately state the organizer, date, time, location or remote access, admission terms, age restrictions, accessibility information, and cancellation conditions where applicable;</>,
      <>do not create fake events, bait-and-switch events, unauthorized ticket offers, unsafe gatherings, or events designed to facilitate fraud, exploitation, violence, or illegal activity;</>,
      <>organizers are responsible for lawful operation, permits, capacity, safety planning, venue rules, refunds they promise, and communications with attendees;</>,
      <>attendees must follow lawful organizer and venue rules and must not use events to stalk, harass, disrupt, or endanger others.</>,
    ],
  },
  {
    id: "local-matches",
    title: "Local Discovery, Distance, and Intelligent Matching",
    paragraphs: [
      <>
        Do not manipulate Local or matching results through false addresses,
        fabricated service areas, misleading remote status, duplicate records,
        fake availability, keyword stuffing, coordinated engagement, or attempts
        to bypass approval and trust controls.
      </>,
      <>
        A distance estimate, compatibility score, suggested match, directory
        position, approval state, or “attributable” label is not an endorsement,
        credential verification, safety guarantee, or promise that a transaction
        will succeed.
      </>,
    ],
  },
  {
    id: "ai",
    title: "AI-Assisted Content and Automation",
    bullets: [
      <>review AI-assisted content before publishing, sending, listing, applying, or relying on it;</>,
      <>do not use AI to generate harassment, fraud, impersonation, fake evidence, fake reviews, fake applicants, fake listings, synthetic endorsements, malicious code, or prohibited instructions;</>,
      <>do not represent an AI answer, summary, rewrite, match, or citation as human-verified when it has not been verified;</>,
      <>do not submit confidential, privileged, regulated, or third-party information without authority;</>,
      <>do not automate scraping, bulk messaging, applications, listings, follows, reports, reviews, or engagement without written authorization;</>,
      <>do not attempt to extract hidden instructions, private data, security secrets, or content outside your permitted access.</>,
    ],
    paragraphs: [
      <>
        Ask Loombus AI is grounded in permitted Loombus sources, not the open web.
        An answer can still omit context or be wrong. Private Room content and
        private saved notes are not used as Ask Loombus AI answer context.
      </>,
    ],
  },
  {
    id: "search",
    title: "Search, Indexing, and Discovery Integrity",
    bullets: [
      <>do not use search to stalk, profile, discriminate against, or endanger another person;</>,
      <>do not reverse engineer, scrape, export, or bulk collect search results or private records without permission;</>,
      <>do not manipulate titles, tags, locations, categories, metadata, files, or repeated content to dominate results;</>,
      <>do not use discovered private or restricted material outside the purpose for which access was granted;</>,
      <>respect removals, visibility changes, blocks, Room permissions, and account restrictions.</>,
    ],
  },
  {
    id: "intellectual-property",
    title: "Intellectual Property, Publicity Rights, and Attribution",
    paragraphs: [
      <>
        Post only material you created, licensed, or are otherwise legally allowed
        to use. This applies to text, images, videos, PDFs, logos, product photos,
        business materials, event materials, job descriptions, marketplace
        listings, Room files, and AI-assisted content.
      </>,
      <>
        Copyright concerns can be reviewed through the{" "}
        <Link href="/dmca" className="text-zinc-200 underline-offset-4 hover:underline">
          Copyright and DMCA Process
        </Link>
        . Trademark, publicity, privacy, impersonation, or other rights concerns
        may be submitted through{" "}
        <Link href="/support?category=legal" className="text-zinc-200 underline-offset-4 hover:underline">
          Support
        </Link>
        .
      </>,
    ],
  },
  {
    id: "security",
    title: "Platform Security and Technical Misuse",
    bullets: [
      <>malware, phishing, credential theft, malicious links, harmful code, denial-of-service activity, or unauthorized access;</>,
      <>probing, scanning, reverse engineering, circumventing, exploiting, or testing security controls without written authorization;</>,
      <>scraping, crawling, harvesting, bulk downloading, model training, or database reconstruction without written permission;</>,
      <>bypassing rate limits, subscriptions, paywalls, age controls, moderation, suspensions, blocks, Room access, or feature restrictions;</>,
      <>interfering with platform operations, audit logs, payment processing, notifications, search indexes, files, AI systems, or support workflows;</>,
      <>sharing vulnerabilities publicly before Loombus has a reasonable opportunity to review and address them.</>,
    ],
  },
  {
    id: "reports",
    title: "Reporting, Blocking, Reviews, and Support",
    paragraphs: [
      <>
        Use in-product reporting for a specific discussion, reply, profile, message,
        Room item, listing, job, event, service, request, or other record when a
        report control is available. Blocking is available to limit unwanted
        contact, but cannot prevent every form of visibility or offline contact.
      </>,
      <>
        False reports, coordinated reporting attacks, retaliatory reviews, abusive
        support requests, fabricated evidence, threats to force moderation action,
        and attempts to reveal a reporter’s identity are prohibited.
      </>,
    ],
  },
  {
    id: "paid",
    title: "Subscriptions and Paid Features",
    paragraphs: [
      <>
        Paid access does not create immunity from these Guidelines, preferential
        moderation, guaranteed visibility, guaranteed AI accuracy, or a right to
        continue using a feature after a violation. Loombus may restrict paid or
        free features when necessary to address abuse, safety, fraud, billing, or
        platform integrity.
      </>,
    ],
  },
  {
    id: "enforcement",
    title: "Moderation and Enforcement",
    paragraphs: [
      <>
        Loombus may warn, label, reduce visibility, remove, disable, quarantine,
        reject, pause, preserve, investigate, restrict, suspend, terminate, or
        refuse content, listings, files, features, payments, Rooms, accounts, or
        access when conduct appears to violate these Guidelines, the Terms, law,
        safety expectations, intellectual property rights, or platform integrity.
      </>,
      <>
        Enforcement may consider severity, intent, context, repetition, account
        history, harm, age-safety concerns, evasion, cooperation, credibility of
        evidence, and risk to members, Loombus, service providers, or the public.
        Loombus is not required to use every available action or to disclose
        confidential detection methods.
      </>,
    ],
  },
  {
    id: "appeals",
    title: "Appeals and Questions",
    paragraphs: [
      <>
        A member who believes an enforcement action was mistaken may submit a
        focused appeal with the affected account, URL or record, relevant context,
        and reasons the action should be reconsidered. An appeal does not guarantee
        reversal, restoration, or continued availability.
      </>,
      <>
        Questions may be submitted through{" "}
        <Link href="/support" className="text-zinc-200 underline-offset-4 hover:underline">
          Loombus Support
        </Link>{" "}
        or by email to{" "}
        <a
          href={`mailto:${supportEmail}?subject=Loombus%20Guidelines%20Question`}
          className="text-zinc-200 underline-offset-4 hover:underline"
        >
          {supportEmail}
        </a>
        .
      </>,
    ],
  },
];

export default function GuidelinesPage() {
  return (
    <PublicPolicyPage
      eyebrow="Community"
      title="Community Guidelines"
      description={
        <>
          These Guidelines establish the conduct expected across Loombus
          discussions, private Rooms, messages, files, AI tools, local discovery,
          businesses, services, requests, jobs, events, appointments, marketplace
          listings, and other platform features.
        </>
      }
      sections={sections}
      effectiveDate="July 18, 2026"
      reviewedDate="July 18, 2026"
    />
  );
}
