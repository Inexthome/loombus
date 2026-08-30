"use client";

import { BellRing, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type PushStatus = {
  title: string;
  body: string;
  question: {
    id: string;
    discussionId: string;
    discussionTitle: string;
    weekStart: string;
    weekEnd: string;
    deleted: boolean;
    audienceType: string;
  };
  eligibleUsers: number;
  eligibleTokens: number;
  alreadySent: boolean;
  sentAt: string | null;
};

async function adminFetch(init?: RequestInit) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in again to use Admin controls.");

  const response = await fetch("/api/admin/question-of-the-week/push-announcement", {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || "Push announcement request failed.");
  return payload;
}

export default function QuestionOfWeekPushControl() {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      setStatus((await adminFetch()) as PushStatus);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load push announcement status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function sendAnnouncement() {
    if (!status || status.alreadySent || status.question.deleted) return;

    const confirmed = window.confirm(
      `Send this Question of the Week launch push to ${status.eligibleUsers.toLocaleString()} eligible Loombus user${status.eligibleUsers === 1 ? "" : "s"}?\n\nThis sends immediately to every active registered push device and cannot be undone.`
    );
    if (!confirmed) return;

    setSending(true);
    setMessage("");
    try {
      const result = (await adminFetch({ method: "POST" })) as {
        acceptedTokens: number;
        failedTokens: number;
        skippedTokens: number;
      };
      await load();
      setMessage(
        `Announcement submitted. ${result.acceptedTokens.toLocaleString()} device${result.acceptedTokens === 1 ? "" : "s"} accepted the push; ${result.failedTokens.toLocaleString()} failed and ${result.skippedTokens.toLocaleString()} were skipped.`
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to send the QOTW announcement.");
    } finally {
      setSending(false);
    }
  }

  return (
    <aside className="bg-[color:var(--loombus-page-bg)] px-4 pb-24 text-[color:var(--loombus-text)] sm:px-6 lg:px-8" aria-labelledby="qotw-push-heading">
      <section className="mx-auto max-w-5xl border-t border-[color:var(--loombus-border)] pt-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#CBAB5B]">Launch announcement</p>
            <h2 id="qotw-push-heading" className="mt-1 text-2xl font-semibold">Question of the Week push notification</h2>
            <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
              Send one guarded announcement to members with an active registered iOS or Android push device. Tapping it opens the current Question of the Week discussion directly.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading || sending}
            className="inline-flex min-h-11 items-center justify-center gap-2 border border-[color:var(--loombus-border)] px-4 text-sm font-semibold disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CBAB5B]"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
            Refresh audience
          </button>
        </div>

        {status ? (
          <div className="mt-6 border-t border-[color:var(--loombus-border-muted)] pt-6">
            <p className="text-sm font-semibold">{status.question.discussionTitle}</p>
            <div className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[color:var(--loombus-text-subtle)]">Push title</p>
                <p className="mt-1">{status.title}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[color:var(--loombus-text-subtle)]">Eligible audience</p>
                <p className="mt-1">{status.eligibleUsers.toLocaleString()} users · {status.eligibleTokens.toLocaleString()} devices</p>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[color:var(--loombus-text-subtle)]">Message</p>
              <p className="mt-1 text-sm leading-6 text-[color:var(--loombus-text-muted)]">{status.body}</p>
            </div>

            {status.question.deleted ? (
              <p className="mt-5 border border-[#CBAB5B] p-4 text-sm">Restore this Question of the Week discussion before sending its launch announcement.</p>
            ) : status.alreadySent ? (
              <p className="mt-5 border border-[color:var(--loombus-border)] p-4 text-sm">
                Announcement already sent{status.sentAt ? ` on ${new Date(status.sentAt).toLocaleString()}` : ""}. Duplicate sending is blocked.
              </p>
            ) : (
              <button
                type="button"
                disabled={sending || loading || status.eligibleUsers === 0}
                onClick={() => void sendAnnouncement()}
                className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 bg-[#CBAB5B] px-5 text-sm font-bold text-black disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CBAB5B]"
              >
                <BellRing className="h-4 w-4" aria-hidden="true" />
                {sending ? "Sending…" : "Send QOTW announcement"}
              </button>
            )}
          </div>
        ) : null}

        {message ? <p className="mt-5 text-sm leading-6 text-[color:var(--loombus-text-muted)]" role="status">{message}</p> : null}
      </section>
    </aside>
  );
}
