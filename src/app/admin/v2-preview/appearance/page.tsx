"use client";

import Link from "next/link";
import { Monitor, Moon, Sun } from "lucide-react";

const themes = [
  {
    key: "system",
    label: "System",
    description: "Follows the member’s device setting and automatically uses the matching Loombus theme.",
    icon: Monitor,
    shellClass: "from-slate-950 via-slate-900 to-blue-950",
    outerTextClass: "text-white",
    mutedTextClass: "text-slate-300",
    panelClass: "border-white/10 bg-white/10 text-white",
    iconWrapClass: "bg-blue-600 text-white",
    badgeClass: "bg-slate-950/70 text-blue-200 ring-1 ring-white/10",
    buttonClass: "bg-white text-slate-950",
    note: "Best default for most users.",
  },
  {
    key: "dark_gold",
    label: "Dark with Gold",
    description: "The Loombus identity theme: dark, premium, focused, and gold-accented.",
    icon: Moon,
    shellClass: "from-[#060606] via-[#11100b] to-[#2b2108]",
    outerTextClass: "text-[#fff8df]",
    mutedTextClass: "text-[#e5d7a5]",
    panelClass: "border-[#d4af37]/25 bg-[#0d0c08] text-[#fff8df]",
    iconWrapClass: "bg-[#d4af37] text-black",
    badgeClass: "bg-[#d4af37] text-black",
    buttonClass: "bg-[#d4af37] text-black",
    note: "Use this as the branded dark mode.",
  },
  {
    key: "light_blue",
    label: "Light with Blue",
    description: "The current clean Loombus feel: bright, simple, familiar, and blue-accented.",
    icon: Sun,
    shellClass: "from-white via-slate-50 to-blue-100",
    outerTextClass: "text-slate-950",
    mutedTextClass: "text-slate-600",
    panelClass: "border-blue-100 bg-white text-slate-950",
    iconWrapClass: "bg-blue-600 text-white",
    badgeClass: "bg-blue-600 text-white",
    buttonClass: "bg-blue-600 text-white",
    note: "Use this as the branded light mode.",
  },
] as const;

function ThemeMockup({ theme }: { theme: (typeof themes)[number] }) {
  const Icon = theme.icon;

  return (
    <article className={`overflow-hidden rounded-[2rem] bg-gradient-to-br p-5 shadow-2xl ${theme.shellClass} ${theme.outerTextClass}`}>
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`grid size-11 place-items-center rounded-2xl ${theme.iconWrapClass}`}>
            <Icon className="size-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold">{theme.label}</h2>
            <p className={`text-sm ${theme.mutedTextClass}`}>{theme.key}</p>
          </div>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${theme.badgeClass}`}>
          V2
        </span>
      </div>

      <div className={`rounded-3xl border p-5 ${theme.panelClass}`}>
        <div className="mb-5 flex items-center justify-between">
          <p className="font-semibold">Loombus</p>
          <div className="flex gap-2">
            <span className="size-3 rounded-full bg-current opacity-30" />
            <span className="size-3 rounded-full bg-current opacity-50" />
            <span className="size-3 rounded-full bg-current opacity-70" />
          </div>
        </div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] opacity-60">Signal Brief</p>
        <h3 className="text-2xl font-bold tracking-tight">Welcome back, Saint.</h3>
        <p className="mt-2 text-sm leading-6 opacity-70">
          Here is what needs attention across your Loombus activity.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {["New Replies", "Saved", "Rooms"].map((item) => (
            <div key={item} className="rounded-2xl border border-current/10 bg-current/5 p-3">
              <p className="text-sm font-semibold">{item}</p>
              <p className="mt-1 text-xs opacity-60">Ready</p>
            </div>
          ))}
        </div>
        <button className={`mt-5 rounded-2xl px-4 py-2 text-sm font-bold ${theme.buttonClass}`}>
          View Discussion
        </button>
      </div>

      <p className={`mt-5 text-sm leading-6 ${theme.mutedTextClass}`}>{theme.description}</p>
      <p className="mt-2 text-sm font-semibold">{theme.note}</p>
    </article>
  );
}

export default function V2AppearancePreviewPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 rounded-[2rem] border border-white/10 bg-white/[0.03] p-6 shadow-2xl">
          <Link href="/admin/v2-preview" className="text-sm font-semibold text-blue-300">
            ← Back to V2 preview
          </Link>
          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.28em] text-blue-300">
            Admin Preview · Appearance
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            V2 Appearance Model
          </h1>
          <p className="mt-4 max-w-3xl leading-7 text-slate-300">
            V2 keeps the current light-blue look, adds a branded dark-gold Loombus identity theme, and preserves System as the default option.
          </p>
        </div>

        <section className="grid gap-6 xl:grid-cols-3">
          {themes.map((theme) => (
            <ThemeMockup key={theme.key} theme={theme} />
          ))}
        </section>

        <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.03] p-6 text-slate-300">
          <h2 className="text-2xl font-bold tracking-tight text-white">Recommended settings labels</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-white/10 p-5">
              <p className="font-bold text-white">System</p>
              <p className="mt-2 text-sm leading-6">Follows the user’s device setting.</p>
            </div>
            <div className="rounded-3xl border border-[#d4af37]/30 bg-[#d4af37]/10 p-5">
              <p className="font-bold text-[#f7d56d]">Dark with Gold</p>
              <p className="mt-2 text-sm leading-6">The main Loombus dark identity theme.</p>
            </div>
            <div className="rounded-3xl border border-blue-400/30 bg-blue-500/10 p-5">
              <p className="font-bold text-blue-200">Light with Blue</p>
              <p className="mt-2 text-sm leading-6">The current clean Loombus light theme.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
