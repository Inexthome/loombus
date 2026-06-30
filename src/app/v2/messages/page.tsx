"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2, Lock, Mail } from "lucide-react";
import CurrentMessagesPage from "@/app/messages/page";
import { supabase } from "@/lib/supabase/client";
import {
  getDefaultShellPayload,
  V2ShellMobileNav,
  V2ShellTopNav,
  type ShellPayload,
} from "../v2-shell-components";

function MessagesGateCard({
  title,
  message,
  loading = false,
  payload,
}: {
  title: string;
  message: string;
  loading?: boolean;
  payload?: ShellPayload | null;
}) {
  return (
    <main className="fixed inset-0 z-[80] flex min-h-screen items-center justify-center bg-stone-50 px-4 py-10 text-slate-950">
      <section className="w-full max-w-2xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-900/10 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-amber-50 text-amber-800 ring-1 ring-amber-200">
            {loading ? <Loader2 className="size-5 animate-spin" /> : <Lock className="size-5" />}
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-700">Loombus Messages</p>
            <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{title}</h1>
          </div>
        </div>
        <p className="text-sm font-medium leading-6 text-slate-600 sm:text-base">{message}</p>
        {payload ? <p className="mt-5 text-xs font-bold text-slate-500">v2_shell: {payload.flags.v2_shell ? "on" : "off"}</p> : null}
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/login?next=/v2/messages" className="rounded-2xl bg-amber-300 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-amber-400">
            Sign in
          </Link>
          <Link href="/v2" className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:text-slate-950">
            Back to V2 Home
          </Link>
          <Link href="/messages" className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:text-slate-950">
            Open current Messages
          </Link>
        </div>
      </section>
    </main>
  );
}

export default function V2MessagesPage() {
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadShell() {
    setLoading(true);
    setMessage("");

    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const response = await fetch("/api/v2/shell", {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      const nextPayload = (await response.json().catch(() => getDefaultShellPayload())) as ShellPayload;
      setPayload(nextPayload);
    } catch {
      setPayload(getDefaultShellPayload());
      setMessage("Unable to verify V2 Messages access. Current Messages remains available.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadShell();
    const { data } = supabase.auth.onAuthStateChange(() => {
      void loadShell();
    });
    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return <MessagesGateCard title="Checking Messages access" message="Loombus is preparing your private conversations." loading />;
  }

  if (message) {
    return <MessagesGateCard title="Messages check failed safely" message={message} payload={payload} />;
  }

  if (!payload?.authenticated) {
    return <MessagesGateCard title="Sign in required" message="Messages are private. Sign in first so Loombus can open your conversations safely." payload={payload} />;
  }

  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") {
    return <MessagesGateCard title="V2 Messages is not enabled" message="This account is not currently allowed through the v2_shell flag. You can continue using the current Messages experience." payload={payload} />;
  }

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7fbff] loombus-v2-page-bg text-slate-950">
      <V2ShellTopNav />
      <section className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-3 rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-700">Private messages</p>
            <h1 className="mt-2 flex items-center gap-2 text-3xl font-black tracking-tight text-slate-950">
              <Mail className="size-7 text-slate-700" />
              Messages
            </h1>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
              Live private conversations between mutual followers, wired through the existing safe Messages API.
            </p>
          </div>
          <Link href="/messages" className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:border-slate-300 hover:text-slate-950">
            Current Messages
          </Link>
        </div>

        <CurrentMessagesPage />
      </section>
      <V2ShellMobileNav />
    </main>
  );
}
