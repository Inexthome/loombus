import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, LockKeyhole, MessageCircleWarning, UsersRound, CalendarDays } from "lucide-react";
import UnderageReportForm from "./underage-report-form";
import "./teen-safety.css";

export const metadata: Metadata = {
  title: "Teen Safety | Loombus",
  description: "How Loombus protects teen privacy, discovery, messages, Rooms, and age corrections.",
};

const protections = [
  {
    title: "Private by default",
    copy: "Teen accounts remain private. Every new follower requires approval, and public future Discussion audiences are blocked while Teen Safety is active.",
    Icon: LockKeyhole,
  },
  {
    title: "Limited adult discovery",
    copy: "Adult members outside an established Loombus relationship cannot find or open a teen profile through normal People, Search, recommendation, or direct-profile routes.",
    Icon: UsersRound,
  },
  {
    title: "Teen-initiated private contact",
    copy: "An adult cannot start a private conversation with a teen. The teen must start the conversation before the adult can reply.",
    Icon: MessageCircleWarning,
  },
  {
    title: "Controlled Room admission",
    copy: "A Room must explicitly allow minors. Teen admission requires Room staff approval, and teen members cannot hold owner, administrator, or moderator roles in this release.",
    Icon: ShieldCheck,
  },
  {
    title: "Privacy preserved at 18",
    copy: "The account transitions to adult status automatically, but Loombus does not turn privacy or future Discussion visibility back to Public.",
    Icon: CalendarDays,
  },
];

export default function TeenSafetyPage() {
  return (
    <main className="teen-safety-page">
      <section className="teen-safety-shell">
        <header className="teen-safety-hero">
          <p>Loombus Safety</p>
          <h1>Teen Safety</h1>
          <span>
            Loombus protects teen members through restrictive defaults and interaction boundaries, not hidden surveillance.
          </span>
          <div className="teen-safety-actions">
            <Link href="/account/age-safety">Review my Age Safety</Link>
            <Link href="/support">Contact support</Link>
          </div>
        </header>

        <section className="teen-safety-grid" aria-label="Teen Safety protections">
          {protections.map(({ title, copy, Icon }) => (
            <article key={title}>
              <Icon aria-hidden="true" />
              <h2>{title}</h2>
              <p>{copy}</p>
            </article>
          ))}
        </section>

        <section className="teen-safety-section">
          <h2>What Loombus does not claim</h2>
          <p>
            Loombus does not verify every member's real-world identity, parent, guardian, school, teacher, employer, or Room leader. Teen Safety reduces high-risk platform interactions, but it cannot prevent screenshots, off-platform contact, or every attempt at deception.
          </p>
          <p>
            Parents and guardians do not receive secret access to a teen's private messages. Serious safety concerns should be reported through the relevant content, profile, message, Room, or support route. Immediate danger should be directed to local emergency services.
          </p>
        </section>

        <section className="teen-safety-section">
          <h2>Age information and corrections</h2>
          <p>
            A date of birth is stored separately from the public profile. Once recorded, it cannot be replaced through an ordinary profile edit. The member must submit a correction for review so teen protections cannot be bypassed by changing age.
          </p>
          <p>
            Loombus currently permits accounts that meet its minimum age. An account confirmed below that minimum becomes ineligible for authenticated platform access.
          </p>
        </section>

        <section className="teen-safety-section">
          <h2>Commercial and professional activity</h2>
          <p>
            Teen accounts may read public information, but the current general-purpose Marketplace, Business, Job, Service, Request, Event, Appointment, and Room-ownership creation systems are reserved for adult accounts. Loombus has not introduced a verified youth employment, guardian-consent, or teen commerce program.
          </p>
        </section>

        <UnderageReportForm />

        <section className="teen-safety-section">
          <h2>For parents and guardians</h2>
          <p>
            Talk openly with the teen about profile privacy, followers, direct messages, location details, school schedules, money requests, gifts, job offers, requests for secrecy, and pressure to move to another service. A sudden request for money or additional images after a threat may be coercion. Do not redistribute harmful material while seeking help.
          </p>
          <p>
            Use <Link href="/support">Loombus Support</Link> for account-specific concerns. Loombus may be unable to disclose private account information to someone who cannot establish appropriate authority.
          </p>
        </section>
      </section>
    </main>
  );
}
