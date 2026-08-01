import Link from "next/link";
import {
  BarChart3,
  BookOpen,
  Building2,
  Compass,
  GraduationCap,
  GitFork,
  LayoutDashboard,
  LibraryBig,
  MessagesSquare,
  ScrollText,
  Trophy,
  UserRoundCheck,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import TheFloorOpeningBell from "@/components/the-floor-opening-bell";

const navigation = [
  { href: "#opening-bell", label: "Opening Bell", icon: BarChart3 },
  { href: "#research-feed", label: "Research", icon: ScrollText },
  { href: "/the-floor/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/the-floor/hub", label: "Research Hub", icon: LibraryBig },
  { href: "/the-floor/workspace", label: "Workspace", icon: ScrollText },
  { href: "/the-floor/research-assistant", label: "AI Assistant", icon: BookOpen },
  { href: "/the-floor/discover", label: "Discover", icon: Compass },
  { href: "/the-floor/knowledge-graph", label: "Knowledge Graph", icon: GitFork },
  { href: "/the-floor/companies", label: "Companies", icon: Building2, pending: true },
  { href: "/the-floor/analysts", label: "Analysts", icon: UserRoundCheck, pending: true },
  { href: "/the-floor/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/the-floor/discussion", label: "Discussion", icon: MessagesSquare },
  { href: "/the-floor/academy", label: "Academy", icon: GraduationCap, pending: true },
];

export default function TheFloorExperience({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[color:var(--loombus-page-bg)] text-[color:var(--loombus-text)]">
      <section className="border-b border-[var(--loombus-border)] bg-[radial-gradient(circle_at_top_left,color-mix(in_srgb,var(--loombus-gold)_18%,transparent),transparent_42%)] px-4 py-7 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[color:color-mix(in_srgb,var(--loombus-gold)_45%,var(--loombus-border))] bg-[var(--loombus-gold-surface)] px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-[var(--loombus-gold)]">
                <Users className="size-3.5" aria-hidden="true" />
                A Loombus investing destination
              </div>
              <h1 className="text-4xl font-black tracking-tight sm:text-5xl">The Floor</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--loombus-text-muted)] sm:text-lg">
                Research the idea. Challenge the reasoning. Track the call. Study the outcome.
              </p>
            </div>
            <div className="rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 shadow-xl shadow-black/10 lg:max-w-sm">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--loombus-text-subtle)]">The Floor standard</p>
              <p className="mt-2 text-sm font-bold leading-6 text-[var(--loombus-text)]">
                Loombus provides research tools, AI challenge, accountability, and track records. It does not issue buy or sell ratings.
              </p>
            </div>
          </div>

          <nav aria-label="The Floor" className="mt-6 flex gap-2 overflow-x-auto pb-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              const classes = "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 text-sm font-black transition hover:border-[color:color-mix(in_srgb,var(--loombus-gold)_55%,var(--loombus-border))]";
              if (item.pending) {
                return (
                  <span key={item.label} className={`${classes} cursor-default text-[var(--loombus-text-subtle)]`} title={`${item.label} is coming in a future milestone`}>
                    <Icon className="size-4" aria-hidden="true" />
                    {item.label}
                    <span className="rounded-full bg-[var(--loombus-surface-muted)] px-2 py-0.5 text-[9px] uppercase tracking-wide">Soon</span>
                  </span>
                );
              }
              return (
                <Link key={item.label} href={item.href} className={classes}>
                  <Icon className="size-4 text-[var(--loombus-gold)]" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </section>

      <TheFloorOpeningBell />

      <section id="research-feed" aria-labelledby="research-feed-title" className="border-t border-[var(--loombus-border)]">
        <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 lg:px-8">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--loombus-gold)]">Research</p>
          <h2 id="research-feed-title" className="mt-1 text-2xl font-black">Accountable theses</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--loombus-text-muted)]">
            Every thesis includes a stance, conviction, horizon, exit plan, risks, catalysts, and the option to attach falsifiable calls.
          </p>
        </div>
        {children}
      </section>
    </div>
  );
}