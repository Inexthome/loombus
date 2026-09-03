"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Campaign = {
  id: string;
  subject: string;
  status: "prepared" | "sending" | "sent" | "failed";
  sender_email: string;
  eligible_count: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  completed_at: string | null;
};

type BroadcastState = {
  campaign: Campaign | null;
  preview: {
    subject: string;
    sender: string;
    eligibleCount: number;
    optedOutCount: number;
    totalAccounts: number;
  };
  providerConfigured: boolean;
};

type AccessState = "checking" | "allowed" | "denied" | "error";

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error("Your Admin session has expired.");
  return token;
}

async function callBroadcastApi(method: "GET" | "POST", body?: unknown) {
  const token = await getAccessToken();
  const response = await fetch("/api/admin/member-email", {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || "Member email request failed.");
  return payload;
}

export default function AdminCommunicationsClient() {
  const [access, setAccess] = useState<AccessState>("checking");
  const [state, setState] = useState<BroadcastState | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const payload = await callBroadcastApi("GET");
    setState(payload as BroadcastState);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!userData.user) {
          window.location.replace("/login?next=/admin/communications");
          return;
        }
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", userData.user.id)
          .maybeSingle();
        if (profileError) throw profileError;
        if (!mounted) return;
        if (!profile?.is_admin) {
          setAccess("denied");
          return;
        }
        setAccess("allowed");
        await load();
      } catch (error) {
        console.error(error);
        if (!mounted) return;
        setAccess("error");
        setMessage(error instanceof Error ? error.message : "Unable to load Admin Communications.");
      }
    })();
    return () => { mounted = false; };
  }, [load]);

  const progress = useMemo(() => {
    const campaign = state?.campaign;
    if (!campaign || campaign.eligible_count === 0) return 0;
    return Math.min(100, Math.round(((campaign.sent_count + campaign.failed_count) / campaign.eligible_count) * 100));
  }, [state?.campaign]);

  async function prepare() {
    setBusy(true);
    setMessage("");
    try {
      await callBroadcastApi("POST", { action: "prepare" });
      await load();
      setMessage("Campaign recipient snapshot prepared. No email has been sent yet.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to prepare campaign.");
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    setBusy(true);
    setMessage("Sending individual member emails…");
    try {
      let done = false;
      while (!done) {
        const payload = await callBroadcastApi("POST", { action: "send_batch" });
        done = Boolean(payload.done);
        await load();
      }
      setMessage("Campaign processing is complete. Review the delivery totals below.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Campaign sending stopped. You can resume safely.");
      await load().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  if (access === "checking") {
    return <main className="min-h-screen bg-neutral-950 p-8 text-neutral-100"><div className="mx-auto max-w-5xl">Verifying Admin access…</div></main>;
  }

  if (access === "denied") {
    return <main className="min-h-screen bg-neutral-950 p-8 text-neutral-100"><div className="mx-auto max-w-3xl rounded-3xl border border-neutral-800 bg-neutral-900 p-8"><h1 className="text-3xl font-semibold">Admin access is required.</h1><Link href="/discussions" className="mt-6 inline-block text-[#CBAB5B]">Return to Loombus</Link></div></main>;
  }

  if (access === "error" || !state) {
    return <main className="min-h-screen bg-neutral-950 p-8 text-neutral-100"><div className="mx-auto max-w-3xl rounded-3xl border border-neutral-800 bg-neutral-900 p-8"><h1 className="text-3xl font-semibold">Communications could not be loaded.</h1><p className="mt-4 text-neutral-300">{message}</p></div></main>;
  }

  const campaign = state.campaign;
  const canPrepare = !campaign;
  const canSend = Boolean(campaign && campaign.status !== "sent" && state.providerConfigured);

  return (
    <main className="min-h-screen bg-neutral-950 px-5 py-10 text-neutral-100">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#CBAB5B]">Loombus Admin</p>
            <h1 className="mt-2 text-4xl font-semibold">Member Communications</h1>
            <p className="mt-3 max-w-2xl text-neutral-400">Prepare, send, and audit member email campaigns. Every recipient is sent individually and suppression is checked again immediately before delivery.</p>
          </div>
          <Link href="/admin" className="rounded-full border border-neutral-700 px-5 py-3 font-semibold">Back to Admin</Link>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          {[
            ["Accounts", state.preview.totalAccounts],
            ["Eligible", state.preview.eligibleCount],
            ["Opted out", state.preview.optedOutCount],
            ["Provider", state.providerConfigured ? "Ready" : "Not configured"],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
              <p className="text-sm text-neutral-500">{label}</p>
              <p className="mt-2 text-2xl font-semibold">{value}</p>
            </div>
          ))}
        </section>

        <section className="rounded-3xl border border-neutral-800 bg-neutral-900 p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-neutral-500">Approved campaign</p>
              <h2 className="mt-1 text-2xl font-semibold">{state.preview.subject}</h2>
              <p className="mt-2 text-sm text-neutral-400">From: {state.preview.sender}</p>
            </div>
            <span className="rounded-full border border-neutral-700 px-3 py-1 text-sm capitalize">{campaign?.status || "not prepared"}</span>
          </div>

          <div className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-950 p-6 leading-7 text-neutral-300">
            <p>We've missed having you on Loombus.</p>
            <p className="mt-4">A lot has been happening since your last visit—new discussions, new ideas, and new ways to discover what's worth paying attention to.</p>
            <p className="mt-4">Come back and see what you've been missing.</p>
            <p className="mt-4">Loombus is built for thoughtful conversations, useful perspectives, and signal over noise.</p>
            <p className="mt-4">We'd love to have you back.</p>
            <p className="mt-4">— The Loombus Team</p>
            <span className="mt-6 inline-block rounded-full bg-[#CBAB5B] px-5 py-2 font-semibold text-neutral-950">See What's New</span>
          </div>

          {campaign ? (
            <div className="mt-6">
              <div className="mb-2 flex justify-between text-sm text-neutral-400"><span>Delivery progress</span><span>{progress}%</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-neutral-800"><div className="h-full bg-[#CBAB5B]" style={{ width: `${progress}%` }} /></div>
              <div className="mt-3 flex gap-5 text-sm text-neutral-400"><span>{campaign.sent_count} sent</span><span>{campaign.failed_count} failed</span><span>{campaign.eligible_count} snapshotted</span></div>
            </div>
          ) : null}

          {!state.providerConfigured ? <p className="mt-5 rounded-xl border border-amber-900/60 bg-amber-950/30 p-4 text-sm text-amber-200">RESEND_API_KEY is not available to this deployment. Sending remains disabled until the existing Loombus email provider is configured.</p> : null}
          {message ? <p className="mt-5 text-sm text-neutral-300" aria-live="polite">{message}</p> : null}

          <div className="mt-7 flex flex-wrap gap-3">
            <button type="button" onClick={() => void prepare()} disabled={!canPrepare || busy} className="rounded-full border border-neutral-700 px-5 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-40">{campaign ? "Recipients prepared" : busy ? "Preparing…" : "Prepare recipients"}</button>
            <button type="button" onClick={() => void send()} disabled={!canSend || busy} className="rounded-full bg-[#CBAB5B] px-5 py-3 font-semibold text-neutral-950 disabled:cursor-not-allowed disabled:opacity-40">{busy ? "Working…" : campaign?.status === "sent" ? "Campaign sent" : campaign?.status === "sending" || campaign?.status === "failed" ? "Resume sending" : "Send campaign"}</button>
          </div>
        </section>
      </div>
    </main>
  );
}
