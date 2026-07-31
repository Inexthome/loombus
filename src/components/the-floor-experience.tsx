import Link from "next/link";
import {
  Activity,
  BarChart3,
  BookOpen,
  CalendarDays,
  GraduationCap,
  LineChart,
  MessagesSquare,
  Radio,
  ScrollText,
  ShieldCheck,
  Trophy,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";

const primaryLinks = [
  {
    href: "#research-feed",
    label: "Research",
    description: "Accountable theses, catalysts, risks, and falsifiable calls.",
    icon: ScrollText,
  },
  {
    href: "/the-floor/discussion",
    label: "Discussion",
    description: "Challenge market ideas with evidence, not hype.",
    icon: MessagesSquare,
  },
  {
    href: "/the-floor/leaderboard",
    label: "Track records",
    description: "See who has earned credibility through resolved calls.",
    icon: Trophy,
  },
];

const productPillars = [
  {
    title: "Opening Bell",
    description:
      "A focused pre-market briefing for overnight moves, earnings, economic events, and the day’s highest-signal questions.",
    status: "Next release",
    icon: Activity,
  },
  {
    title: "Live Floor",
    description:
      "Scheduled market sessions with replay, transcript, ticker indexing, thesis updates, and accountable follow-up calls.",
    status: "Next release",
    icon: Radio,
  },
  {
    title: "The Academy",
    description:
      "Progressive learning paths that teach investing through real companies, real theses, and post-outcome reviews.",
    status: "Planned",
    icon: GraduationCap,
  },
  {
    title: "Watchlists",
    description:
      "Personal and analyst watchlists organized around entry zones, catalysts, thesis changes, and time horizons.",
    status: "Planned",
    icon: LineChart,
  },
];

const trustPrinciples = [
  {
    title: "Reasoning before ratings",
    description:
      "The Floor evaluates the quality of the thesis, the evidence behind it, and what would invalidate it.",
    icon: BookOpen,
  },
  {
    title: "Nothing quietly disappears",
    description:
      "Calls remain attached to their deadlines and outcomes so wins, losses, and lessons stay visible.",
    icon: ShieldCheck,
  },
  {
    title: "Credibility is earned",
    description:
      "Track records are built from resolved, falsifiable calls rather than follower counts or popularity.",
    icon: BarChart3,
  },
];

export default function TheFloorExperience({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[color:var(--loombus-page-bg)] text-[color:var(--loombus-text)]">
      <section className="border-b border-[var(--loombus-border)] bg-[radial-gradient(circle_at_top_left,color-mix(in_srgb,var(--loombus-gold)_18%,transparent),transparent_42%)] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[color:color-mix(in_srgb,var(--loombus-gold)_45%,var(--loombus-border))] bg-[var(--loombus-gold-surface)] px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-[var(--loombus-gold)]">
                <Users className="size-3.5" aria-hidden="true" />
                A Loombus investing destination
              </div>
              <h1 className="text-4xl font-black tracking-tight sm:text-5xl">The Floor</h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--loombus-text-muted)] sm:text-lg">
                Research the idea. Challenge the reasoning. Track the call. Study the outcome.
                The Floor is built to help members become more disciplined investors without
                turning Loombus into a brokerage or an anonymous alert room.
              </p>
            </div>

            <div className="rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 shadow-xl shadow-black/10 lg:max-w-sm">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--loombus-text-subtle)]">
                The Floor standard
              </p>
              <p className="mt-2 text-sm font-bold leading-6 text-[var(--loombus-text)]">
                Every serious market claim should explain the thesis, catalysts, risks, exit plan,
                time horizon, and what would prove it wrong.
              </p>
            </div>
          </div>

          <nav aria-label="The Floor" className="mt-7 grid gap-3 md:grid-cols-3">
            {primaryLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className="group rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[color:color-mix(in_srgb,var(--loombus-gold)_55%,var(--loombus-border))] hover:shadow-lg"
                >
                  <div className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[var(--loombus-gold-surface)] text-[var(--loombus-gold)]">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <span>
                      <span className="block text-sm font-black text-[var(--loombus-text)]">
                        {item.label}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-[var(--loombus-text-muted)]">
                        {item.description}
                      </span>
                    </span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>
      </section>

      <section className="px-4 py-7 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--loombus-gold)]">
                Product roadmap
              </p>
              <h2 className="mt-1 text-2xl font-black">The complete Floor experience</h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-[var(--loombus-text-muted)]">
              The existing thesis engine remains the accountability core. These modules expand it
              into research, live instruction, education, and portfolio decision support.
            </p>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {productPillars.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <article
                  key={pillar.title}
                  className="rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="grid size-10 place-items-center rounded-2xl bg-[var(--loombus-surface-muted)] text-[var(--loombus-gold)]">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <span className="rounded-full border border-[var(--loombus-border)] px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-[var(--loombus-text-subtle)]">
                      {pillar.status}
                    </span>
                  </div>
                  <h3 className="mt-4 text-base font-black">{pillar.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--loombus-text-muted)]">
                    {pillar.description}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-4 pb-2 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-3">
          {trustPrinciples.map((principle) => {
            const Icon = principle.icon;
            return (
              <article
                key={principle.title}
                className="flex gap-3 rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5"
              >
                <Icon className="mt-0.5 size-5 shrink-0 text-[var(--loombus-gold)]" aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-black">{principle.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-[var(--loombus-text-muted)]">
                    {principle.description}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section id="research-feed" aria-labelledby="research-feed-title">
        <div className="sr-only">
          <h2 id="research-feed-title">The Floor research feed</h2>
          <CalendarDays />
        </div>
        {children}
      </section>
    </div>
  );
}
