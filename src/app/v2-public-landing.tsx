"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, MessageCircle, Search, Users } from "lucide-react";
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
    <main data-loombus-public-landing className="min-h-screen overflow-hidden bg-stone-50 text-slate-950">
      <section className="relative isolate min-h-screen px-5 py-6 sm:px-8 lg:px-12">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-amber-50 via-stone-50 to-slate-100" />
        <div className="absolute inset-x-0 top-0 -z-10 h-56 bg-gradient-to-b from-white to-transparent" />

        <header className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 font-black tracking-tight text-slate-950">
            <img src="/assets/brand/loombus-mark-transparent.png" alt="" className="size-10 object-contain" />
            <span className="text-xl">Loombus</span>
          </Link>
          <Link href="/login" className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-black text-slate-950 shadow-lg shadow-slate-900/10 transition hover:border-slate-400 hover:bg-slate-50">
            Join Loombus
          </Link>
        </header>

        <section className="mx-auto grid max-w-7xl gap-10 pb-16 pt-24 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center lg:pt-32">
          <div className="max-w-3xl">
            <h1 className="text-5xl font-black tracking-tight text-slate-950 sm:text-6xl lg:text-7xl">
              You deserve better than the scroll.
            </h1>
            <p className="mt-6 max-w-2xl text-lg font-medium leading-8 text-slate-700 sm:text-xl">
              Loombus is a signal-first discussion platform built for clearer conversations, stronger ideas, and less noise.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/login" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-300 bg-amber-300 px-6 py-4 text-base font-black text-slate-950 shadow-2xl shadow-amber-900/15 transition hover:bg-amber-400">
                Get started
                <ArrowRight className="size-5" />
              </Link>
              <Link href="/v2/discussions" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-6 py-4 text-base font-black text-slate-900 shadow-sm transition hover:border-slate-400 hover:bg-slate-50">
                Explore discussions
              </Link>
            </div>
            {checkingSession && <p className="mt-4 text-sm font-semibold text-slate-600">Checking your session...</p>}
          </div>

          <aside className="rounded-[2rem] border border-slate-300 bg-white/90 p-5 shadow-2xl shadow-slate-900/15 backdrop-blur-xl">
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-700">Signal brief</p>
              <h2 className="mt-3 text-2xl font-black text-slate-950">A cleaner way to follow what matters.</h2>
              <p className="mt-3 text-sm font-medium leading-6 text-slate-700">
                Follow discussions with clearer structure, stronger context, and fewer distractions.
              </p>
            </div>
            <div className="mt-4 grid gap-3">
              {publicSignals.map(({ title, description, Icon }) => (
                <article key={title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-800 ring-1 ring-amber-200">
                      <Icon className="size-5" />
                    </span>
                    <div>
                      <h3 className="font-black text-slate-950">{title}</h3>
                      <p className="mt-1 text-sm font-medium leading-6 text-slate-700">{description}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </aside>
        </section>
      </section>
    </main>
  );
}
