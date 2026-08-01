import { Users } from "lucide-react";
import type { ReactNode } from "react";
import TheFloorOpeningBell from "@/components/the-floor-opening-bell";

export default function TheFloorExperience({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[color:var(--loombus-page-bg)] text-[color:var(--loombus-text)]">
      <section className="border-b border-[var(--loombus-border)] bg-[linear-gradient(110deg,#111315_0%,#0b0c0d_58%,#191508_100%)] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[color:color-mix(in_srgb,var(--loombus-gold)_45%,var(--loombus-border))] bg-[var(--loombus-gold-surface)] px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-[var(--loombus-gold)]">
                <Users className="size-3.5" aria-hidden="true" />
                A Loombus investing destination
              </div>
              <h1 className="text-4xl font-black tracking-tight sm:text-5xl">The Market Desk</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--loombus-text-muted)] sm:text-lg">
                Market context, accountable research, and investor intelligence in one workspace.
              </p>
            </div>
            <div className="rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 shadow-xl shadow-black/10 lg:max-w-sm">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--loombus-text-subtle)]">Today&apos;s research standard</p>
              <p className="mt-2 text-sm font-bold leading-6 text-[var(--loombus-text)]">
                Loombus provides research tools, AI challenge, accountability, and track records. It does not issue buy or sell ratings.
              </p>
            </div>
          </div>

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
