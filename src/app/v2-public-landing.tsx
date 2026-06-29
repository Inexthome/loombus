"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Bookmark, MessageCircle, Search, ShieldCheck, Sparkles, Users } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

const publicSignals = [
  {
    title: "Structured discussions",
    description: "Follow questions, context, replies, and signal without losing the thread.",
    Icon: MessageCircle,
  },
  {
    title: "People and topics",
    description: "Find thoughtful contributors, saved ideas, and topics worth returning to.",
    Icon: Users,
  },
  {
    title: "Search with intent",
    description: "Move through discussions, people, saved items, and activity with clearer navigation.",
    Icon: Search,
  },
];

export function V2PublicLanding() {
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        if (data.session) {
          window.location.replace("/v2");
          return;
        }
        setCheckingSession(false);
      })
      .catch(() => {
        if (mounted) setCheckingSession(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main className="min-h-screen overflow-hidden bg-[#05070b] text-white">
      <section className="relative isolate min-h-screen px-5 py-6 sm:px-8 lg:px-12">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.24),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.16),transparent_34%)]" />
        <div className="absolute inset-x-0 top-0 -z-10 h-48 bg-gradient-to-b from-white/10 to-transparent" />

        <header className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 font-black tracking-tight">
            <img src="/assets/brand/loombus-mark-transparent.png" alt="" className="size-10 object-contain" />
            <span className="text-xl">Loombus</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/home" className="rounded-full border border-white/15 px-4 py-2 text-sm font-bold text-slate-100 transition hover:border-white/30 hover:bg-white/10">
              Sign in
            </Link>
            <Link href="/home" className="hidden rounded-full bg-white px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-slate-200 sm:inline-flex">
              Join Loombus
            </Link>
          </div>
        </header>

        <section className="mx-auto grid max-w-7xl gap-10 pb-16 pt-16 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center lg:pt-24">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-blue-100">
              <Sparkles className="size-4" />
              Loombus V2
            </div>
            <h1 className="text-5xl font-black tracking-tight sm:text-6xl lg:text-7xl">
              You deserve better than the scroll.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
              Loombus is a signal-first discussion platform built for clearer conversations, stronger ideas, and less noise.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/home" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-base font-black text-slate-950 shadow-2xl shadow-blue-950/40 transition hover:bg-slate-200">
                Get started
                <ArrowRight className="size-5" />
              </Link>
              <Link href="/v2/discussions" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 px-6 py-4 text-base font-black text-white transition hover:border-white/35 hover:bg-white/10">
                Explore discussions
              </Link>
            </div>
            {checkingSession && <p className="mt-4 text-sm font-semibold text-slate-400">Checking your session...</p>}
          </div>

          <aside className="rounded-[2rem] border border-white/15 bg-white/[0.08] p-5 shadow-2xl shadow-black/40 backdrop-blur-xl">
            <div className="rounded-[1.5rem] border border-white/10 bg-black/30 p-5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-100">Signal brief</p>
              <h2 className="mt-3 text-2xl font-black">A cleaner way to follow what matters.</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                V2 brings the discussion shell forward while V1 code remains intact as features continue moving over safely.
              </p>
            </div>
            <div className="mt-4 grid gap-3">
              {publicSignals.map(({ title, description, Icon }) => (
                <article key={title} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-blue-500/15 text-blue-100 ring-1 ring-blue-300/20">
                      <Icon className="size-5" />
                    </span>
                    <div>
                      <h3 className="font-black text-white">{title}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-300">{description}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                <ShieldCheck className="mb-3 size-5 text-emerald-200" />
                <p className="text-sm font-black">Safer rollout</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">V1 remains available in code while V2 becomes the front door.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                <Bookmark className="mb-3 size-5 text-amber-200" />
                <p className="text-sm font-black">Still wiring</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">Missing V1 features can move into V2 one controlled PR at a time.</p>
              </div>
            </div>
          </aside>
        </section>
      </section>
    </main>
  );
}
