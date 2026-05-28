import Link from "next/link";
import { LegalReviewNotice, PageHeader, PageShell, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supportEmail = "support@loombus.com";

export default function DmcaPage() {
  return (
    <PageShell width="lg">
      <Link href="/" className="mb-10 inline-block text-sm text-zinc-500 hover:text-white">
        ← Back to Loombus
      </Link>

      <PageHeader
        eyebrow="Legal"
        title="Copyright and DMCA Process"
        description={
          <>
            This page explains how Loombus receives and reviews copyright,
            intellectual property, and rights-related concerns.
          </>
        }
      />

      <LegalReviewNotice label="Copyright and DMCA Process page" />

      <div className="space-y-8 leading-relaxed text-zinc-400">
        <Panel>
          <h2 className="mb-4 text-2xl font-semibold text-white">
            1. Copyright and Rights Concerns
          </h2>

          <p>
            Loombus respects intellectual property rights and expects members to
            post only content they have the right to use, quote, share, or
            discuss. If you believe content on Loombus infringes your copyright,
            trademark, publicity, privacy, or other rights, you may submit a
            rights concern for review.
          </p>

          <p className="mt-4">
            Rights concerns may be sent to{" "}
            <a
              href={`mailto:${supportEmail}?subject=Loombus%20Copyright%20or%20DMCA%20Notice`}
              className="text-zinc-200 underline-offset-4 hover:underline"
            >
              {supportEmail}
            </a>
            .
          </p>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-semibold text-white">
            2. DMCA Notice Information
          </h2>

          <p>
            To help Loombus review a copyright takedown request, include as much
            of the following information as possible:
          </p>

          <ul className="mt-4 list-disc space-y-2 pl-6">
            <li>your full legal name or authorized representative name;</li>
            <li>your email address and contact information;</li>
            <li>a description of the copyrighted work you claim was infringed;</li>
            <li>the exact Loombus URL or enough information to locate the allegedly infringing content;</li>
            <li>a statement that you have a good-faith belief the disputed use is not authorized by the copyright owner, its agent, or the law;</li>
            <li>a statement that the information in the notice is accurate and, under penalty of perjury, that you are the copyright owner or authorized to act for the owner;</li>
            <li>your physical or electronic signature.</li>
          </ul>

          <p className="mt-4">
            Incomplete notices may delay review. Misrepresentations in copyright
            claims may create legal liability.
          </p>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-semibold text-white">
            3. Review and Action
          </h2>

          <p>
            Loombus may remove, restrict, disable, preserve, or investigate
            content that appears to infringe rights or create legal risk. Loombus
            may also contact the user who posted the content, request additional
            information, keep records for legal and moderation purposes, or take
            account-level action for repeated or serious violations.
          </p>

          <p className="mt-4">
            Loombus may reject requests that are incomplete, abusive,
            fraudulent, unclear, unrelated to rights ownership, or not supported
            by sufficient information.
          </p>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-semibold text-white">
            4. Counter-Notice
          </h2>

          <p>
            If your content was removed or restricted because of a copyright
            complaint and you believe the action was mistaken, you may contact
            Loombus support with a counter-notice or explanation. Include the
            removed content location, your contact information, and why you
            believe the content was removed in error.
          </p>

          <p className="mt-4">
            Loombus may require additional information before restoring content.
            Loombus may decline restoration where the content creates legal,
            safety, privacy, platform-integrity, or repeat-infringement risk.
          </p>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-semibold text-white">
            5. Repeat Infringer Policy
          </h2>

          <p>
            Loombus may restrict, suspend, or terminate accounts that repeatedly
            post infringing content, submit abusive rights claims, evade
            enforcement, or create significant intellectual-property risk for
            the platform or others.
          </p>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-semibold text-white">
            6. DMCA Agent Note
          </h2>

          <p>
            This page is a public process draft. If Loombus seeks formal DMCA
            safe-harbor protection, Loombus should designate a DMCA agent with
            the U.S. Copyright Office and post the designated agent contact
            information here after attorney review.
          </p>

          <p className="mt-4 text-sm text-zinc-600">
            Effective date: May 28, 2026
          </p>
        </Panel>
      </div>
    </PageShell>
  );
}
