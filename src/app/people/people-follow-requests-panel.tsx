"use client";

import { ProfileAvatar } from "@/components/profile-avatar";
import { supabase } from "@/lib/supabase/client";
import { Check, Clock3, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type RequestProfile = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
};

type ReceivedRequest = {
  id: string;
  createdAt: string;
  requester: RequestProfile;
};

type SentRequest = {
  id: string;
  createdAt: string;
  target: RequestProfile;
};

type RequestTab = "received" | "sent";

type RequestPayload = {
  requests?: ReceivedRequest[];
  receivedRequests?: ReceivedRequest[];
  sentRequests?: SentRequest[];
  error?: string;
};

async function getSessionToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

function profileName(profile: RequestProfile) {
  return profile.full_name?.trim() || profile.username?.trim() || "Loombus member";
}

function profileHref(profile: RequestProfile) {
  return profile.username ? `/u/${encodeURIComponent(profile.username)}` : "/people";
}

function formatRequestDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Pending";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  }).format(date);
}

export default function PeopleFollowRequestsPanel() {
  const [tab, setTab] = useState<RequestTab>("received");
  const [received, setReceived] = useState<ReceivedRequest[]>([]);
  const [sent, setSent] = useState<SentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const requestedTab = new URLSearchParams(window.location.search).get("request");
    if (requestedTab === "sent" || requestedTab === "received") setTab(requestedTab);
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("view", "requests");
    url.searchParams.set("request", tab);
    window.history.replaceState({}, "", url);
  }, [tab]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setNotice("");
      const token = await getSessionToken();
      if (!token) {
        window.location.href = "/login?next=/people?view=requests";
        return;
      }

      const response = await fetch("/api/follows/requests?scope=all", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => ({}))) as RequestPayload;
      if (cancelled) return;

      if (!response.ok) {
        setNotice(payload.error ?? "Follow requests could not load.");
        setReceived([]);
        setSent([]);
      } else {
        setReceived(payload.receivedRequests ?? payload.requests ?? []);
        setSent(payload.sentRequests ?? []);
      }
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function respond(request: ReceivedRequest, action: "accept" | "decline") {
    if (workingId) return;
    setWorkingId(request.id);
    setNotice("");

    const token = await getSessionToken();
    if (!token) {
      window.location.href = "/login?next=/people?view=requests&request=received";
      return;
    }

    const response = await fetch("/api/follows/requests", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ requestId: request.id, action }),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setNotice(payload.error ?? "Unable to update this follow request.");
    } else {
      setReceived((current) => current.filter((item) => item.id !== request.id));
      setNotice(
        action === "accept"
          ? `${profileName(request.requester)} can now follow you.`
          : `Declined ${profileName(request.requester)}'s follow request.`
      );
      window.dispatchEvent(new Event("loombus:notifications-changed"));
    }
    setWorkingId("");
  }

  async function cancel(request: SentRequest) {
    if (workingId) return;
    setWorkingId(request.id);
    setNotice("");

    const token = await getSessionToken();
    if (!token) {
      window.location.href = "/login?next=/people?view=requests&request=sent";
      return;
    }

    const response = await fetch("/api/follows/toggle", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ targetUserId: request.target.id }),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setNotice(payload.error ?? "Unable to cancel this follow request.");
    } else if (payload.requested) {
      setNotice("The follow request is still pending. Refresh and try again.");
    } else {
      setSent((current) => current.filter((item) => item.id !== request.id));
      setNotice(`Cancelled your follow request to ${profileName(request.target)}.`);
    }
    setWorkingId("");
  }

  const rows = useMemo(() => (tab === "received" ? received : sent), [received, sent, tab]);

  return (
    <section className="rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 sm:p-6" aria-labelledby="people-follow-requests-heading">
      <div className="flex flex-col gap-4 border-b border-[var(--loombus-border)] pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-[var(--loombus-gold)]">Requests</p>
          <h2 id="people-follow-requests-heading" className="mt-1 text-2xl font-bold">Manage follow requests</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--loombus-text-muted)]">
            Approve or decline people asking to follow you, or review requests you sent to private accounts.
          </p>
        </div>
        <Link href="/settings?section=privacy-safety" className="text-sm font-semibold text-[var(--loombus-text-muted)] underline decoration-[var(--loombus-border)] underline-offset-4">
          Privacy settings
        </Link>
      </div>

      <div className="mt-4 flex gap-2" role="tablist" aria-label="Follow request direction">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "received"}
          onClick={() => setTab("received")}
          className={`min-h-11 rounded-xl border px-4 text-sm font-semibold ${tab === "received" ? "border-[var(--loombus-gold-strong)] bg-[var(--loombus-gold-strong)] text-[var(--loombus-gold-contrast)]" : "border-[var(--loombus-border)] text-[var(--loombus-text-muted)]"}`}
        >
          Received {received.length ? `(${received.length})` : ""}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "sent"}
          onClick={() => setTab("sent")}
          className={`min-h-11 rounded-xl border px-4 text-sm font-semibold ${tab === "sent" ? "border-[var(--loombus-gold-strong)] bg-[var(--loombus-gold-strong)] text-[var(--loombus-gold-contrast)]" : "border-[var(--loombus-border)] text-[var(--loombus-text-muted)]"}`}
        >
          Sent {sent.length ? `(${sent.length})` : ""}
        </button>
      </div>

      {notice ? (
        <div className="mt-4 rounded-xl border border-[var(--loombus-border)] px-4 py-3 text-sm text-[var(--loombus-text-muted)]" role="status">
          {notice}
        </div>
      ) : null}

      {loading ? (
        <p className="py-8 text-sm text-[var(--loombus-text-muted)]">Loading follow requests…</p>
      ) : rows.length === 0 ? (
        <div className="py-10 text-center">
          <Clock3 className="mx-auto size-8 text-[var(--loombus-gold)]" aria-hidden="true" />
          <h3 className="mt-3 text-lg font-bold">{tab === "received" ? "No requests are waiting." : "No sent requests are pending."}</h3>
          <p className="mt-2 text-sm text-[var(--loombus-text-muted)]">
            {tab === "received"
              ? "New requests to follow your private account will appear here and in Notifications."
              : "Requests you send to private accounts will remain here until accepted, declined, or cancelled."}
          </p>
        </div>
      ) : (
        <div className="mt-4 divide-y divide-[var(--loombus-border)]">
          {tab === "received"
            ? received.map((request) => {
                const busy = workingId === request.id;
                return (
                  <article key={request.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                    <Link href={profileHref(request.requester)} className="flex min-w-0 flex-1 items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[#CBAB5B] focus-visible:ring-offset-2">
                      <ProfileAvatar profile={request.requester} size="lg" />
                      <span className="min-w-0">
                        <strong className="block truncate text-sm">{profileName(request.requester)}</strong>
                        <span className="block truncate text-xs text-[var(--loombus-text-muted)]">
                          {request.requester.username ? `@${request.requester.username} · ` : ""}{formatRequestDate(request.createdAt)}
                        </span>
                      </span>
                    </Link>
                    <div className="flex gap-2 sm:justify-end">
                      <button type="button" disabled={Boolean(workingId)} onClick={() => void respond(request, "decline")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--loombus-border)] px-4 text-sm font-semibold disabled:opacity-50">
                        <X className="size-4" aria-hidden="true" /> Decline
                      </button>
                      <button type="button" disabled={Boolean(workingId)} onClick={() => void respond(request, "accept")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--loombus-gold-strong)] px-4 text-sm font-semibold text-[var(--loombus-gold-contrast)] disabled:opacity-50">
                        <Check className="size-4" aria-hidden="true" /> {busy ? "Working…" : "Approve"}
                      </button>
                    </div>
                  </article>
                );
              })
            : sent.map((request) => {
                const busy = workingId === request.id;
                return (
                  <article key={request.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                    <Link href={profileHref(request.target)} className="flex min-w-0 flex-1 items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[#CBAB5B] focus-visible:ring-offset-2">
                      <ProfileAvatar profile={request.target} size="lg" />
                      <span className="min-w-0">
                        <strong className="block truncate text-sm">{profileName(request.target)}</strong>
                        <span className="block truncate text-xs text-[var(--loombus-text-muted)]">
                          {request.target.username ? `@${request.target.username} · ` : ""}Pending since {formatRequestDate(request.createdAt)}
                        </span>
                      </span>
                    </Link>
                    <button type="button" disabled={Boolean(workingId)} onClick={() => void cancel(request)} className="min-h-11 rounded-xl border border-[var(--loombus-border)] px-4 text-sm font-semibold text-[var(--loombus-text-muted)] disabled:opacity-50">
                      {busy ? "Cancelling…" : "Cancel request"}
                    </button>
                  </article>
                );
              })}
        </div>
      )}
    </section>
  );
}
