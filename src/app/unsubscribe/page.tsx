"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type UnsubscribeState = "checking" | "success" | "error";
type UnsubscribeScope = "account" | "room" | null;

export default function UnsubscribePage() {
  const [state, setState] = useState<UnsubscribeState>("checking");
  const [scope, setScope] = useState<UnsubscribeScope>(null);
  const [roomId, setRoomId] = useState("");
  const [message, setMessage] = useState(
    "Processing your unsubscribe request..."
  );

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
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const result = (await response.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
          scope?: UnsubscribeScope;
          roomId?: string;
        };

        if (!response.ok) {
          setState("error");
          setMessage(result.error ?? "Unable to unsubscribe from email digests.");
          return;
        }

        setScope(result.scope ?? null);
        setRoomId(result.roomId ?? "");
        setState("success");
        setMessage(result.message ?? "The selected email digest is now turned off.");
      } catch {
        setState("error");
        setMessage("Unable to unsubscribe from email digests.");
      }
    }

    void unsubscribe();
  }, []);

  const settingsHref =
    scope === "room" && roomId
      ? `/rooms/${encodeURIComponent(roomId)}/notifications`
      : "/settings#signal";

  return (
    <main
      data-loombus-auth-shell
      className="min-h-screen bg-black px-6 py-16 text-white"
    >
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
              href={settingsHref}
              className="rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200"
            >
              {scope === "room"
                ? "Manage Room notifications"
                : "Manage notification settings"}
            </Link>

            <Link
              href="/"
              className="rounded-full border border-zinc-800 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-600 hover:text-white"
            >
              Back to Loombus
            </Link>
          </div>

          <p className="mt-8 text-sm text-zinc-600">
            This link only turns off the account or Room digest identified by the
            link. In-app notifications and required account, security, billing,
            and support emails are not changed.
          </p>
        </section>
      </div>
    </main>
  );
}
