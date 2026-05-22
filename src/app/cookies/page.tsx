import Link from "next/link";

const supportEmail = "support@loombus.com";

export default function CookiesPage() {
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
          Cookie Use
        </h1>

        <p className="mb-10 max-w-3xl leading-relaxed text-zinc-400">
          This Cookie Use page explains how Loombus may use cookies, browser
          storage, session tokens, and similar technologies to operate the
          platform, support account access, protect users, and improve
          reliability.
        </p>

        <div className="mb-10 rounded-2xl border border-amber-900/60 bg-amber-950/20 p-5 text-sm leading-relaxed text-amber-200">
          <p>
            Important: This Cookie Use page is a platform-protection draft for
            Loombus and should be reviewed by a qualified attorney before broad
            public launch, paid subscription enforcement, or large-scale user
            growth.
          </p>
        </div>

        <div className="space-y-8 leading-relaxed text-zinc-400">
          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-7">
            <h2 className="mb-4 text-2xl font-semibold text-white">
              1. What Cookies and Similar Technologies Are
            </h2>

            <p>
              Cookies are small files or pieces of information stored on your
              device or browser. Similar technologies may include local storage,
              session storage, authentication tokens, browser identifiers, and
              other tools that help a website remember information or operate
              securely.
            </p>
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-7">
            <h2 className="mb-4 text-2xl font-semibold text-white">
              2. How Loombus Uses Cookies
            </h2>

            <p>
              Loombus may use cookies and similar technologies to:
            </p>

            <ul className="mt-4 list-disc space-y-2 pl-6">
              <li>keep users signed in;</li>
              <li>maintain secure account sessions;</li>
              <li>support Google authentication and email login;</li>
              <li>remember basic account and interface state;</li>
              <li>protect against fraud, abuse, spam, and unauthorized access;</li>
              <li>support Premium access, subscription status, and AI usage limits;</li>
              <li>maintain safety, moderation, and reporting tools;</li>
              <li>diagnose technical issues, improve reliability, and measure platform performance;</li>
              <li>support required platform functionality across browsers and devices.</li>
            </ul>
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-7">
            <h2 className="mb-4 text-2xl font-semibold text-white">
              3. Required Cookies
            </h2>

            <p>
              Some cookies or browser storage are required for Loombus to work.
              These may be used for login, authentication, account access,
              security, abuse prevention, routing, platform protection, and core
              member features.
            </p>

            <p className="mt-4">
              If you block required cookies or storage, Loombus may not be able
              to keep you signed in, verify your account, load member pages,
              protect your session, or provide Premium and account-based
              features.
            </p>
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-7">
            <h2 className="mb-4 text-2xl font-semibold text-white">
              4. Authentication and Session Storage
            </h2>

            <p>
              Loombus uses authentication services to manage account sessions.
              These services may store tokens, session identifiers, or related
              browser data so users can log in, remain signed in, and access
              protected features.
            </p>

            <p className="mt-4">
              If you use Google authentication, Google and the authentication
              provider may also use cookies or similar technologies according to
              their own policies.
            </p>
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-7">
            <h2 className="mb-4 text-2xl font-semibold text-white">
              5. Third-Party Services
            </h2>

            <p>
              Loombus may rely on third-party services for hosting,
              authentication, database storage, payments, email, security,
              analytics, infrastructure, AI-assisted features, and platform
              operations. These third parties may use cookies or similar
              technologies as part of the services they provide.
            </p>

            <p className="mt-4">
              Third-party services are governed by their own terms, privacy
              policies, and cookie practices. Loombus is not responsible for
              third-party cookie practices, service interruptions, or policy
              changes.
            </p>
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-7">
            <h2 className="mb-4 text-2xl font-semibold text-white">
              6. Analytics, Diagnostics, and Reliability
            </h2>

            <p>
              Loombus may use cookies, logs, or similar technologies to
              understand platform performance, detect errors, diagnose loading
              issues, prevent abuse, monitor feature reliability, and improve the
              user experience.
            </p>

            <p className="mt-4">
              If Loombus later introduces advertising, marketing analytics, or
              additional tracking technologies, this Cookie Use page and the
              Privacy Policy should be updated to describe those practices.
            </p>
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-7">
            <h2 className="mb-4 text-2xl font-semibold text-white">
              7. Managing Cookies
            </h2>

            <p>
              You can manage cookies and browser storage through your browser
              settings. Most browsers let you block, delete, or limit cookies.
              Your choices may affect how Loombus works.
            </p>

            <p className="mt-4">
              Blocking cookies may prevent login, break account sessions, limit
              protected pages, interfere with Google authentication, affect
              Premium features, or prevent Loombus from remembering required
              account state.
            </p>
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-7">
            <h2 className="mb-4 text-2xl font-semibold text-white">
              8. Relationship to Privacy Policy
            </h2>

            <p>
              This Cookie Use page should be read together with the Loombus
              Privacy Policy and Terms of Service. The Privacy Policy explains
              more broadly how Loombus may collect, use, store, disclose, and
              protect information connected to the platform.
            </p>
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-7">
            <h2 className="mb-4 text-2xl font-semibold text-white">
              9. Changes to Cookie Use
            </h2>

            <p>
              Loombus may update this Cookie Use page from time to time. The
              updated version will apply when posted or when otherwise
              communicated. Your continued use of Loombus after an update means
              you accept the updated Cookie Use page.
            </p>
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-7">
            <h2 className="mb-4 text-2xl font-semibold text-white">
              10. Contact
            </h2>

            <p>
              Cookie or privacy questions may be sent to{" "}
              <a
                href={`mailto:${supportEmail}?subject=Loombus%20Cookie%20Question`}
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
