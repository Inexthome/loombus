"use client";

import { floorComparatorLabel, formatFloorCallTarget } from "@/lib/floor-shared";
import { normalizePublicText } from "@/lib/public-text";
import { supabase } from "@/lib/supabase/client";
import { CheckCircle2, Loader2, ShieldAlert, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type ProposalAuthorEmbed = { username: string | null; full_name: string | null } | null;
type ProposalThesisEmbed = { id: string; thesis: string } | null;

type ProposalCallEmbed = {
  id: string;
  ticker: string;
  prediction: string;
  comparator: string;
  target_value: number | null;
  target_value_high: number | null;
  resolves_by: string;
  author: ProposalAuthorEmbed | ProposalAuthorEmbed[] | null;
  floor_theses: ProposalThesisEmbed | ProposalThesisEmbed[] | null;
} | null;

type Proposal = {
  id: string;
  call_id: string;
  proposed_outcome: "correct" | "incorrect";
  proposed_resolved_value: number;
  data_source: string;
  resolved_on: string;
  created_at: string;
  floor_calls: ProposalCallEmbed | ProposalCallEmbed[] | null;
};

const OUTCOME_OPTIONS = [
  { value: "correct", label: "Correct" },
  { value: "incorrect", label: "Incorrect" },
  { value: "partial", label: "Partial" },
] as const;

function single<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function authorName(author: ProposalAuthorEmbed) {
  return author?.full_name || author?.username || "A Loombus member";
}

export default function AdminFloorResolutionsClient() {
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  const [outcomeDrafts, setOutcomeDrafts] = useState<Record<string, string>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [workingId, setWorkingId] = useState<string | null>(null);

  const loadProposals = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      window.location.href = "/login?next=/admin/floor-resolutions";
      return;
    }

    const response = await fetch("/api/admin/floor-resolutions", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (response.status === 401) {
      window.location.href = "/login?next=/admin/floor-resolutions";
      return;
    }
    if (response.status === 403) {
      setAccessDenied(true);
      setLoading(false);
      return;
    }

    const result = (await response.json().catch(() => ({}))) as {
      proposals?: Proposal[];
      error?: string;
    };
    if (!response.ok) {
      setMessage(result.error ?? "Unable to load proposals.");
      setMessageIsError(true);
      setLoading(false);
      return;
    }

    const loaded = result.proposals ?? [];
    setProposals(loaded);
    setOutcomeDrafts((current) => {
      const next = { ...current };
      for (const proposal of loaded) {
        if (!(proposal.id in next)) next[proposal.id] = proposal.proposed_outcome;
      }
      return next;
    });
    setAccessDenied(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadProposals();
  }, [loadProposals]);

  async function review(proposalId: string, action: "approve" | "reject") {
    if (workingId) return;
    setWorkingId(proposalId);
    setMessage("");
    setMessageIsError(false);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sign in again before continuing.");

      const response = await fetch(`/api/admin/floor-resolutions/${proposalId}/review`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          outcome: outcomeDrafts[proposalId] ?? "correct",
          note: noteDrafts[proposalId] ?? "",
        }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to review the proposal.");

      setMessage(action === "approve" ? "Call resolved." : "Proposal rejected.");
      await loadProposals();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to review the proposal.");
      setMessageIsError(true);
    } finally {
      setWorkingId(null);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[color:var(--loombus-page-bg)] px-6 text-[color:var(--loombus-text)]">
        <Loader2 className="size-6 animate-spin" aria-hidden="true" />
      </main>
    );
  }

  if (accessDenied) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[color:var(--loombus-page-bg)] px-6 text-center text-[color:var(--loombus-text)]">
        <ShieldAlert className="size-8 text-[var(--loombus-text-subtle)]" aria-hidden="true" />
        <p className="text-sm font-bold text-[var(--loombus-text-muted)]">
          Admin access required to review Floor call resolutions.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-5">
        <header className="rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-xl shadow-black/10">
          <h1 className="text-2xl font-black sm:text-3xl">Floor call resolutions</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--loombus-text-muted)]">
            The resolver proposes an outcome from market data; nothing is stamped onto a
            member&apos;s public track record until you approve it here.
          </p>
        </header>

        {message ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm font-bold ${
              messageIsError
                ? "border-rose-500/30 bg-rose-500/10 text-rose-400"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
            }`}
          >
            {message}
          </div>
        ) : null}

        {proposals.length === 0 ? (
          <div className="rounded-[1.75rem] border border-dashed border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-10 text-center text-sm font-bold text-[var(--loombus-text-muted)]">
            No pending proposals.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {proposals.map((proposal) => {
              const call = single(proposal.floor_calls);
              if (!call) return null;
              const author = single(call.author);
              const thesis = single(call.floor_theses);
              const busy = workingId === proposal.id;

              return (
                <article
                  key={proposal.id}
                  className="rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-xl shadow-black/10"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[var(--loombus-gold-surface)] px-3 py-1 text-xs font-black text-[var(--loombus-gold)]">
                      {call.ticker}
                    </span>
                    <span className="text-xs font-bold text-[var(--loombus-text-subtle)]">
                      by {authorName(author)}
                    </span>
                    <span className="ml-auto text-xs font-bold text-[var(--loombus-text-subtle)]">
                      Proposed: {proposal.proposed_outcome} @ {proposal.proposed_resolved_value} (
                      {proposal.resolved_on}, {proposal.data_source})
                    </span>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-[var(--loombus-text)]">
                    {normalizePublicText(call.prediction)}
                  </p>
                  <p className="mt-1 text-xs font-bold text-[var(--loombus-text-muted)]">
                    Target: {formatFloorCallTarget(call.comparator, call.target_value, call.target_value_high)} (
                    {floorComparatorLabel(call.comparator)}), resolves{" "}
                    {new Date(call.resolves_by).toLocaleDateString()}
                  </p>
                  {thesis ? (
                    <p className="mt-2 whitespace-pre-line text-xs leading-5 text-[var(--loombus-text-subtle)]">
                      Thesis: {normalizePublicText(thesis.thesis)}
                    </p>
                  ) : null}

                  <div className="mt-4 grid gap-3 sm:grid-cols-[10rem_1fr]">
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-black text-[var(--loombus-text-muted)]">
                        Final outcome
                      </span>
                      <select
                        value={outcomeDrafts[proposal.id] ?? proposal.proposed_outcome}
                        onChange={(event) =>
                          setOutcomeDrafts((current) => ({
                            ...current,
                            [proposal.id]: event.target.value,
                          }))
                        }
                        className="min-h-11 w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-3 text-sm text-[var(--loombus-text)] outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100/20"
                      >
                        {OUTCOME_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-black text-[var(--loombus-text-muted)]">
                        Review note (optional, shown publicly if approved)
                      </span>
                      <input
                        value={noteDrafts[proposal.id] ?? ""}
                        onChange={(event) =>
                          setNoteDrafts((current) => ({ ...current, [proposal.id]: event.target.value }))
                        }
                        placeholder="Confirmed via Twelve Data close."
                        className="min-h-11 w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-3 text-sm text-[var(--loombus-text)] outline-none placeholder:text-[var(--loombus-text-subtle)] focus:border-amber-400 focus:ring-4 focus:ring-amber-100/20"
                      />
                    </label>
                  </div>

                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => review(proposal.id, "reject")}
                      disabled={busy}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[var(--loombus-border)] px-4 text-xs font-black text-[var(--loombus-text-muted)] hover:border-rose-300 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <XCircle className="size-3.5" aria-hidden="true" />
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => review(proposal.id, "approve")}
                      disabled={busy}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-[#cbab5b] px-4 text-xs font-black text-[#17120a] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy ? (
                        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <CheckCircle2 className="size-3.5" aria-hidden="true" />
                      )}
                      Approve
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
