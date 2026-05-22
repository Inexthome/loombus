import Link from "next/link";

const supportEmail = "support@loombus.com";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="mb-10 inline-block text-sm text-zinc-500 hover:text-white">
          ← Back to Loombus
        </Link>

        <p className="mb-4 text-sm uppercase tracking-[0.3em] text-zinc-500">
          Legal
        </p>

        <h1 className="mb-6 text-5xl font-semibold tracking-tight">
          Terms of Service
        </h1>

        <p className="mb-10 max-w-3xl leading-relaxed text-zinc-400">
          These Terms of Service govern your access to and use of Loombus. By
          creating an account, accessing Loombus, posting content, using Premium
          features, or otherwise using the platform, you agree to these Terms.
        </p>

        <div className="mb-10 rounded-2xl border border-amber-900/60 bg-amber-950/20 p-5 text-sm leading-relaxed text-amber-200">
          <p>
            Important: These Terms are a platform-protection draft for Loombus
            and should be reviewed by a qualified attorney before broad public
            launch, paid subscription enforcement, or large-scale user growth.
          </p>
        </div>

        <div className="space-y-8 leading-relaxed text-zinc-400">
          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-7">
            <h2 className="mb-4 text-2xl font-semibold text-white">
              1. The Loombus Service
            </h2>

            <p>
              Loombus is a high-signal discussion platform designed for
              thoughtful conversations, durable knowledge, community discussion,
              and optional AI-assisted tools. The platform may include public
              pages, member accounts, discussions, replies, follows, saves,
              notifications, Premium features, moderation tools, reporting
              systems, and related services.
            </p>

            <p className="mt-4">
              Loombus may change, suspend, restrict, discontinue, or modify any
              part of the service at any time, including features, pricing,
              access levels, account tools, AI features, moderation systems, or
              availability.
            </p>
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-7">
            <h2 className="mb-4 text-2xl font-semibold text-white">
              2. Eligibility and Accounts
            </h2>

            <p>
              You may use Loombus only if you can legally agree to these Terms
              and are not prohibited from using the service under applicable law.
              You must be at least 13 years old to use Loombus. Users under the
              age of majority in their jurisdiction may use Loombus only with
              appropriate parental or guardian permission.
            </p>

            <p className="mt-4">
              You are responsible for maintaining the confidentiality and
              security of your account credentials, account activity, profile,
              discussions, replies, saves, reports, and any actions taken through
              your account. Loombus is not responsible for losses caused by your
              failure to secure your account.
            </p>
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-7">
            <h2 className="mb-4 text-2xl font-semibold text-white">
              3. User Content and User Responsibility
            </h2>

            <p>
              You are solely responsible for the discussions, replies, profile
              information, reports, links, text, ideas, claims, prompts, outputs,
              uploads, and other content or activity you create, submit, post,
              share, save, or otherwise provide through Loombus.
            </p>

            <p className="mt-4">
              You represent that you have the rights, permissions, and legal
              authority necessary to post or submit your content. You agree not
              to post or submit content that infringes intellectual property
              rights, violates privacy rights, breaks applicable law, harms
              others, impersonates another person, or violates Loombus policies.
            </p>

            <p className="mt-4">
              Loombus does not endorse, verify, guarantee, or assume
              responsibility for user-generated content, user opinions, user
              claims, third-party links, third-party conduct, or user
              interactions. Any reliance on user content is at your own risk.
            </p>
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-7">
            <h2 className="mb-4 text-2xl font-semibold text-white">
              4. License You Grant to Loombus
            </h2>

            <p>
              You retain ownership of content you submit to Loombus. By posting,
              submitting, creating, or displaying content on or through Loombus,
              you grant Loombus a worldwide, non-exclusive, royalty-free,
              transferable, sublicensable license to host, store, reproduce,
              process, display, publish, distribute, transmit, modify for
              formatting, analyze, moderate, and otherwise use that content as
              necessary to operate, protect, improve, promote, and provide the
              service.
            </p>

            <p className="mt-4">
              This license includes the right to display your content to other
              users according to the product features you use, make backups,
              generate previews, support search and discovery, apply moderation
              systems, create notifications, and operate AI-assisted features
              when requested or made available through the platform.
            </p>

            <p className="mt-4">
              You agree that Loombus may use feedback, suggestions, or ideas you
              voluntarily provide without obligation, restriction, or
              compensation.
            </p>
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-7">
            <h2 className="mb-4 text-2xl font-semibold text-white">
              5. AI-Assisted Features
            </h2>

            <p>
              Loombus may provide optional AI-assisted tools, including
              summaries, key takeaways, clarity rewrites, quality checks,
              disagreement maps, thread evolution, or similar features. These
              tools are provided for convenience and assistance only.
            </p>

            <p className="mt-4">
              AI outputs may be incomplete, inaccurate, outdated, misleading, or
              unsuitable for your circumstances. You are responsible for
              reviewing AI outputs before relying on, posting, or using them.
              AI-assisted features are not legal, financial, medical,
              investment, tax, safety, mental health, or other professional
              advice.
            </p>

            <p className="mt-4">
              Loombus is not responsible for decisions, actions, losses,
              disputes, or damages arising from reliance on AI-assisted outputs.
            </p>
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-7">
            <h2 className="mb-4 text-2xl font-semibold text-white">
              6. Prohibited Conduct
            </h2>

            <p>
              You agree not to misuse Loombus. Prohibited conduct includes, but
              is not limited to:
            </p>

            <ul className="mt-4 list-disc space-y-2 pl-6">
              <li>harassment, threats, abuse, stalking, or intimidation;</li>
              <li>hate-driven conduct or targeted attacks against protected groups;</li>
              <li>impersonation, deception, fraud, scams, or misleading identity use;</li>
              <li>spam, platform manipulation, fake engagement, or automated abuse;</li>
              <li>scraping, crawling, harvesting, or bulk collection without written permission;</li>
              <li>probing, scanning, bypassing, or attacking Loombus systems or security controls;</li>
              <li>uploading malware, malicious links, or harmful code;</li>
              <li>misusing reporting, blocking, moderation, or support tools;</li>
              <li>posting unlawful, infringing, exploitative, or non-consensual content;</li>
              <li>attempting to evade suspensions, restrictions, rate limits, or access controls;</li>
              <li>using Loombus in a way that creates legal, regulatory, security, operational, or reputational risk for Loombus, its owner, users, or service providers.</li>
            </ul>
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-7">
            <h2 className="mb-4 text-2xl font-semibold text-white">
              7. Moderation, Enforcement, and Account Restrictions
            </h2>

            <p>
              Loombus may review, remove, restrict, hide, limit visibility of,
              label, disable access to, or refuse to distribute any content or
              account activity at any time if Loombus believes it violates these
              Terms, platform policies, applicable law, user safety standards,
              intellectual property rights, or creates risk for Loombus, its
              owner, users, service providers, or the public.
            </p>

            <p className="mt-4">
              Loombus may suspend, terminate, restrict, or refuse service to any
              account for policy violations, legal risk, security risk,
              prolonged inactivity, fraud, abuse, payment issues, business
              reasons, or any other reason permitted by law. Loombus may also
              preserve and disclose information when reasonably necessary to
              comply with law, enforce these Terms, protect users, respond to
              support requests, prevent fraud or abuse, or protect the platform.
            </p>
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-7">
            <h2 className="mb-4 text-2xl font-semibold text-white">
              8. Paid Features and Premium Services
            </h2>

            <p>
              Loombus may offer paid subscriptions, Premium features, Premium
              Plus features, AI usage limits, extra AI action packs, or other
              paid services. Paid features may be subject to additional pricing,
              limits, usage rules, cancellation terms, refund rules, third-party
              payment processor terms, and plan descriptions shown at checkout or
              inside the platform.
            </p>

            <p className="mt-4">
              Unless otherwise required by law or clearly stated in writing,
              paid access does not guarantee uninterrupted service, permanent
              feature availability, specific AI output quality, visibility,
              audience growth, revenue, or any particular result.
            </p>
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-7">
            <h2 className="mb-4 text-2xl font-semibold text-white">
              9. Privacy, Cookies, and Security
            </h2>

            <p>
              Your use of Loombus is also governed by the Loombus Privacy Policy
              and Cookie Use page. These describe, at a high level, how Loombus
              collects, uses, stores, and protects information connected to the
              platform.
            </p>

            <p className="mt-4">
              No online service can guarantee perfect security. You understand
              that you use Loombus at your own risk and are responsible for
              keeping your account credentials secure.
            </p>
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-7">
            <h2 className="mb-4 text-2xl font-semibold text-white">
              10. Intellectual Property and Copyright
            </h2>

            <p>
              Loombus, its name, design, code, features, branding, interface,
              platform structure, and related materials are owned by Loombus or
              its owner, licensors, or service providers, except for content
              submitted by users. You may not copy, reproduce, modify,
              distribute, sell, scrape, reverse engineer, or misuse Loombus
              materials except as allowed by the platform or applicable law.
            </p>

            <p className="mt-4">
              If you believe content on Loombus infringes your copyright or
              intellectual property rights, contact{" "}
              <a
                href={`mailto:${supportEmail}?subject=Loombus%20Copyright%20Concern`}
                className="text-zinc-200 underline-offset-4 hover:underline"
              >
                {supportEmail}
              </a>{" "}
              with enough detail for Loombus to review the issue.
            </p>
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-7">
            <h2 className="mb-4 text-2xl font-semibold text-white">
              11. Third-Party Services
            </h2>

            <p>
              Loombus may rely on third-party services for hosting,
              authentication, payments, analytics, storage, infrastructure,
              email, security, AI features, or other platform operations. Loombus
              is not responsible for third-party services, outages, decisions,
              policies, data practices, pricing, errors, or conduct.
            </p>
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-7">
            <h2 className="mb-4 text-2xl font-semibold text-white">
              12. Disclaimers
            </h2>

            <p>
              To the maximum extent permitted by applicable law, Loombus is
              provided on an “AS IS” and “AS AVAILABLE” basis. Loombus makes no
              warranties, promises, or guarantees that the service will be
              uninterrupted, secure, error-free, accurate, complete, available,
              profitable, suitable for your needs, or free from harmful content
              or conduct.
            </p>

            <p className="mt-4">
              Loombus disclaims all warranties, whether express, implied,
              statutory, or otherwise, including implied warranties of
              merchantability, fitness for a particular purpose,
              non-infringement, accuracy, availability, and security.
            </p>
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-7">
            <h2 className="mb-4 text-2xl font-semibold text-white">
              13. Limitation of Liability
            </h2>

            <p>
              To the maximum extent permitted by applicable law, Loombus, its
              owner, operators, affiliates, contractors, representatives, service
              providers, and licensors shall not be liable for indirect,
              incidental, special, consequential, exemplary, punitive, reliance,
              reputational, lost-profit, lost-revenue, lost-data, business
              interruption, or other intangible damages arising from or related
              to Loombus, user content, user conduct, third-party conduct,
              moderation decisions, AI-assisted outputs, payment processing,
              account restrictions, security incidents, platform availability, or
              inability to use the service.
            </p>

            <p className="mt-4">
              To the maximum extent permitted by applicable law, Loombus’s total
              aggregate liability for any claim arising from or relating to the
              service shall not exceed the greater of: (a) the amount you paid
              Loombus for the service giving rise to the claim during the six
              months before the event giving rise to the claim; or (b) one
              hundred U.S. dollars ($100).
            </p>

            <p className="mt-4">
              Nothing in these Terms excludes or limits liability that cannot be
              excluded or limited under applicable law.
            </p>
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-7">
            <h2 className="mb-4 text-2xl font-semibold text-white">
              14. Indemnification
            </h2>

            <p>
              To the maximum extent permitted by applicable law, you agree to
              defend, indemnify, and hold harmless Loombus, its owner, operators,
              affiliates, contractors, representatives, service providers, and
              licensors from and against any claims, demands, damages, losses,
              liabilities, costs, and expenses, including reasonable attorneys’
              fees, arising from or related to: your content; your use or misuse
              of Loombus; your violation of these Terms; your violation of law;
              your violation of another person’s rights; your fraud, abuse,
              negligence, or misconduct; or your attempt to bypass, disrupt, or
              misuse the service.
            </p>
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-7">
            <h2 className="mb-4 text-2xl font-semibold text-white">
              15. Disputes, Governing Law, and Venue
            </h2>

            <p>
              These Terms and any dispute relating to Loombus shall be governed
              by the laws of the State of Florida, without regard to conflict of
              law rules, except where applicable law requires otherwise.
            </p>

            <p className="mt-4">
              To the maximum extent permitted by applicable law, any dispute,
              claim, or proceeding arising out of or relating to Loombus, these
              Terms, the service, user content, user conduct, moderation
              decisions, paid features, AI-assisted outputs, or account
              restrictions must be brought in the state or federal courts located
              in Florida, and you consent to the jurisdiction and venue of those
              courts.
            </p>

            <p className="mt-4">
              To the maximum extent permitted by applicable law, you and Loombus
              agree that claims must be brought only on an individual basis and
              not as a plaintiff or class member in any class, collective,
              consolidated, private attorney general, or representative
              proceeding.
            </p>

            <p className="mt-4">
              To the maximum extent permitted by applicable law, any claim
              arising from or relating to Loombus must be brought within one year
              after the event giving rise to the claim, or the claim is
              permanently barred.
            </p>
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-7">
            <h2 className="mb-4 text-2xl font-semibold text-white">
              16. Changes to These Terms
            </h2>

            <p>
              Loombus may update these Terms from time to time. The updated
              version will apply when posted or when otherwise communicated to
              users. Your continued use of Loombus after updated Terms become
              effective means you accept the updated Terms.
            </p>
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-7">
            <h2 className="mb-4 text-2xl font-semibold text-white">
              17. Contact
            </h2>

            <p>
              Questions about these Terms may be sent to{" "}
              <a
                href={`mailto:${supportEmail}?subject=Loombus%20Terms%20Question`}
                className="text-zinc-200 underline-offset-4 hover:underline"
              >
                {supportEmail}
              </a>
              .
            </p>

            <p className="mt-4 text-sm text-zinc-600">
              Effective date: May 22, 2026
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
