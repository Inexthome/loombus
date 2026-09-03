"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type State = "working" | "done" | "error";

export default function EmailUnsubscribeClient() {
  const [state, setState] = useState<State>("working");
  const [message, setMessage] = useState("Updating your Loombus email preferences…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const scope = params.get("scope") || undefined;

    if (!token) {
      setState("error");
      setMessage("This unsubscribe link is incomplete.");
      return;
    }

    fetch("/api/email/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, scope }),
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error || "Unable to update email preferences.");
        return payload;
      })
      .then((payload) => {
        setState("done");
        setMessage(payload?.message || "Your Loombus email preferences have been updated.");
      })
      .catch((error) => {
        setState("error");
        setMessage(error instanceof Error ? error.message : "Unable to update email preferences.");
      });
  }, []);

  return (
    <main className="min-h-screen bg-neutral-950 px-5 py-20 text-neutral-100">
      <section className="mx-auto max-w-xl rounded-3xl border border-neutral-800 bg-neutral-900 p-8 shadow-2xl">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[#CBAB5B]">Loombus</p>
        <h1 className="text-3xl font-semibold">Email preferences</h1>
        <p className="mt-4 leading-7 text-neutral-300" aria-live="polite">{message}</p>
        {state === "working" ? <p className="mt-6 text-sm text-neutral-500">Please keep this page open for a moment.</p> : null}
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/discussions" className="rounded-full bg-[#CBAB5B] px-5 py-3 font-semibold text-neutral-950">Return to Loombus</Link>
          {state === "error" ? <Link href="/support" className="rounded-full border border-neutral-700 px-5 py-3 font-semibold">Contact Support</Link> : null}
        </div>
      </section>
    </main>
  );
}
