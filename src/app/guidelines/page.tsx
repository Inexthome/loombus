import Link from "next/link";
import { PageHeader, PageShell, Panel } from "@/components/ui";

const supportEmail = "support@loombus.com";

export default function GuidelinesPage() {
  return (
    <PageShell width="lg">
      <Link href="/" className="mb-10 inline-block text-sm text-zinc-500 hover:text-white">
        ← Back to Loombus
      </Link>

      <PageHeader
        eyebrow="Community"
        title="Community Guidelines"
        description={
          <>
            Loombus is designed for thoughtful, high-signal discussion. These
            Community Guidelines explain what is expected from members and what
            may lead to moderation, restriction, or account enforcement.
          </>
        }
      />

      <div className="space-y-8 leading-relaxed text-zinc-400">
        <Panel>
          <h2 className="mb-4 text-2xl font-semibold text-white">
            1. Signal Over Noise
          </h2>

          <p>
            Loombus exists to encourage thoughtful conversations, useful
            insights, durable ideas, and meaningful contribution. Members
            should aim to post discussions and replies that inform, explore,
            question, clarify, analyze, teach, or constructively challenge.
          </p>

          <p className="mt-4">
            Low-effort noise, spam, empty engagement farming, intentionally
            inflammatory posting, and manipulative activity undermine the
            purpose of Loombus and may be restricted.
          </p>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-semibold text-white">
            2. Respectful Disagreement
          </h2>

          <p>
            Disagreement is allowed and expected. Members may challenge ideas,
            arguments, claims, and reasoning. However, disagreement should not
            become harassment, intimidation, threats, slurs, stalking, targeted
            abuse, or attempts to silence another user through misconduct.
          </p>

          <p className="mt-4">
            Critique ideas. Do not attack people.
          </p>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-semibold text-white">
            3. Prohibited Conduct
          </h2>

          <p>The following conduct is not allowed on Loombus:</p>

          <ul className="mt-4 list-disc space-y-2 pl-6">
            <li>harassment, threats, intimidation, stalking, or targeted abuse;</li>
            <li>hate-driven conduct or attacks based on protected characteristics;</li>
            <li>impersonation, deception, fraud, scams, or misleading identity use;</li>
            <li>spam, fake engagement, bot-like manipulation, or coordinated abuse;</li>
            <li>malware, phishing, malicious links, or attempts to compromise users or systems;</li>
            <li>scraping, harvesting, crawling, or bulk collection without written permission;</li>
            <li>attempts to bypass suspensions, blocks, restrictions, rate limits, or security controls;</li>
            <li>misuse of reporting, moderation, blocking, support, or safety tools;</li>
            <li>posting illegal, exploitative, non-consensual, or infringing content;</li>
            <li>posting sexualized-minor content, child exploitation material, grooming behavior, or unsafe contact involving minors;</li>
            <li>posting private information, credentials, payment details, confidential records, or non-consensual intimate content;</li>
            <li>using AI or automation to generate spam, deception, impersonation, harassment, scams, synthetic reviews, or misleading content;</li>
            <li>using Loombus in a way that creates safety, legal, operational, reputational, or security risk for the platform, its owner, users, or service providers.</li>
          </ul>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-semibold text-white">
            4. Harassment, Threats, and Abuse
          </h2>

          <p>
            Loombus may restrict content or accounts involved in repeated
            unwanted contact, targeted insults, dogpiling, intimidation,
            threats of harm, encouragement of harm, doxxing, stalking,
            coercion, or attempts to make another person feel unsafe.
          </p>

          <p className="mt-4">
            Content that threatens violence, encourages self-harm, exposes
            private personal information, or targets a person for abuse may
            result in immediate enforcement.
          </p>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-semibold text-white">
            5. Hate, Dehumanization, and Protected Groups
          </h2>

          <p>
            Loombus does not allow content or behavior that promotes hatred,
            dehumanization, harassment, or violence against people based on
            protected characteristics or identity-based traits. This includes
            slurs, threats, calls for exclusion or harm, and targeted abuse.
          </p>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-semibold text-white">
            6. Misinformation, Deception, and Manipulation
          </h2>

          <p>
            Members should not use Loombus to impersonate others, mislead
            users about identity or affiliation, manipulate discussions,
            coordinate fake activity, spread scams, or intentionally distort
            information in ways that create harm, fraud, or platform abuse.
          </p>

          <p className="mt-4">
            Loombus may reduce visibility, label, remove, or restrict content
            or accounts that appear deceptive, coordinated, manipulative, or
            abusive.
          </p>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-semibold text-white">
            7. Intellectual Property and Privacy
          </h2>

          <p>
            Do not post content you do not have the right to use. Do not post
            another person’s private information, confidential information,
            personal documents, credentials, account details, financial data,
            medical details, private images, or non-consensual content.
          </p>

          <p className="mt-4">
            Copyright, trademark, privacy, or impersonation concerns may be
            sent to{" "}
            <a
              href={`mailto:${supportEmail}?subject=Loombus%20Rights%20Concern`}
              className="text-zinc-200 underline-offset-4 hover:underline"
            >
              {supportEmail}
            </a>
            .
          </p>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-semibold text-white">
            8. AI-Assisted Content
          </h2>

          <p>
            Loombus may offer AI-assisted tools, but users remain responsible
            for content they submit, publish, rewrite, summarize, or rely on.
            Do not use AI tools to generate spam, harassment, deception,
            impersonation, illegal content, infringing content, manipulative
            content, harmful instructions, or content that misrepresents real
            people, experience, or expertise.
          </p>

          <p className="mt-4">
            AI-generated or AI-assisted content may be inaccurate, incomplete,
            or misleading. Members should review AI-assisted content before
            using or posting it. AI tools should support better discussion, not
            replace member judgment, lived context, or responsibility for what is
            posted.
          </p>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-semibold text-white">
            9. Reporting and Blocking
          </h2>

          <p>
            Reporting and blocking are safety tools. Members may report
            discussions, replies, and profiles that appear to violate Loombus
            policies. Members may block other users to limit unwanted
            interaction.
          </p>

          <p className="mt-4">
            Do not misuse reporting or blocking tools to harass users, silence
            good-faith participation, manipulate moderation, or create false
            claims. Abuse of safety tools may itself lead to enforcement.
          </p>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-semibold text-white">
            10. Premium and Paid Feature Conduct
          </h2>

          <p>
            Premium access does not exempt any user from these Guidelines.
            Paid users must follow the same rules as free users. Loombus may
            restrict, suspend, or terminate access to Premium features if a
            user violates the Terms, these Guidelines, safety rules, payment
            rules, or platform protections.
          </p>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-semibold text-white">
            11. Moderation and Enforcement
          </h2>

          <p>
            Loombus may take action when content or behavior appears to
            violate the Terms, these Guidelines, safety expectations,
            intellectual property rights, law, or platform integrity. Actions
            may include removing content, limiting visibility, disabling
            features, warning users, restricting accounts, suspending accounts,
            terminating accounts, preserving records, or refusing service.
          </p>

          <p className="mt-4">
            Loombus may also act when conduct creates legal, regulatory,
            security, safety, operational, reputational, or business risk for
            Loombus, its owner, users, service providers, or the public.
          </p>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-semibold text-white">
            12. Appeals and Support
          </h2>

          <p>
            If you believe moderation action was taken in error, you may
            contact support with relevant details. Loombus may review the
            issue but does not guarantee reversal, restoration, or continued
            availability of any account, feature, discussion, reply, or
            content.
          </p>

          <p className="mt-4">
            Support questions may be sent to{" "}
            <a
              href={`mailto:${supportEmail}?subject=Loombus%20Guidelines%20Question`}
              className="text-zinc-200 underline-offset-4 hover:underline"
            >
              {supportEmail}
            </a>
            .
          </p>

          <p className="mt-4 text-sm text-zinc-600">
            Effective date: May 22, 2026
          </p>
        </Panel>
      </div>
    </PageShell>
  );
}
