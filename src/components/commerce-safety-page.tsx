import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpenCheck,
  ChevronRight,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

type SafetyCard = {
  Icon: LucideIcon;
  title: string;
  body: string;
};

type SafetyAction = {
  href: string;
  label: string;
};

type CommerceSafetyPageProps = {
  eyebrow: string;
  title: string;
  intro: string;
  cards: SafetyCard[];
  prohibitedTitle: string;
  prohibitedItems?: string[];
  prohibitedBody?: string;
  practiceTitle?: string;
  practices?: string[];
  boundaryTitle: string;
  boundaryBody: string;
  primaryAction: SafetyAction;
  secondaryAction: SafetyAction;
};

export default function CommerceSafetyPage({
  eyebrow,
  title,
  intro,
  cards,
  prohibitedTitle,
  prohibitedItems = [],
  prohibitedBody,
  practiceTitle,
  practices = [],
  boundaryTitle,
  boundaryBody,
  primaryAction,
  secondaryAction,
}: CommerceSafetyPageProps) {
  return (
    <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-20 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[82rem]">
        <div className="mb-5">
          <Link
            href={primaryAction.href}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--loombus-text-muted)] transition hover:text-[color:var(--loombus-gold)]"
          >
            <ArrowLeft size={16} /> {primaryAction.label}
          </Link>
        </div>

        <header className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-xl shadow-black/10 sm:p-7">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">
            <ShieldCheck size={16} /> {eyebrow}
          </div>
          <h1 className="mt-4 max-w-5xl text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">
            {title}
          </h1>
          <p className="mt-4 max-w-4xl text-base leading-8 text-[color:var(--loombus-text-muted)]">
            {intro}
          </p>
        </header>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="min-w-0 space-y-6">
            <section>
              <div className="mb-4">
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">
                  Practical checks
                </p>
                <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">
                  Before you continue
                </h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {cards.map(({ Icon, title: cardTitle, body }) => (
                  <article
                    key={cardTitle}
                    className="rounded-[1.5rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-lg shadow-black/5"
                  >
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[color:var(--loombus-cream)] text-[color:var(--loombus-gold)] dark:bg-[color:var(--loombus-gold-soft)]">
                      <Icon size={20} />
                    </span>
                    <h3 className="mt-4 text-xl font-semibold tracking-[-0.025em]">
                      {cardTitle}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                      {body}
                    </p>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-xl shadow-black/10 sm:p-6">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">
                Platform boundary
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">
                {prohibitedTitle}
              </h2>
              {prohibitedBody ? (
                <p className="mt-4 text-sm leading-7 text-[color:var(--loombus-text-muted)]">
                  {prohibitedBody}
                </p>
              ) : null}
              {prohibitedItems.length > 0 ? (
                <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                  {prohibitedItems.map((item) => (
                    <li
                      key={item}
                      className="rounded-2xl border border-[color:var(--loombus-border-muted)] bg-[color:var(--loombus-page-bg)] p-4 text-sm leading-6 text-[color:var(--loombus-text-muted)]"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>

            {practiceTitle && practices.length > 0 ? (
              <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-xl shadow-black/10 sm:p-6">
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">
                  Safer practice
                </p>
                <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">
                  {practiceTitle}
                </h2>
                <ol className="mt-5 space-y-3">
                  {practices.map((item, index) => (
                    <li
                      key={item}
                      className="flex gap-3 rounded-2xl bg-[color:var(--loombus-page-bg)] p-4 text-sm leading-6 text-[color:var(--loombus-text-muted)]"
                    >
                      <strong className="text-[color:var(--loombus-gold)]">
                        {index + 1}.
                      </strong>
                      <span>{item}</span>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}
          </section>

          <aside className="space-y-5 xl:sticky xl:top-28 xl:self-start">
            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <p className="text-xs font-bold uppercase tracking-[0.3em]">
                Continue safely
              </p>
              <div className="mt-4 space-y-2">
                <Link
                  href={primaryAction.href}
                  className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-cream)] px-4 py-3 text-sm font-semibold text-[color:var(--loombus-cream-contrast)] transition hover:opacity-90 dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-gold)]"
                >
                  {primaryAction.label} <ArrowUpRight size={14} />
                </Link>
                <Link
                  href={secondaryAction.href}
                  className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]"
                >
                  {secondaryAction.label} <ChevronRight size={14} className="text-[color:var(--loombus-gold)]" />
                </Link>
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <div className="flex gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[color:var(--loombus-cream)] text-[color:var(--loombus-gold)] dark:bg-[color:var(--loombus-gold-soft)]">
                  <BookOpenCheck size={18} />
                </span>
                <div>
                  <h2 className="font-semibold">{boundaryTitle}</h2>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                    {boundaryBody}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <p className="text-xs font-bold uppercase tracking-[0.3em]">
                Related guidance
              </p>
              <div className="mt-4 space-y-2">
                {[
                  ["Loombus Safety", "/safety"],
                  ["Community Guidelines", "/guidelines"],
                  ["Terms of Service", "/terms"],
                ].map(([label, href]) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]"
                  >
                    {label}
                    <ChevronRight size={14} className="text-[color:var(--loombus-gold)]" />
                  </Link>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
