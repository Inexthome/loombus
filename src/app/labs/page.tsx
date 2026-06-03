"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type AiEntitlement = {
  tier: string | null;
  ai_assisted_enabled: boolean | null;
  monthly_summary_limit: number | null;
} | null;

type LabsFeatureRequestStatus =
  | "submitted"
  | "reviewing"
  | "planned"
  | "shipped"
  | "declined";

type LabsFeatureRequest = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  status: LabsFeatureRequestStatus;
  admin_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  vote_count: number;
  voted_by_me: boolean;
};

const STATUS_LABELS: Record<LabsFeatureRequestStatus, string> = {
  submitted: "Submitted",
  reviewing: "Reviewing",
  planned: "Planned",
  shipped: "Shipped",
  declined: "Declined",
};

const STATUS_CLASSES: Record<LabsFeatureRequestStatus, string> = {
  submitted: "border-zinc-800 text-zinc-400",
  reviewing: "border-sky-800 bg-sky-950/30 text-sky-300",
  planned: "border-violet-800 bg-violet-950/30 text-violet-300",
  shipped: "border-emerald-800 bg-emerald-950/30 text-emerald-300",
  declined: "border-red-900 bg-red-950/20 text-red-300",
};

function hasLabsAccess(entitlement: AiEntitlement, isAdmin: boolean) {
  if (isAdmin) {
    return true;
  }

  return (
    entitlement?.ai_assisted_enabled === true &&
    entitlement.tier === "premium" &&
    (entitlement.monthly_summary_limit ?? 0) > 50
  );
}

