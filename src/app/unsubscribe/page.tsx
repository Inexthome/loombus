"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type UnsubscribeState = "checking" | "success" | "error";

export default function UnsubscribePage() {
  const [state, setState] = useState<UnsubscribeState>("checking");
  const [message, setMessage] = useState("Processing your unsubscribe request...");

  useEffect(() => {
    async function unsubscribe() {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");

      if (!token) {
        setState("error");
        setMessage("This unsubscribe link is missing a token.");
        return;
      }

      try {
        const response = await fetch("/api/email/unsubscribe", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token }),
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          setState("error");
          setMessage(result.error ?? "Unable to unsubscribe from email digests.");
          return;
        }

        setState("success");
        setMessage(result.message ?? "Email digests are now turned off.");
      } catch {
        setState("error");
        setMessage("Unable to unsubscribe from email digests.");
      }
    }

    unsubscribe();
  }, []);

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-3xl">
        <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
          <p className="mb-4 text-sm uppercase tracking-[0.3em] text-zinc-500">
            Email preferences
          </p>

          <h1 className="mb-5 text-4xl font-semibold tracking-tight">
            {state === "success"
              ? "You are unsubscribed."
              : state === "error"
                ? "Unsubscribe problem."
                : "Unsubscribing..."}
          </h1>

          <p className="mb-8 leading-relaxed text-zinc-400">{message}</p>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/profile"
              className="rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200"
            >
              Manage notification settings
            </Link>

            <Link
              href="/"
              className="rounded-full border border-zinc-800 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-600 hover:text-white"
            >
              Back to Loombus
            </Link>
          </div>

          <p className="mt-8 text-sm text-zinc-600">
            This only turns off Loombus email digests. In-app notifications and
            required account, security, billing, and support emails are not
            changed.
          </p>
        </section>
      </div>
    </main>
  );
}
