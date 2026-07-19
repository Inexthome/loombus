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
  title: "Copyright and DMCA Process | Loombus",
  description:
    "Copyright notice, takedown, counter-notice, repeat-infringer, preservation, and rights-review procedures for content across Loombus.",
  alternates: {
    canonical: "https://loombus.com/dmca",
  },
};

const sections: PublicPolicySection[] = [
  {
    id: "scope",
    title: "Copyright and Rights Scope",
    paragraphs: [
      <>
        Loombus respects intellectual property rights and expects users to post,
        upload, list, distribute, or process only material they have the right to
        use.
      </>,
      <>
        A concern may involve a discussion, reply, profile, image, Video Context,
        PDF, message attachment, private Room file, business material, service,
        request, job, event, marketplace listing, product image, logo, source link,
        AI-assisted output, or other material available through Loombus.
      </>,
      <>
        Copyright is distinct from trademark, privacy, publicity, impersonation,
        defamation, contract, and other rights. Loombus may route or review those
        concerns under a different policy or support process.
      </>,
    ],
  },
  {
    id: "before-notice",
    title: "Before Submitting a Copyright Notice",
    paragraphs: [
      <>
        Confirm that you own the copyright or are authorized to act for the owner,
        identify the specific work and material, and consider whether the use may
        be licensed, authorized, public domain, or permitted by law.
      </>,
      <>
        A knowingly false or materially misleading notice can create legal
        liability. Loombus may request clarification, reject an abusive notice, or
        preserve records relating to suspected misrepresentation.
      </>,
    ],
  },
  {
    id: "notice",
    title: "Information Required in a Takedown Notice",
    bullets: [
      <>a physical or electronic signature of the copyright owner or a person authorized to act for the owner;</>,
      <>identification of the copyrighted work claimed to be infringed, or a representative list when multiple works at one site are involved;</>,
      <>identification of the material claimed to be infringing and information reasonably sufficient for Loombus to locate it, preferably each exact Loombus URL or record;</>,
      <>your name, mailing address, telephone number, and email address;</>,
      <>a statement that you have a good-faith belief that the disputed use is not authorized by the copyright owner, its agent, or the law;</>,
      <>a statement that the information is accurate and, under penalty of perjury, that you are authorized to act for the owner of the exclusive right allegedly infringed.</>,
    ],
    paragraphs: [
      <>
        Send the written notice to{" "}
        <a
          href={`mailto:${supportEmail}?subject=Loombus%20Copyright%20or%20DMCA%20Notice`}
          className="text-zinc-200 underline-offset-4 hover:underline"
        >
          {supportEmail}
        </a>{" "}
        unless this page is later updated with different designated-agent contact
        information.
      </>,
    ],
  },
  {
    id: "location",
    title: "Locating the Material",
    paragraphs: [
      <>
        Include the exact public or member URL, discussion or reply identifier,
        profile username, Room name and file path, listing title, business,
        service, request, job, event, marketplace item, message context, or other
        information that allows Loombus to locate each item.
      </>,
      <>
        A screenshot alone may be insufficient if it does not identify where the
        material appears. If the content is private, explain your authorized
        relationship to it without sending passwords, access tokens, or
        unnecessary private content.
      </>,
    ],
  },
  {
    id: "review",
    title: "Review and Takedown Action",
    paragraphs: [
      <>
        Loombus may request more information, restrict access temporarily, remove
        or disable material, preserve records, notify the user, refer the matter to
        a provider, or take account-level action where a notice is sufficiently
        complete or other evidence creates a legal or policy concern.
      </>,
      <>
        Loombus may decline or delay action when it cannot locate the material,
        identify the protected work, verify the sender’s authority, distinguish the
        claim from a non-copyright dispute, or obtain information required for a
        legally effective notice.
      </>,
      <>
        Removal under this process is not a final judicial determination of
        infringement.
      </>,
    ],
  },
  {
    id: "notification",
    title: "Notice to the Affected User",
    paragraphs: [
      <>
        Where appropriate and legally permitted, Loombus may notify the user who
        submitted the material, provide information about the complaint, and
        explain the available counter-notice process.
      </>,
      <>
        Loombus may withhold information when necessary for safety, privacy,
        security, legal process, or another lawful reason.
      </>,
    ],
  },
  {
    id: "counter",
    title: "Counter-Notice Requirements",
    bullets: [
      <>your physical or electronic signature;</>,
      <>identification of the material removed or disabled and the location where it appeared before removal;</>,
      <>a statement under penalty of perjury that you have a good-faith belief the material was removed or disabled because of mistake or misidentification;</>,
      <>your name, address, and telephone number;</>,
      <>a statement consenting to the jurisdiction of the applicable United States federal district court, as required by 17 U.S.C. § 512(g);</>,
      <>a statement that you will accept service of process from the person who submitted the original notice or that person’s agent.</>,
    ],
    paragraphs: [
      <>
        Send a counter-notice to{" "}
        <a
          href={`mailto:${supportEmail}?subject=Loombus%20DMCA%20Counter-Notice`}
          className="text-zinc-200 underline-offset-4 hover:underline"
        >
          {supportEmail}
        </a>
        . A general disagreement, assertion of ownership, or request to restore
        content is not necessarily a legally sufficient counter-notice.
      </>,
    ],
  },
  {
    id: "restoration",
    title: "Restoration After a Counter-Notice",
    paragraphs: [
      <>
        If Loombus receives a legally sufficient counter-notice, it may forward the
        counter-notice to the original claimant and may restore the material after
        the waiting period required by law unless the claimant notifies Loombus of
        a filed court action seeking to restrain the alleged infringement.
      </>,
      <>
        Loombus may decline restoration for an independent violation of the Terms,
        Community Guidelines, privacy rights, safety rules, fraud controls, or
        another legal obligation even when a copyright counter-notice is submitted.
      </>,
    ],
  },
  {
    id: "repeat",
    title: "Repeat Infringer and Evasion Policy",
    paragraphs: [
      <>
        Loombus may restrict or terminate accounts that repeatedly infringe
        copyright, repeatedly receive valid notices, repost removed material,
        evade enforcement, use alternate accounts, submit abusive notices, or
        create substantial intellectual-property risk.
      </>,
      <>
        Loombus may consider the number, timing, severity, credibility, and outcome
        of notices and counter-notices rather than applying a single automatic
        threshold in every circumstance.
      </>,
    ],
  },
  {
    id: "other-rights",
    title: "Trademark, Publicity, Privacy, and Impersonation Concerns",
    paragraphs: [
      <>
        For trademark misuse, false affiliation, impersonation, privacy, publicity
        rights, non-consensual imagery, or another non-copyright concern, use{" "}
        <Link href="/support?category=legal" className="text-zinc-200 underline-offset-4 hover:underline">
          Loombus Support
        </Link>{" "}
        and identify the legal right, affected person or entity, exact material,
        and requested action.
      </>,
      <>
        Loombus may request proof of identity, authorization, registration,
        ownership, consent, or other supporting information.
      </>,
    ],
  },
  {
    id: "records",
    title: "Records, Disclosure, and Privacy",
    paragraphs: [
      <>
        Loombus may preserve notices, counter-notices, related content, account
        information, timestamps, communications, decisions, and technical records
        for legal compliance, repeat-infringer review, dispute resolution,
        enforcement, and defense of rights.
      </>,
      <>
        Information in a notice or counter-notice may be shared with the affected
        user, claimant, service provider, legal advisor, court, regulator, or other
        party when reasonably necessary or required by law. Do not include
        information unrelated to the claim.
      </>,
    ],
  },
  {
    id: "agent",
    title: "Designated Agent Status and Required Business Action",
    paragraphs: [
      <>
        The support email above is Loombus’s current public intake channel for
        copyright concerns. This page does not represent that Loombus has completed
        registration of a designated DMCA agent with the U.S. Copyright Office.
      </>,
      <>
        To seek the applicable Section 512 safe-harbor protections, Loombus should
        designate and register an agent with the U.S. Copyright Office, publish the
        required agent name, mailing address, telephone number, and email address,
        keep that information current, and renew the registration as required.
      </>,
      <>
        This operational step should be completed with qualified legal review. Once
        completed, this section should be updated with the exact registered
        information.
      </>,
    ],
  },
  {
    id: "contact",
    title: "Copyright Contact",
    paragraphs: [
      <>
        Copyright notices, counter-notices, and related questions may be directed
        to <strong>Loombus LLC</strong>, a Florida limited liability company.
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
        Email notices to{" "}
        <a
          href={`mailto:${supportEmail}?subject=Loombus%20Copyright%20or%20DMCA`}
          className="text-zinc-200 underline-offset-4 hover:underline"
        >
          {supportEmail}
        </a>
        . General support is available through{" "}
        <Link href="/support?category=legal" className="text-zinc-200 underline-offset-4 hover:underline">
          Loombus Support
        </Link>
        . This contact information does not, by itself, represent that Loombus LLC
        has completed registration of a designated DMCA agent with the U.S.
        Copyright Office.
      </>,
    ],
  },
];

export default function DmcaPage() {
  return (
    <PublicPolicyPage
      eyebrow="Legal"
      title="Copyright and DMCA Process"
      description={
        <>
          This page explains how Loombus receives copyright notices, handles
          takedown review, accepts counter-notices, addresses repeat infringement,
          and distinguishes copyright from other rights concerns.
        </>
      }
      sections={sections}
      effectiveDate="July 18, 2026"
      reviewedDate="July 19, 2026"
    />
  );
}
