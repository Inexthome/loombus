import Link from "next/link";
import { LegalReviewNotice, PageHeader, PageShell, Panel } from "@/components/ui";

const supportEmail = "support@loombus.com";

export default function SafetyPage() {
  return (
    <PageShell width="lg">
      <Link href="/" className="mb-10 inline-block text-sm text-zinc-500 hover:text-white">
        ← Back to Loombus
      </Link>

      <PageHeader
        eyebrow="Safety"
        title="Safety on Loombus"
        description={
          <>
            Loombus is built around high-signal discussion. Safety tools,
            moderation processes, reporting, blocking, and account protections help
            keep the platform useful, respectful, and safer for members.
          </>
        }
      />

      <LegalReviewNotice label="Safety page" />

      <div className="space-y-8 leading-relaxed text-zinc-400">
        <Panel tone="danger">
          <h2 className="mb-4 text-2xl font-semibold text-white">
            1. Immediate Danger
          </h2>

          <p>
            Loombus is not an emergency service. If you or someone else is in
            immediate danger, facing a medical emergency, at risk of self-harm,
            or experiencing an urgent threat, contact local emergency services
            or an appropriate crisis resource immediately.
          </p>

          <p className="mt-4">
            Loombus support and moderation tools are not a substitute for law
            enforcement, medical care, crisis support, emergency response, or
            professional advice. Reports and support requests may not be reviewed
            in real time.
          </p>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-semibold text-white">
            2. Reporting Content and Profiles
          </h2>

          <p>
            Members can report discussions, replies, and profiles that appear
            to violate the Terms, Community Guidelines, safety expectations,
            intellectual property rights, privacy rights, or applicable law.
          </p>

          <p className="mt-4">
            Reports may be reviewed by the Loombus moderation
            tools. Loombus may use report details, account information,
            content, metadata, and related records to evaluate the issue and
            protect the platform.
          </p>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-semibold text-white">
            3. Blocking Users
          </h2>

          <p>
            Blocking helps members limit unwanted interaction. When you block
            another user, Loombus may restrict certain interactions, remove
            mutual follow connections, and filter blocked or blocking users
            from key member areas.
          </p>

          <p className="mt-4">
            Blocking is a safety and comfort tool. It should not be used to
            harass, manipulate, evade accountability, or abuse platform
            systems.
          </p>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-semibold text-white">
            4. Harassment, Threats, and Abuse
          </h2>

          <p>
            Loombus may restrict or remove content and accounts involved in
            harassment, threats, stalking, repeated unwanted contact,
            intimidation, dogpiling, coercion, targeted insults, encouragement
            of harm, or attempts to make another person feel unsafe.
          </p>

          <p className="mt-4">
            Threats of violence, doxxing, non-consensual sharing of personal
            information, or targeted abuse may lead to immediate enforcement.
          </p>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-semibold text-white">
            5. Self-Harm, Violence, and Dangerous Content
          </h2>

          <p>
            Content that encourages, instructs, glorifies, or coordinates
            self-harm, suicide, violence, exploitation, abuse, or dangerous
            illegal activity may be removed or restricted.
          </p>

          <p className="mt-4">
            Loombus may preserve and disclose information when reasonably
            necessary to protect users, comply with law, respond to credible
            threats, or prevent serious harm.
          </p>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-semibold text-white">
            6. Minors and Age Safety
          </h2>

          <p>
            Loombus is not available to children under 13. Members should not
            encourage children under 13 to create accounts, collect information
            from children, or use Loombus to contact minors in unsafe,
            exploitative, deceptive, or inappropriate ways.
          </p>

          <p className="mt-4">
            Content or behavior involving child exploitation, grooming,
            sexualized-minor content, coercion, or unsafe contact with minors may
            lead to immediate enforcement and may be reported or preserved where
            legally appropriate.
          </p>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-semibold text-white">
            7. Privacy and Personal Information
          </h2>

          <p>
            Do not post another person’s private information without
            permission. This includes personal documents, home addresses,
            private contact information, credentials, financial account
            details, medical details, private images, or confidential
            information.
          </p>

          <p className="mt-4">
            Loombus may remove content that appears to expose private
            information, violate privacy rights, or create safety risk.
          </p>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-semibold text-white">
            8. Account Safety
          </h2>

          <p>
            Members are responsible for protecting their accounts. Use a strong
            password, protect your email account, avoid suspicious links, and
            do not share login credentials.
          </p>

          <p className="mt-4">
            If you believe your Loombus account, Google login, email account,
            or payment access has been compromised, contact support and secure
            the affected account immediately.
          </p>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-semibold text-white">
            9. Misuse of Safety Tools
          </h2>

          <p>
            Reports, blocks, appeals, and support requests must be used in good
            faith. Loombus may restrict users who submit false reports, abuse
            safety tools, coordinate reporting attacks, manipulate moderation,
            or use support channels to harass others.
          </p>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-semibold text-white">
            10. Moderation and Enforcement
          </h2>

          <p>
            Loombus may remove content, limit visibility, disable features,
            restrict accounts, suspend accounts, terminate accounts, preserve
            records, refuse service, or take other action when content or
            behavior appears to violate the Terms, Community Guidelines, this
            Safety page, applicable law, platform integrity, or user safety.
          </p>

          <p className="mt-4">
            Loombus may also act when conduct creates legal, regulatory,
            safety, security, operational, reputational, or business risk for
            Loombus, its owner, users, service providers, or the public.
          </p>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-semibold text-white">
            11. Appeals and Review
          </h2>

          <p>
            If you believe an action was taken in error, you may contact
            support with relevant context. Loombus may review the issue, but
            does not guarantee reversal, reinstatement, restoration, or
            continued availability of any account, feature, discussion, reply,
            profile, or content.
          </p>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-semibold text-white">
            12. Safety Support
          </h2>

          <p>
            For safety concerns, moderation questions, account safety issues,
            or urgent platform abuse reports, contact{" "}
            <a
              href={`mailto:${supportEmail}?subject=Loombus%20Safety%20Concern`}
              className="text-zinc-200 underline-offset-4 hover:underline"
            >
              {supportEmail}
            </a>
            .
          </p>

          <p className="mt-4">
            Include your account email, relevant links, screenshots, usernames,
            discussion or reply links, and a clear description of the issue so
            Loombus can review the concern more effectively.
          </p>

          <a
            href={`mailto:${supportEmail}?subject=Loombus%20Safety%20Concern`}
            className="mt-5 inline-flex rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
          >
            Email safety support
          </a>

          <p className="mt-4 text-sm text-zinc-600">
            Effective date: May 22, 2026
          </p>
        </Panel>
      </div>
    </PageShell>
  );
}
