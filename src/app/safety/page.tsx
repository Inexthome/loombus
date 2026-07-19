import type { Metadata } from "next";
import Link from "next/link";
import {
  PublicPolicyPage,
  type PublicPolicySection,
} from "@/components/public-policy-page";

const supportEmail = "support@loombus.com";

export const metadata: Metadata = {
  title: "Safety on Loombus | Loombus",
  description:
    "Safety guidance for Loombus discussions, messages, Rooms, files, local discovery, services, jobs, events, marketplace activity, minors, reporting, blocking, and emergencies.",
  robots: {
    index: false,
    follow: true,
  },
  alternates: {
    canonical: "https://loombus.com/safety",
  },
};

const sections: PublicPolicySection[] = [
  {
    id: "emergency",
    title: "Immediate Danger and Emergencies",
    tone: "danger",
    paragraphs: [
      <>
        Loombus is not an emergency service and does not monitor reports or support
        requests continuously. If you or another person is in immediate danger,
        experiencing a medical emergency, at imminent risk of self-harm, facing a
        credible threat, or needing urgent police, fire, medical, child-protection,
        or crisis assistance, contact the appropriate local emergency or crisis
        resource immediately.
      </>,
      <>
        Do not rely on a discussion, Room, message, listing, service provider,
        event organizer, appointment, AI answer, match, report, or support request
        for emergency response. Loombus cannot dispatch help, verify a responder’s
        credentials, or guarantee that an urgent report will be seen in time.
      </>,
    ],
  },
  {
    id: "safety-tools",
    title: "How Loombus Safety Tools Work",
    paragraphs: [
      <>
        Loombus may provide reporting, blocking, warning, review, approval,
        moderation, rate-limiting, access-control, age-safety, fraud-detection,
        file-security, and account-enforcement tools. These controls reduce risk
        but cannot identify or prevent every harmful act.
      </>,
      <>
        Automated or AI-assisted signals may help prioritize review, but they can
        make mistakes. A warning, label, approval state, Signal indicator,
        attributable profile, match score, or absence of prior reports is not a
        safety certification.
      </>,
    ],
  },
  {
    id: "reporting",
    title: "Reporting Discussions, Messages, Rooms, and Real-World Listings",
    paragraphs: [
      <>
        Use the closest in-product report control when available. Reports may apply
        to discussions, replies, profiles, messages, Room activity, files,
        businesses, services, requests, jobs, events, marketplace listings,
        appointments, or other records.
      </>,
      <>
        Include the exact URL or record, username or organization, what happened,
        when it happened, why it is unsafe, and any relevant screenshots or
        supporting context. Do not alter evidence, impersonate another person, or
        place yourself at additional risk to collect proof.
      </>,
    ],
  },
  {
    id: "blocking",
    title: "Blocking and Limiting Contact",
    paragraphs: [
      <>
        Blocking can restrict supported follows, messages, discovery, and other
        interactions between accounts. It may remove mutual connections or hide
        blocked members from key areas.
      </>,
      <>
        Blocking does not erase content already shared, prevent screenshots,
        guarantee that another person cannot view public content, stop contact
        through another account or outside Loombus, or replace emergency and legal
        protection. Report serious threats or evasion in addition to blocking.
      </>,
    ],
  },
  {
    id: "harassment",
    title: "Harassment, Threats, Stalking, and Doxxing",
    paragraphs: [
      <>
        Threats, stalking, coercion, extortion, repeated unwanted contact,
        dogpiling, intimidation, non-consensual exposure of personal information,
        and attempts to move abuse across discussions, messages, Rooms, jobs,
        services, events, appointments, or marketplace interactions may lead to
        immediate restrictions.
      </>,
      <>
        Preserve relevant records without publicly reposting sensitive material.
        Secure your account, review connected email and payment accounts, and seek
        local professional or legal assistance when appropriate.
      </>,
    ],
  },
  {
    id: "minors",
    title: "Children, Teens, and Age Safety",
    paragraphs: [
      <>
        Loombus is not available to children under 13. Accurate date-of-birth and
        age-safety information may be required. Accounts identified as under 13 or
        as using false age information may be restricted or removed, with limited
        records preserved when needed for child safety, legal compliance, fraud
        prevention, or enforcement.
      </>,
      <>
        Teen Safety Mode may apply additional private-message controls,
        age-related contact checks, warning signals, visibility limits, and
        priority review for members ages 13 through 17. These controls cannot
        guarantee that every account age is accurate or that every unsafe contact
        will be detected.
      </>,
    ],
    bullets: [
      <>Adults must not sexualize, groom, coerce, exploit, recruit, or seek secret contact with a minor.</>,
      <>Do not use mentorship, employment, casting, services, appointments, Rooms, events, or marketplace activity as a pretext for unsafe access to a minor.</>,
      <>Do not share a minor’s precise location, routine, school details, private contact information, or sensitive files without a legitimate and lawful reason.</>,
      <>Parents or guardians may contact support about suspected under-13 use or a teen-safety concern.</>,
    ],
  },
  {
    id: "self-harm-violence",
    title: "Self-Harm, Suicide, Violence, and Exploitation",
    paragraphs: [
      <>
        Content that encourages, instructs, glorifies, coordinates, or pressures a
        person toward self-harm, suicide, violence, abuse, trafficking,
        exploitation, terrorism, or dangerous illegal activity may be removed and
        escalated.
      </>,
      <>
        Loombus may preserve or disclose relevant information when reasonably
        necessary to comply with law, respond to valid legal process, address a
        credible threat, protect a child, or prevent serious harm. Loombus does not
        promise that a disclosure will occur or that it will produce a particular
        outcome.
      </>,
    ],
  },
  {
    id: "account-security",
    title: "Account and Device Safety",
    bullets: [
      <>use a unique password and secure the email or identity-provider account connected to Loombus;</>,
      <>do not share passwords, verification codes, recovery links, session tokens, or device unlock credentials;</>,
      <>review unexpected login, password-reset, billing, push-notification, and email activity;</>,
      <>avoid links, QR codes, files, payment instructions, or support messages that create urgency or request credentials;</>,
      <>sign out of shared devices and protect saved sessions or biometric device unlock;</>,
      <>contact support promptly if an account, payment method, business profile, Room, or listing appears compromised.</>,
    ],
    paragraphs: [
      <>
        Loombus supports available email, Google, Apple, and device-level
        authentication experiences. Local biometric unlock is handled by the
        device operating system. Loombus does not receive a fingerprint or face
        template.
      </>,
    ],
  },
  {
    id: "messages-rooms",
    title: "Private Messages and Room Safety",
    paragraphs: [
      <>
        Treat messages and private Rooms as limited-access spaces, not as
        guaranteed confidential channels. Recipients and Room members can copy,
        download, photograph, forward, or disclose material they can access.
      </>,
      <>
        Room owners and authorized moderators can manage membership and content.
        Loombus may access, preserve, or review limited records when necessary for
        support, security, reports, abuse prevention, legal compliance, or
        enforcement. Do not place secrets, credentials, highly sensitive records,
        or information you cannot lawfully share into a Room or message.
      </>,
    ],
  },
  {
    id: "files",
    title: "Files, Images, Video, PDFs, Links, and QR Codes",
    bullets: [
      <>do not open an unexpected attachment or scan an unfamiliar QR code solely because it appears inside Loombus;</>,
      <>verify the sender, file type, destination, payment request, and claimed organization independently;</>,
      <>do not enable macros, install software, grant remote access, or enter credentials after following an untrusted file or link;</>,
      <>report malware, phishing, credential collection, non-consensual imagery, child exploitation material, or dangerous files immediately;</>,
      <>remember that file scanning and content review cannot guarantee a file is safe.</>,
    ],
  },
  {
    id: "ai-search",
    title: "Search and AI Safety",
    paragraphs: [
      <>
        Search Everything finds Loombus content and destinations that the system is
        permitted to return to you. It is not open-web search. Search results may
        be incomplete, stale, incorrectly ranked, or based on information created
        by users.
      </>,
      <>
        Ask Loombus AI produces grounded assistance from permitted Loombus sources.
        It can be wrong, omit critical details, or misunderstand a source. Private
        Room content and private saved notes are excluded from Ask Loombus AI
        answer context. Never rely on AI output alone for emergencies, medical
        treatment, legal rights, investments, employment decisions, identity
        verification, or personal safety.
      </>,
    ],
  },
  {
    id: "local",
    title: "Location and Local Discovery Safety",
    paragraphs: [
      <>
        Local Discovery may use a place, service area, distance, remote status,
        date, and approximate geographic calculations to organize results. Public
        directory results are designed not to expose stored exact coordinates, but
        a listing’s written address, event location, photos, description, or
        contact details can still reveal where a person or organization is located.
      </>,
      <>
        Avoid posting a home address, real-time routine, child’s location, private
        meeting point, or other precise location unless it is necessary, safe,
        lawful, and intended for the audience that can view it.
      </>,
    ],
  },
  {
    id: "marketplace",
    title: "Marketplace Safety",
    bullets: [
      <>verify the item, seller, condition, ownership, price, and return expectations before exchanging money;</>,
      <>avoid advance payment, gift cards, cryptocurrency, overpayment checks, payment outside agreed channels, or pressure to act before verification;</>,
      <>meet in a safe lawful location and do not enter a private location solely because a listing instructs you to do so;</>,
      <>do not share authentication codes, bank login details, full card numbers, government identifiers, or unnecessary personal records;</>,
      <>stop contact and report suspected stolen goods, counterfeits, regulated goods, trafficking, fraud, threats, or unsafe products.</>,
    ],
    paragraphs: [
      <>
        Unless a specific Loombus checkout says otherwise, Loombus does not hold
        funds, provide escrow, inspect goods, guarantee delivery, insure a
        transaction, or resolve every buyer-seller dispute.
      </>,
    ],
  },
  {
    id: "jobs",
    title: "Job and Recruiting Safety",
    bullets: [
      <>confirm the employer through an independent website, business record, known phone number, or other reliable source;</>,
      <>be cautious when an interview occurs only by text, a job is offered immediately, or compensation is unusually high for limited work;</>,
      <>do not deposit a check and send part of the money elsewhere, buy equipment from a required vendor, receive or reship packages, or move funds for an employer;</>,
      <>do not provide bank credentials, authentication codes, full identity documents, or sensitive tax information before independently verifying a legitimate hiring process;</>,
      <>report jobs involving fees, trafficking, sexual exploitation, unlawful discrimination, pyramid schemes, stolen accounts, or illegal work.</>,
    ],
  },
  {
    id: "services",
    title: "Services, Requests, Appointments, and Matches",
    paragraphs: [
      <>
        Verify a provider’s identity, license, insurance, references, scope, price,
        cancellation terms, location, and suitability when those matters are
        important. An approved profile, directory entry, match, Signal indicator,
        or appointment option is not professional verification.
      </>,
      <>
        Do not use Loombus as a substitute for emergency response. For work that
        affects health, legal rights, finances, electrical systems, structural
        safety, security, children, vulnerable adults, or other high-risk matters,
        use appropriately qualified professionals and independent verification.
      </>,
    ],
  },
  {
    id: "events",
    title: "Event Safety",
    bullets: [
      <>verify the organizer, venue, date, access terms, refund conditions, age limits, and accessibility information;</>,
      <>tell a trusted person where you are going when appropriate and maintain your own transportation and communication plan;</>,
      <>follow lawful venue capacity, security, health, and emergency instructions;</>,
      <>report fake events, unauthorized ticket sales, hidden location changes, unsafe conduct, harassment, exploitation, or requests for unusual payment or credentials.</>,
    ],
  },
  {
    id: "business",
    title: "Business and Organization Safety",
    paragraphs: [
      <>
        Attributable business or organization information improves accountability
        but does not guarantee that an entity is licensed, insured, solvent,
        authorized, safe, or suitable. Verify material claims through official or
        independent sources before making a high-risk decision.
      </>,
      <>
        Businesses should protect customer and applicant information, collect only
        what is necessary, limit internal access, and avoid placing sensitive
        records into public listings, ordinary messages, or shared Room files.
      </>,
    ],
  },
  {
    id: "financial",
    title: "Payments, Billing, and Financial Safety",
    paragraphs: [
      <>
        Loombus subscription purchases may be processed through a web payment
        provider or an app store. Loombus support will not ask for your password,
        one-time verification code, full card number, or bank login.
      </>,
      <>
        User-to-user marketplace, service, job, event, or appointment arrangements
        may occur outside Loombus. Those payments are separate from a Loombus
        subscription unless the interface expressly states that Loombus processes
        the transaction.
      </>,
    ],
  },
  {
    id: "moderation",
    title: "Moderation, Preservation, and Disclosure",
    paragraphs: [
      <>
        Loombus may remove or restrict content, disable a feature, place a listing
        under review, suspend an account, preserve records, or refuse service when
        needed to address suspected abuse, fraud, child safety, threats,
        infringement, illegal activity, security incidents, payment disputes, or
        policy violations.
      </>,
      <>
        Loombus may share information with service providers, affected parties,
        emergency responders, law enforcement, courts, regulators, or others when
        permitted or required by law and reasonably necessary for the applicable
        purpose. Reports are handled with appropriate discretion, but reporter
        anonymity cannot be guaranteed in every legal or operational circumstance.
      </>,
    ],
  },
  {
    id: "appeals",
    title: "Appeals and Follow-Up",
    paragraphs: [
      <>
        A member may request review of a moderation action through Support.
        Include the affected account or record, relevant links, the action being
        challenged, and a focused explanation. Do not create new accounts or
        continue prohibited activity while an appeal is pending.
      </>,
      <>
        Loombus may uphold, modify, or reverse an action, request more information,
        or decline further review. An appeal does not guarantee restoration.
      </>,
    ],
  },
  {
    id: "support",
    title: "Safety Support",
    paragraphs: [
      <>
        Submit platform safety concerns through{" "}
        <Link href="/support?category=safety" className="text-zinc-200 underline-offset-4 hover:underline">
          Loombus Support
        </Link>{" "}
        or email{" "}
        <a
          href={`mailto:${supportEmail}?subject=Loombus%20Safety%20Concern`}
          className="text-zinc-200 underline-offset-4 hover:underline"
        >
          {supportEmail}
        </a>
        . Include links, usernames, dates, screenshots, and a clear description,
        but never include passwords, verification codes, full payment details, or
        material that is illegal to possess.
      </>,
      <>
        For detailed conduct rules, review the{" "}
        <Link href="/guidelines" className="text-zinc-200 underline-offset-4 hover:underline">
          Community Guidelines
        </Link>
        .
      </>,
    ],
  },
];

export default function SafetyPage() {
  return (
    <PublicPolicyPage
      eyebrow="Safety"
      title="Safety on Loombus"
      description={
        <>
          Safety on Loombus covers online discussion, private communication,
          shared files, local discovery, and real-world interactions. These tools
          reduce risk but do not replace emergency services, independent
          verification, or professional judgment.
        </>
      }
      sections={sections}
      effectiveDate="July 18, 2026"
      reviewedDate="July 18, 2026"
    />
  );
}