export default function LabsPage() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [entitlement, setEntitlement] = useState<AiEntitlement>(null);
  const [requests, setRequests] = useState<LabsFeatureRequest[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const canUseLabs = hasLabsAccess(entitlement, isAdmin);

  useEffect(() => {
    async function loadLabs() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        setAuthChecked(true);
        setLoading(false);
        return;
      }

      setCurrentUserId(userData.user.id);

      const [{ data: profileData }, { data: entitlementData }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("is_admin")
            .eq("id", userData.user.id)
            .maybeSingle(),
          supabase
            .from("user_ai_entitlements")
            .select("tier, ai_assisted_enabled, monthly_summary_limit")
            .eq("user_id", userData.user.id)
            .maybeSingle(),
        ]);

      const resolvedIsAdmin = Boolean(profileData?.is_admin);
      const resolvedEntitlement = (entitlementData ?? null) as AiEntitlement;
      const resolvedCanUseLabs = hasLabsAccess(
        resolvedEntitlement,
        resolvedIsAdmin
      );

      setIsAdmin(resolvedIsAdmin);
      setEntitlement(resolvedEntitlement);

      if (resolvedCanUseLabs) {
        const { data: requestData, error: requestError } = await supabase
          .from("labs_feature_requests")
          .select("id, user_id, title, description, status, admin_note, reviewed_at, created_at, updated_at")
          .order("created_at", { ascending: false });

        if (requestError) {
          setMessage(`Unable to load Labs requests: ${requestError.message}`);
        } else {
          const loadedRequests = (requestData ?? []) as Omit<
            LabsFeatureRequest,
            "vote_count" | "voted_by_me"
          >[];

          const requestIds = loadedRequests.map((request) => request.id);
          let voteRows: { request_id: string; user_id: string }[] = [];

          if (requestIds.length > 0) {
            const { data: votes } = await supabase
              .from("labs_feature_request_votes")
              .select("request_id, user_id")
              .in("request_id", requestIds);

            voteRows = (votes ?? []) as { request_id: string; user_id: string }[];
          }

          const voteCounts = voteRows.reduce<Record<string, number>>(
            (counts, vote) => {
              counts[vote.request_id] = (counts[vote.request_id] ?? 0) + 1;
              return counts;
            },
            {}
          );

          const myVotes = new Set(
            voteRows
              .filter((vote) => vote.user_id === userData.user.id)
              .map((vote) => vote.request_id)
          );

          setRequests(
            loadedRequests.map((request) => ({
              ...request,
              vote_count: voteCounts[request.id] ?? 0,
              voted_by_me: myVotes.has(request.id),
            }))
          );
        }
      }

      setAuthChecked(true);
      setLoading(false);
    }

    loadLabs();
  }, []);

  const statusCounts = useMemo(() => {
    return requests.reduce<Record<string, number>>((counts, request) => {
      counts[request.status] = (counts[request.status] ?? 0) + 1;
      return counts;
    }, {});
  }, [requests]);

  async function toggleVote(requestId: string) {
    setMessage("");

    if (!currentUserId) {
      window.location.href = "/login";
      return;
    }

    if (!canUseLabs) {
      setMessage("Labs voting requires Premium Plus access.");
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      window.location.href = "/login";
      return;
    }

    try {
      const response = await fetch("/api/labs/requests/vote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ requestId }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(result.error ?? "Unable to update Labs vote.");
        return;
      }

      setRequests((current) =>
        current.map((request) =>
          request.id === requestId
            ? {
                ...request,
                vote_count: result.voteCount ?? request.vote_count,
                voted_by_me: Boolean(result.voted),
              }
            : request
        )
      );
    } catch {
      setMessage("Unable to update Labs vote.");
    }
  }

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!currentUserId || submitting) {
      return;
    }

    if (!canUseLabs) {
      setMessage("Loombus Labs requires Premium Plus access.");
      return;
    }

    const cleanTitle = title.trim();
    const cleanDescription = description.trim();

    if (cleanTitle.length < 3) {
      setMessage("Feature request title must be at least 3 characters.");
      return;
    }

    if (cleanDescription.length < 10) {
      setMessage("Feature request description must be at least 10 characters.");
      return;
    }

    setSubmitting(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      setSubmitting(false);
      window.location.href = "/login";
      return;
    }

    let result: { request?: LabsFeatureRequest; error?: string } = {};

    try {
      const response = await fetch("/api/labs/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          title: cleanTitle,
          description: cleanDescription,
        }),
      });

      result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setSubmitting(false);
        setMessage(result.error ?? "Unable to submit feature request.");
        return;
      }
    } catch {
      setSubmitting(false);
      setMessage("Unable to submit feature request.");
      return;
    }

    setSubmitting(false);

    if (!result.request) {
      setMessage("Labs request submitted, but the response was incomplete. Refresh to confirm.");
      return;
    }

    setRequests((current) => [
      {
        ...(result.request as Omit<LabsFeatureRequest, "vote_count" | "voted_by_me">),
        vote_count: 0,
        voted_by_me: false,
      },
      ...current,
    ]);
    setTitle("");
    setDescription("");
    setMessage("Feature request submitted to Loombus Labs.");
  }

  if (!authChecked || loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-6xl text-zinc-500">
          Loading Loombus Labs...
        </div>
      </main>
    );
  }

  if (!currentUserId) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/"
            className="mb-10 inline-block text-sm text-zinc-500 hover:text-white"
          >
            ← Back home
          </Link>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
            <p className="mb-3 text-sm uppercase tracking-[0.3em] text-zinc-500">
              Loombus Labs
            </p>

            <h1 className="mb-4 text-4xl font-semibold tracking-tight">
              Log in to access Labs.
            </h1>

            <p className="mb-6 leading-relaxed text-zinc-400">
              Loombus Labs is the early-access area for Premium Plus members.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/login"
                className="rounded-full bg-white px-6 py-3 text-sm text-black transition hover:bg-zinc-200"
              >
                Log In
              </Link>

              <Link
                href="/premium"
                className="rounded-full border border-zinc-700 px-6 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                View Premium
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/dashboard"
          className="mb-10 inline-block text-sm text-zinc-500 hover:text-white"
        >
          ← Back to dashboard
        </Link>

        <div className="mb-10 rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
          <p className="mb-4 text-sm uppercase tracking-[0.3em] text-zinc-500">
            Loombus Labs
          </p>

          <h1 className="mb-5 text-5xl font-semibold tracking-tight md:text-6xl">
            Priority feature access.
          </h1>

          <p className="max-w-3xl leading-relaxed text-zinc-400">
            Labs is where Premium Plus members get early access to upcoming Loombus capabilities, submit feature requests, vote on requests, and track request status as ideas move through review.
          </p>

          {isAdmin && (
            <Link
              href="/admin/labs"
              className="mt-6 inline-flex rounded-full border border-sky-800 px-5 py-3 text-sm text-sky-300 transition hover:border-sky-600 hover:text-sky-200"
            >
              Open Admin Labs
            </Link>
          )}
        </div>

        {!canUseLabs && (
          <section className="mb-10 rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
            <h2 className="mb-3 text-3xl font-medium">
              Loombus Labs requires Premium Plus.
            </h2>

            <p className="mb-6 max-w-3xl leading-relaxed text-zinc-500">
              Free and Premium members can keep using the core platform. Labs is
              reserved for Premium Plus members so early feedback stays focused and manageable.
            </p>

            <Link
              href="/premium"
              className="inline-flex rounded-full bg-white px-6 py-3 text-sm text-black transition hover:bg-zinc-200"
            >
              View Premium Plus
            </Link>
          </section>
        )}

        {canUseLabs && (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
            <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
              <h2 className="mb-3 text-3xl font-medium">
                Submit a Labs request
              </h2>

              <p className="mb-6 leading-relaxed text-zinc-500">
                Tell us what would make Loombus more useful, more focused, or
                more valuable for high-signal discussion.
              </p>

              <form onSubmit={submitRequest} className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm text-zinc-400">
                    Feature title
                  </label>

                  <input
                    type="text"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={120}
                    placeholder="Example: Saved discussion tags"
                    className="w-full rounded-2xl border border-zinc-800 bg-black px-5 py-3 text-white outline-none transition placeholder:text-zinc-700 focus:border-zinc-600"
                  />

                  <p className="mt-2 text-xs text-zinc-600">
                    {title.length}/120 characters
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm text-zinc-400">
                    Why should this exist?
                  </label>

                  <textarea
                    rows={8}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    maxLength={2000}
                    placeholder="Describe the problem, who it helps, and how it should work..."
                    className="w-full rounded-2xl border border-zinc-800 bg-black px-5 py-3 text-white outline-none transition placeholder:text-zinc-700 focus:border-zinc-600"
                  />

                  <p className="mt-2 text-xs text-zinc-600">
                    {description.length}/2000 characters
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-full bg-white px-6 py-3 text-sm text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
                >
                  {submitting ? "Submitting..." : "Submit request"}
                </button>
              </form>

              {message && (
                <p className="mt-5 rounded-3xl border border-zinc-800 bg-black p-5 text-sm text-zinc-400">
                  {message}
                </p>
              )}
            </section>

            <aside className="space-y-5">
              <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
                <h2 className="mb-4 text-2xl font-medium">
                  Labs benefits
                </h2>

                <div className="space-y-4 text-sm leading-relaxed text-zinc-500">
                  <p>Early visibility into what Loombus is building next.</p>
                  <p>Priority feature request submission and voting.</p>
                  <p>Status tracking as ideas move through review.</p>
                </div>
              </section>

              <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
                <h2 className="mb-4 text-2xl font-medium">
                  Your request status
                </h2>

                <div className="grid gap-3">
                  {(
                    ["submitted", "reviewing", "planned", "shipped", "declined"] as LabsFeatureRequestStatus[]
                  ).map((status) => (
                    <div
                      key={status}
                      className="flex items-center justify-between rounded-2xl border border-zinc-900 bg-black px-4 py-3 text-sm"
                    >
                      <span className="text-zinc-500">
                        {STATUS_LABELS[status]}
                      </span>

                      <span className="text-zinc-300">
                        {statusCounts[status] ?? 0}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        )}

        {canUseLabs && (
          <section className="mt-10 rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
            <h2 className="mb-6 text-3xl font-medium">
              Your Labs requests
            </h2>

            {requests.length === 0 ? (
              <p className="text-zinc-500">
                No Labs requests submitted yet.
              </p>
            ) : (
              <div className="space-y-5">
                {requests.map((request) => (
                  <article
                    key={request.id}
                    className="rounded-3xl border border-zinc-800 bg-black p-6"
                  >
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-xl font-medium">
                          {request.title}
                        </h3>

                        <p className="mt-2 text-sm text-zinc-600">
                          Submitted {new Date(request.created_at).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => toggleVote(request.id)}
                        className={
                          request.voted_by_me
                            ? "rounded-full border border-white bg-white px-4 py-2 text-xs font-medium text-black"
                            : "rounded-full border border-zinc-800 px-4 py-2 text-xs font-medium text-zinc-400 transition hover:border-zinc-600 hover:text-white"
                        }
                      >
                        {request.voted_by_me ? "Voted" : "Vote for this request"} · {request.vote_count}
                      </button>

                      <span
                        className={`w-fit rounded-full border px-4 py-2 text-xs font-medium ${STATUS_CLASSES[request.status]}`}
                      >
                        {STATUS_LABELS[request.status]}
                      </span>
                    </div>
                    </div>

                    <p className="whitespace-pre-wrap leading-relaxed text-zinc-400">
                      {request.description}
                    </p>

                    {request.admin_note && (
                      <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                        <p className="mb-2 text-sm font-medium text-zinc-300">
                          Loombus note
                        </p>

                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-500">
                          {request.admin_note}
                        </p>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
