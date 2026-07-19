"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Bookmark,
  CheckCircle2,
  ChevronRight,
  CircleOff,
  Compass,
  Gauge,
  Loader2,
  MapPin,
  PauseCircle,
  RefreshCw,
  RotateCcw,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Wifi,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_MATCHING_PREFERENCES,
  type IntelligentMatch,
  type IntelligentMatchingResponse,
  type MatchDirection,
  type MatchingPreferences,
} from "@/lib/intelligent-matching";
import { PROVIDER_SERVICE_CATEGORIES } from "@/lib/provider-services";
import { serviceRequestsAuthorizedFetch } from "@/lib/service-requests-client";

type ViewMode = "active" | "saved" | "dismissed";
type DirectionFilter = "all" | MatchDirection;

const EMPTY_RESPONSE: IntelligentMatchingResponse = {
  matches: [],
  dismissedMatches: [],
  preferences: DEFAULT_MATCHING_PREFERENCES,
  rules: [],
  counts: {
    active: 0,
    saved: 0,
    dismissed: 0,
    requestToService: 0,
    serviceToRequest: 0,
  },
  generatedAt: new Date(0).toISOString(),
  matchingPaused: false,
  activeSections: ["requests", "services"],
};

const secondaryButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-4 text-sm font-semibold text-[color:var(--loombus-text)] transition hover:border-[#b45309] hover:bg-[color:var(--loombus-surface-muted)] disabled:cursor-not-allowed disabled:opacity-50";

const primaryButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#b45309] px-4 text-sm font-semibold text-white transition hover:bg-[#92400e] disabled:cursor-not-allowed disabled:opacity-50";

const controlClass =
  "min-h-11 w-full rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] px-3 text-sm text-[color:var(--loombus-text)] outline-none transition focus:border-[#b45309] focus:ring-4 focus:ring-orange-500/10";

function confidenceClass(label: IntelligentMatch["confidenceLabel"]) {
  if (label === "Strong") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  if (label === "Good") {
    return "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300";
  }
  return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
}

function directionLabel(direction: MatchDirection) {
  return direction === "request_to_service"
    ? "Service for your Request"
    : "Request for your Service";
}

function MatchCard({
  match,
  busy,
  onState,
  onFeedback,
}: {
  match: IntelligentMatch;
  busy: string;
  onState: (match: IntelligentMatch, candidateAction: string) => Promise<void>;
  onFeedback: (
    match: IntelligentMatch,
    feedbackType: "helpful" | "not_relevant",
  ) => Promise<void>;
}) {
  const cardBusy = busy === match.id;

  return (
    <article className="overflow-hidden rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] shadow-xl shadow-black/10">
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#b45309]">
              {directionLabel(match.direction)}
            </p>
            <p className="mt-2 text-sm text-[color:var(--loombus-text-muted)]">
              Based on <span className="font-semibold text-[color:var(--loombus-text)]">{match.source.title}</span>
            </p>
          </div>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-bold ${confidenceClass(match.confidenceLabel)}`}
          >
            {match.confidenceLabel} · {match.confidence}%
          </span>
        </div>

        <div className="mt-5">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[color:var(--loombus-text-subtle)]">
            <span>{match.target.category}</span>
            <span aria-hidden="true">·</span>
            <span>{match.target.ownerLabel}</span>
            {match.actedOn ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--loombus-border)] px-2.5 py-1 text-[color:var(--loombus-text-muted)]">
                <CheckCircle2 size={13} /> Contact started
              </span>
            ) : null}
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-[color:var(--loombus-text)]">
            {match.target.title}
          </h2>
          <p className="mt-3 line-clamp-4 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
            {match.target.summary}
          </p>
        </div>

        <div className="mt-5 grid gap-3 text-sm text-[color:var(--loombus-text-muted)] sm:grid-cols-2">
          <span className="flex items-start gap-2 rounded-2xl bg-[color:var(--loombus-page-bg)] p-3">
            {match.factors.remoteCompatible ? (
              <Wifi className="mt-0.5 shrink-0 text-[#b45309]" size={16} />
            ) : (
              <MapPin className="mt-0.5 shrink-0 text-[#b45309]" size={16} />
            )}
            <span>
              {match.target.locationLabel}
              {match.factors.distanceMiles !== null
                ? ` · ${match.factors.distanceMiles.toFixed(1)} miles`
                : ""}
            </span>
          </span>
          <span className="flex items-start gap-2 rounded-2xl bg-[color:var(--loombus-page-bg)] p-3">
            <Gauge className="mt-0.5 shrink-0 text-[#b45309]" size={16} />
            <span>{match.target.priceLabel}</span>
          </span>
        </div>

        <div className="mt-5 rounded-2xl border border-[color:var(--loombus-border-muted)] bg-[color:var(--loombus-page-bg)] p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-subtle)]">
            Why it matches
          </p>
          <ul className="mt-3 grid gap-2 text-sm text-[color:var(--loombus-text-muted)] sm:grid-cols-2">
            {match.explanation.map((item) => (
              <li key={item} className="flex gap-2">
                <Sparkles className="mt-0.5 shrink-0 text-[#b45309]" size={14} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-[color:var(--loombus-border-muted)] bg-[color:var(--loombus-page-bg)] px-5 py-4 sm:px-6">
        <Link
          href={match.target.href}
          className={primaryButtonClass}
          onClick={() => void onState(match, "view")}
        >
          Open match <ArrowUpRight size={16} />
        </Link>

        {match.dismissed ? (
          <button
            type="button"
            className={secondaryButtonClass}
            disabled={cardBusy}
            onClick={() => void onState(match, "restore")}
          >
            <RotateCcw size={16} /> Restore
          </button>
        ) : (
          <>
            <button
              type="button"
              className={secondaryButtonClass}
              disabled={cardBusy}
              onClick={() => void onState(match, match.saved ? "unsave" : "save")}
            >
              <Bookmark size={16} fill={match.saved ? "currentColor" : "none"} />
              {match.saved ? "Saved" : "Save"}
            </button>
            <button
              type="button"
              className={secondaryButtonClass}
              disabled={cardBusy}
              onClick={() => void onState(match, "dismiss")}
            >
              <CircleOff size={16} /> Dismiss
            </button>
          </>
        )}

        <span className="ml-auto flex items-center gap-1 text-xs text-[color:var(--loombus-text-subtle)]">
          <button
            type="button"
            className="rounded-full p-2 transition hover:bg-[color:var(--loombus-surface-muted)]"
            aria-label="Mark this match helpful"
            disabled={cardBusy}
            onClick={() => void onFeedback(match, "helpful")}
          >
            <ThumbsUp size={16} />
          </button>
          <button
            type="button"
            className="rounded-full p-2 transition hover:bg-[color:var(--loombus-surface-muted)]"
            aria-label="Mark this match not relevant"
            disabled={cardBusy}
            onClick={() => void onFeedback(match, "not_relevant")}
          >
            <ThumbsDown size={16} />
          </button>
        </span>
      </div>
    </article>
  );
}

export default function IntelligentMatchingPage() {
  const [data, setData] = useState<IntelligentMatchingResponse>(EMPTY_RESPONSE);
  const [preferences, setPreferences] = useState<MatchingPreferences>(
    DEFAULT_MATCHING_PREFERENCES,
  );
  const [viewMode, setViewMode] = useState<ViewMode>("active");
  const [direction, setDirection] = useState<DirectionFilter>("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [ruleName, setRuleName] = useState("");
  const [ruleSource, setRuleSource] = useState<"request" | "service">("request");
  const [ruleCategory, setRuleCategory] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setNotice("");
    setErrorCode("");
    try {
      const response = await serviceRequestsAuthorizedFetch(
        "/api/matches",
        { cache: "no-store" },
        "/matches",
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setErrorCode(String(payload.code ?? ""));
        throw new Error(payload.error ?? "Unable to load Intelligent Matching.");
      }
      const next = payload as IntelligentMatchingResponse;
      setData(next);
      setPreferences(next.preferences);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to load Intelligent Matching.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleMatches = useMemo(() => {
    const base =
      viewMode === "dismissed"
        ? data.dismissedMatches
        : viewMode === "saved"
          ? data.matches.filter((match) => match.saved)
          : data.matches;

    return direction === "all"
      ? base
      : base.filter((match) => match.direction === direction);
  }, [data.dismissedMatches, data.matches, direction, viewMode]);

  async function post(input: Record<string, unknown>) {
    const response = await serviceRequestsAuthorizedFetch(
      "/api/matches",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
      "/matches",
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error ?? "Unable to update Intelligent Matching.");
    }
    return payload;
  }

  async function refresh() {
    setBusy("refresh");
    setNotice("");
    try {
      const payload = (await post({ action: "refresh" })) as IntelligentMatchingResponse;
      setData(payload);
      setPreferences(payload.preferences);
      setNotice("Matches refreshed from current Requests and Services.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to refresh matches.");
    } finally {
      setBusy("");
    }
  }

  async function savePreferences() {
    setBusy("preferences");
    setNotice("");
    try {
      await post({
        action: "update_preferences",
        ...preferences,
      });
      setNotice("Matching preferences saved.");
      await load();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Unable to save preferences.",
      );
    } finally {
      setBusy("");
    }
  }

  async function setCandidateState(match: IntelligentMatch, candidateAction: string) {
    setBusy(match.id);
    setNotice("");
    try {
      await post({
        action: "candidate_state",
        candidateId: match.id,
        candidateAction,
      });
      if (candidateAction !== "view") await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to update match.");
    } finally {
      setBusy("");
    }
  }

  async function sendFeedback(
    match: IntelligentMatch,
    feedbackType: "helpful" | "not_relevant",
  ) {
    setBusy(match.id);
    setNotice("");
    try {
      await post({
        action: "feedback",
        candidateId: match.id,
        feedbackType,
      });
      setNotice(
        feedbackType === "helpful"
          ? "Helpful feedback saved."
          : "Relevance feedback saved.",
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to save feedback.");
    } finally {
      setBusy("");
    }
  }

  async function createRule() {
    if (!ruleName.trim()) {
      setNotice("Add a name for the matching rule.");
      return;
    }
    setBusy("rule");
    setNotice("");
    try {
      await post({
        action: "create_rule",
        name: ruleName,
        sourceType: ruleSource,
        categories: ruleCategory ? [ruleCategory] : [],
        radiusMiles: preferences.radiusMiles,
        includeRemote: preferences.includeRemote,
        minimumRelevance: preferences.minimumRelevance,
      });
      setRuleName("");
      setRuleCategory("");
      setNotice("Matching rule saved.");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to save rule.");
    } finally {
      setBusy("");
    }
  }

  async function deleteRule(ruleId: string) {
    setBusy(ruleId);
    setNotice("");
    try {
      await post({ action: "delete_rule", ruleId });
      setNotice("Matching rule deleted.");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to delete rule.");
    } finally {
      setBusy("");
    }
  }

  function toggleCategory(category: string) {
    setPreferences((current) => ({
      ...current,
      categories: current.categories.includes(category)
        ? current.categories.filter((item) => item !== category)
        : [...current.categories, category],
    }));
  }

  const unauthorized = errorCode === "account_access_denied" || notice === "Unauthorized.";

  const viewTabs: Array<{ value: ViewMode; label: string; count: number }> = [
    { value: "active", label: "Active", count: data.counts.active },
    { value: "saved", label: "Saved", count: data.counts.saved },
    { value: "dismissed", label: "Dismissed", count: data.counts.dismissed },
  ];

  return (
    <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[82rem]">
        <header className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-semibold tracking-[-0.055em] text-[color:var(--loombus-text)] sm:text-5xl">
              Intelligent Matching
            </h1>
            <p className="mt-3 text-base leading-7 text-[color:var(--loombus-text-muted)]">
              Review private compatibility suggestions between your active Requests and published Services. Matches are based on relevance, not payment, followers, or popularity.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={secondaryButtonClass}
              disabled={loading || Boolean(busy) || data.matchingPaused}
              onClick={() => void refresh()}
            >
              {busy === "refresh" ? (
                <Loader2 className="animate-spin" size={17} />
              ) : (
                <RefreshCw size={17} />
              )}
              Refresh matches
            </button>
            <Link href="/requests/manage" className={secondaryButtonClass}>
              My Requests
            </Link>
            <Link href="/services/manage" className={primaryButtonClass}>
              My Services
            </Link>
          </div>
        </header>

        <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <button
            type="button"
            onClick={() => {
              setViewMode("active");
              setDirection("all");
            }}
            className="rounded-[1.4rem] border border-orange-200 bg-orange-50 p-4 text-left shadow-sm transition hover:border-[#b45309] dark:border-orange-400/30 dark:bg-orange-400/10"
          >
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#b45309]">
              Active matches
            </span>
            <strong className="mt-2 block text-3xl tracking-[-0.04em]">{data.counts.active}</strong>
          </button>
          <button
            type="button"
            onClick={() => {
              setViewMode("saved");
              setDirection("all");
            }}
            className="rounded-[1.4rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 text-left shadow-sm transition hover:border-[#b45309]"
          >
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">
              Saved
            </span>
            <strong className="mt-2 block text-3xl tracking-[-0.04em]">{data.counts.saved}</strong>
          </button>
          <button
            type="button"
            onClick={() => {
              setViewMode("active");
              setDirection("request_to_service");
            }}
            className="rounded-[1.4rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 text-left shadow-sm transition hover:border-[#b45309]"
          >
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">
              For Requests
            </span>
            <strong className="mt-2 block text-3xl tracking-[-0.04em]">{data.counts.requestToService}</strong>
          </button>
          <button
            type="button"
            onClick={() => {
              setViewMode("active");
              setDirection("service_to_request");
            }}
            className="rounded-[1.4rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 text-left shadow-sm transition hover:border-[#b45309]"
          >
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">
              For Services
            </span>
            <strong className="mt-2 block text-3xl tracking-[-0.04em]">{data.counts.serviceToRequest}</strong>
          </button>
        </section>

        {notice ? (
          <div className="mb-6 rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-4 py-3 text-sm text-[color:var(--loombus-text-muted)] shadow-sm">
            {notice}
            {unauthorized ? (
              <Link href="/login" className="ml-2 font-semibold text-[#b45309] underline">
                Sign in
              </Link>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
          <section className="min-w-0 space-y-4">
            <div className="flex flex-col gap-3 rounded-[1.5rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-2 overflow-x-auto">
                {viewTabs.map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setViewMode(tab.value)}
                    className={`flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                      viewMode === tab.value
                        ? "bg-orange-50 text-[#b45309] dark:bg-orange-400/10"
                        : "text-[color:var(--loombus-text)] hover:bg-[color:var(--loombus-surface-muted)]"
                    }`}
                  >
                    {tab.label}
                    <span className="rounded-full bg-[color:var(--loombus-page-bg)] px-2 py-0.5 text-xs">
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              <select
                value={direction}
                onChange={(event) => setDirection(event.target.value as DirectionFilter)}
                className="min-h-11 rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] px-4 text-sm font-semibold text-[color:var(--loombus-text)] outline-none transition focus:border-[#b45309] focus:ring-4 focus:ring-orange-500/10"
                aria-label="Filter match direction"
              >
                <option value="all">Both directions</option>
                <option value="request_to_service">Services for my Requests</option>
                <option value="service_to_request">Requests for my Services</option>
              </select>
            </div>

            {data.matchingPaused ? (
              <div className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-8 text-center shadow-xl shadow-black/10">
                <PauseCircle className="mx-auto text-[#b45309]" size={34} />
                <h2 className="mt-4 text-2xl font-semibold tracking-[-0.035em]">Matching is paused</h2>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                  Existing candidates remain private. Loombus will not generate new candidates until matching is resumed in preferences.
                </p>
              </div>
            ) : loading ? (
              <div className="grid min-h-64 place-items-center rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] shadow-xl shadow-black/10">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--loombus-text-muted)]">
                  <Loader2 className="animate-spin text-[#b45309]" size={18} /> Evaluating current compatibility
                </span>
              </div>
            ) : visibleMatches.length ? (
              visibleMatches.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  busy={busy}
                  onState={setCandidateState}
                  onFeedback={sendFeedback}
                />
              ))
            ) : (
              <div className="rounded-[1.75rem] border border-dashed border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-8 text-center shadow-xl shadow-black/10">
                <Compass className="mx-auto text-[#b45309]" size={34} />
                <h2 className="mt-4 text-2xl font-semibold tracking-[-0.035em]">No matches in this view</h2>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                  Publish a Service or keep a Request open with a clear category, location, budget, timing, tags, and specialties. Loombus only shows candidates that pass your relevance and eligibility controls.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <Link href="/requests/manage" className={secondaryButtonClass}>
                    Manage Requests
                  </Link>
                  <Link href="/services/manage" className={primaryButtonClass}>
                    Manage Services
                  </Link>
                </div>
              </div>
            )}
          </section>

          <aside className="space-y-5 xl:sticky xl:top-28 xl:self-start">
            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Settings2 className="text-[#b45309]" size={19} />
                  <h2 className="text-lg font-semibold">Matching preferences</h2>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    preferences.matchingPaused
                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                      : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  }`}
                >
                  {preferences.matchingPaused ? "Paused" : "Active"}
                </span>
              </div>

              <div className="mt-5 space-y-5 text-sm">
                <label className="flex items-center justify-between gap-4 rounded-2xl bg-[color:var(--loombus-page-bg)] p-4">
                  <span>
                    <span className="block font-semibold">Pause matching</span>
                    <span className="mt-1 block text-xs leading-5 text-[color:var(--loombus-text-subtle)]">
                      Keep existing candidates without generating new ones.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={preferences.matchingPaused}
                    onChange={(event) =>
                      setPreferences((current) => ({
                        ...current,
                        matchingPaused: event.target.checked,
                      }))
                    }
                    className="h-5 w-5 accent-[#b45309]"
                  />
                </label>

                <div>
                  <p className="font-semibold">Active sections</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[
                      ["requests", "Requests"],
                      ["services", "Services"],
                    ].map(([value, label]) => (
                      <label
                        key={value}
                        className="inline-flex items-center gap-2 rounded-full border border-[color:var(--loombus-border)] px-3 py-2"
                      >
                        <input
                          type="checkbox"
                          checked={preferences.activeSections.includes(
                            value as "requests" | "services",
                          )}
                          onChange={(event) =>
                            setPreferences((current) => ({
                              ...current,
                              activeSections: event.target.checked
                                ? [
                                    ...new Set([
                                      ...current.activeSections,
                                      value as "requests" | "services",
                                    ]),
                                  ]
                                : current.activeSections.filter((item) => item !== value),
                            }))
                          }
                          className="accent-[#b45309]"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>

                <label className="block">
                  <span className="font-semibold">Local radius</span>
                  <div className="mt-2 flex items-center gap-3 rounded-2xl bg-[color:var(--loombus-page-bg)] p-3">
                    <input
                      type="range"
                      min={1}
                      max={250}
                      value={preferences.radiusMiles}
                      onChange={(event) =>
                        setPreferences((current) => ({
                          ...current,
                          radiusMiles: Number(event.target.value),
                        }))
                      }
                      className="w-full accent-[#b45309]"
                    />
                    <span className="w-20 text-right font-semibold text-[#b45309]">
                      {preferences.radiusMiles} mi
                    </span>
                  </div>
                </label>

                <label className="flex items-center justify-between gap-4 rounded-2xl bg-[color:var(--loombus-page-bg)] p-4">
                  <span className="inline-flex items-center gap-2 font-semibold">
                    <Wifi size={16} className="text-[#b45309]" /> Include remote matches
                  </span>
                  <input
                    type="checkbox"
                    checked={preferences.includeRemote}
                    onChange={(event) =>
                      setPreferences((current) => ({
                        ...current,
                        includeRemote: event.target.checked,
                      }))
                    }
                    className="h-5 w-5 accent-[#b45309]"
                  />
                </label>

                <label className="block">
                  <span className="font-semibold">Minimum relevance</span>
                  <select
                    value={preferences.minimumRelevance}
                    onChange={(event) =>
                      setPreferences((current) => ({
                        ...current,
                        minimumRelevance: Number(event.target.value),
                      }))
                    }
                    className={`mt-2 ${controlClass}`}
                  >
                    <option value={55}>Possible and above · 55%</option>
                    <option value={65}>Good and above · 65%</option>
                    <option value={80}>Strong only · 80%</option>
                  </select>
                </label>

                <label className="block">
                  <span className="font-semibold">Notification preference</span>
                  <select
                    value={preferences.notificationFrequency}
                    onChange={(event) =>
                      setPreferences((current) => ({
                        ...current,
                        notificationFrequency: event.target.value as MatchingPreferences["notificationFrequency"],
                      }))
                    }
                    className={`mt-2 ${controlClass}`}
                  >
                    <option value="none">None</option>
                    <option value="daily">Daily digest preference</option>
                    <option value="weekly">Weekly digest preference</option>
                  </select>
                  <span className="mt-1 block text-xs leading-5 text-[color:var(--loombus-text-subtle)]">
                    Stored for match digests when delivery is enabled.
                  </span>
                </label>

                <details className="rounded-2xl border border-[color:var(--loombus-border)] p-4">
                  <summary className="cursor-pointer font-semibold">Categories</summary>
                  <div className="mt-3 grid gap-2">
                    {PROVIDER_SERVICE_CATEGORIES.map((category) => (
                      <label key={category} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={preferences.categories.includes(category)}
                          onChange={() => toggleCategory(category)}
                          className="accent-[#b45309]"
                        />
                        <span>{category}</span>
                      </label>
                    ))}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[color:var(--loombus-text-subtle)]">
                    Leave every category unchecked to match all categories.
                  </p>
                </details>

                <button
                  type="button"
                  className={`${primaryButtonClass} w-full`}
                  disabled={busy === "preferences"}
                  onClick={() => void savePreferences()}
                >
                  {busy === "preferences" ? (
                    <Loader2 className="animate-spin" size={17} />
                  ) : (
                    <Save size={17} />
                  )}
                  Save preferences
                </button>
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <h2 className="text-lg font-semibold">Saved matching rules</h2>
              <p className="mt-2 text-xs leading-5 text-[color:var(--loombus-text-subtle)]">
                Rules reuse your current radius, remote, and relevance settings for a specific direction or category.
              </p>

              <div className="mt-4 space-y-3">
                <input
                  value={ruleName}
                  onChange={(event) => setRuleName(event.target.value)}
                  placeholder="Rule name"
                  maxLength={80}
                  className={controlClass}
                />
                <select
                  value={ruleSource}
                  onChange={(event) =>
                    setRuleSource(event.target.value as "request" | "service")
                  }
                  className={controlClass}
                >
                  <option value="request">Find Services for my Requests</option>
                  <option value="service">Find Requests for my Services</option>
                </select>
                <select
                  value={ruleCategory}
                  onChange={(event) => setRuleCategory(event.target.value)}
                  className={controlClass}
                >
                  <option value="">All categories</option>
                  {PROVIDER_SERVICE_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={`${secondaryButtonClass} w-full`}
                  disabled={busy === "rule"}
                  onClick={() => void createRule()}
                >
                  {busy === "rule" ? (
                    <Loader2 className="animate-spin" size={17} />
                  ) : (
                    <Save size={17} />
                  )}
                  Save rule
                </button>
              </div>

              <div className="mt-5 space-y-2">
                {data.rules.length ? (
                  data.rules.map((rule) => (
                    <div
                      key={rule.id}
                      className="rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{rule.name}</p>
                          <p className="mt-1 text-xs leading-5 text-[color:var(--loombus-text-subtle)]">
                            {rule.sourceType === "request"
                              ? "Requests to Services"
                              : "Services to Requests"}
                            {rule.categories.length
                              ? ` · ${rule.categories.join(", ")}`
                              : " · All categories"}
                          </p>
                        </div>
                        <button
                          type="button"
                          aria-label={`Delete ${rule.name}`}
                          className="rounded-full p-2 transition hover:bg-[color:var(--loombus-surface-muted)]"
                          disabled={busy === rule.id}
                          onClick={() => void deleteRule(rule.id)}
                        >
                          {busy === rule.id ? (
                            <Loader2 className="animate-spin" size={15} />
                          ) : (
                            <Trash2 size={15} />
                          )}
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl bg-[color:var(--loombus-page-bg)] p-4 text-sm text-[color:var(--loombus-text-subtle)]">
                    No saved rules yet.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <div className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-[#b45309] dark:bg-orange-400/10">
                  <ShieldCheck aria-hidden="true" className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-semibold">Private and member-controlled</h3>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                    Loombus does not automatically contact either party. You decide which matches to open, save, dismiss, or act on.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-text)]">
                Matching sources
              </p>
              <div className="mt-4 space-y-2">
                <Link
                  href="/requests/manage"
                  className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]"
                >
                  Manage Requests
                  <ChevronRight aria-hidden="true" className="h-4 w-4 text-[#b45309]" />
                </Link>
                <Link
                  href="/services/manage"
                  className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]"
                >
                  Manage Services
                  <ChevronRight aria-hidden="true" className="h-4 w-4 text-[#b45309]" />
                </Link>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
