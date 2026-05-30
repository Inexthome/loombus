"use client";

import Link from "next/link";

const attentionItems = [
  {
    title: "Discussions worth replying to",
    body: "Find conversations where your experience can add value.",
    href: "/discussions",
    label: "Discuss",
  },
  {
    title: "People with useful signal",
    body: "Follow thinkers, builders, and voices that sharpen your feed.",
    href: "/people",
    label: "People",
  },
  {
    title: "Saved ideas",
    body: "Return to the posts and notes you wanted to keep close.",
    href: "/saved",
    label: "Saved",
  },
];

const quickActions = [
  ["Discuss", "/discussions", "Browse signal"],
  ["Create", "/create", "Share insight"],
  ["People", "/people", "Find thinkers"],
  ["Alerts", "/notifications", "Check updates"],
];

const rhythm = [
  ["Read", "Find signal"],
  ["Reply", "Add value"],
  ["Save", "Return later"],
];

export default function MobileV3Home() {
  return (
    <main className="min-h-screen bg-[#070716] px-4 pb-28 pt-4 text-white">
      <section className="mx-auto max-w-md">
        <header className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-violet-300">
              Loombus
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight">
              Today&apos;s signal
            </h1>
          </div>

          <Link
            href="/profile"
            className="flex h-12 w-12 items-center justify-center rounded-3xl bg-white/10 text-xs font-black text-white ring-1 ring-white/10"
            aria-label="Open profile"
          >
            You
          </Link>
        </header>

        <section className="mb-5 overflow-hidden rounded-[2rem] bg-gradient-to-br from-violet-700 via-indigo-700 to-fuchsia-700 shadow-2xl shadow-violet-950/35">
          <div className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/70">
              Start here
            </p>
            <h2 className="mt-3 text-2xl font-black leading-tight">
              Read less noise. Find what is worth thinking about.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/78">
              Loombus is your place for useful discussion, real experience, and
              intelligent signal.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <Link
                href="/discussions"
                className="rounded-3xl bg-white px-4 py-3 text-center text-sm font-black text-violet-800 shadow-lg"
              >
                Browse
              </Link>
              <Link
                href="/create"
                className="rounded-3xl bg-white/15 px-4 py-3 text-center text-sm font-black text-white ring-1 ring-white/20"
              >
                Create
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-3 border-t border-white/15 bg-black/10">
            {rhythm.map(([title, body]) => (
              <div key={title} className="px-3 py-4 text-center">
                <p className="text-sm font-black text-white">{title}</p>
                <p className="mt-1 text-[10px] font-semibold leading-tight text-white/55">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-5 rounded-[1.75rem] border border-white/10 bg-white/[0.06] p-3">
          <div className="grid grid-cols-4 gap-2">
            {quickActions.map(([title, href, label]) => (
              <Link
                key={title}
                href={href}
                className="rounded-3xl bg-white/[0.07] px-2 py-3 text-center ring-1 ring-white/5"
              >
                <span className="block text-sm font-black text-white">
                  {title}
                </span>
                <span className="mt-1 block text-[10px] font-semibold leading-tight text-white/45">
                  {label}
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="mb-5 grid grid-cols-2 gap-3">
          <Link
            href="/following"
            className="rounded-[1.75rem] border border-white/10 bg-white/[0.07] p-4 shadow-xl shadow-black/20"
          >
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-violet-300">
              Following
            </p>
            <h3 className="mt-3 min-h-16 text-base font-black leading-tight text-white">
              See what your network is thinking through.
            </h3>
            <p className="mt-4 text-xs font-bold text-white/60">
              Open following
            </p>
          </Link>

          <Link
            href="/my-activity"
            className="rounded-[1.75rem] border border-white/10 bg-white/[0.07] p-4 shadow-xl shadow-black/20"
          >
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-violet-300">
              Activity
            </p>
            <h3 className="mt-3 min-h-16 text-base font-black leading-tight text-white">
              Track the signals you joined, saved, and started.
            </h3>
            <p className="mt-4 text-xs font-bold text-white/60">
              Review activity
            </p>
          </Link>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-base font-black text-white">
              Worth your attention
            </h2>
            <Link
              href="/discussions"
              className="text-xs font-black text-violet-300"
            >
              View all
            </Link>
          </div>

          {attentionItems.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="block rounded-[1.65rem] border border-white/10 bg-white p-4 text-zinc-950 shadow-xl shadow-black/25"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-[15px] font-black leading-snug">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-zinc-600">
                    {item.body}
                  </p>
                </div>
                <span className="rounded-full bg-violet-100 px-3 py-1 text-[11px] font-black text-violet-700">
                  {item.label}
                </span>
              </div>
            </Link>
          ))}
        </section>

        <section className="mt-5 rounded-[1.75rem] border border-white/10 bg-white/[0.06] p-4">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-300">
            Mobile direction
          </p>
          <h2 className="mt-3 text-lg font-black leading-tight text-white">
            App-first, not desktop squeezed down.
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-white/60">
            This home screen is built for thumb navigation, fast decisions, and
            clearer movement into the core Loombus flow.
          </p>
        </section>
      </section>
    </main>
  );
}
