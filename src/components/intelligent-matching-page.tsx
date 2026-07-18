"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Bookmark,
  CheckCircle2,
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

function buttonClass(secondary = false) {
  return secondary
    ? "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 text-sm font-semibold transition hover:bg-[var(--loombus-surface-muted)] disabled:cursor-not-allowed disabled:opacity-50"
    : "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[var(--loombus-text)] px-4 text-sm font-semibold text-[var(--loombus-page-bg)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";
}

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
    <article className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]">
            {directionLabel(match.direction)}
          </p>
          <p className="mt-2 text-sm text-[var(--loombus-text-muted)]">
            Based on <span className="font-semibold">{match.source.title}</span>
          </p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-bold ${confidenceClass(match.confidenceLabel)}`}
        >
          {match.confidenceLabel} · {match.confidence}%
        </span>
      </div>

      <div className="mt-5">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--loombus-text-subtle)]">
          <span>{match.target.category}</span>
          <span aria-hidden="true">·</span>
          <span>{match.target.ownerLabel}</span>
          {match.actedOn ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--loombus-border)] px-2.5 py-1">
              <CheckCircle2 size={13} /> Contact started
            </span>
          ) : null}
        </div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">
          {match.target.title}
        </h2>
        <p className="mt-3 line-clamp-4 text-sm leading-6 text-[var(--loombus-text-muted)]">
          {match.target.summary}
        </p>
      </div>

      <div className="mt-5 grid gap-3 text-sm text-[var(--loombus-text-muted)] sm:grid-cols-2">
        <span className="flex items-start gap-2">
          {match.factors.remoteCompatible ? (
            <Wifi className="mt-0.5 shrink-0" size={16} />
          ) : (
            <MapPin className="mt-0.5 shrink-0" size={16} />
          )}
          {match.target.locationLabel}
          {match.factors.distanceMiles !== null
            ? ` · ${match.factors.distanceMiles.toFixed(1)} miles`
            : ""}
        </span>
        <span className="flex items-start gap-2">
          <Gauge className="mt-0.5 shrink-0" size={16} />
          {match.target.priceLabel}
        </span>
      </div>

      <div className="mt-5 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] p-4">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--loombus-text-subtle)]">
          Why it matches
        </p>
        <ul className="mt-3 grid gap-2 text-sm text-[var(--loombus-text-muted)] sm:grid-cols-2">
          {match.explanation.map((item) => (
            <li key={item} className="flex gap-2">
              <Sparkles className="mt-0.5 shrink-0" size={14} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Link
          href={match.target.href}
          className={buttonClass()}
          onClick={() => void onState(match, "view")}
        >
          Open match <ArrowUpRight size={16} />
        </Link>
        {match.dismissed ? (
          <button
            type="button"
            className={buttonClass(true)}
            disabled={cardBusy}
            onClick={() => void onState(match, "restore")}
          >
            <RotateCcw size={16} /> Restore
          </button>
        ) : (
          <>
            <button
              type="button"
              className={buttonClass(true)}
              disabled={cardBusy}
              onClick={() => void onState(match, match.saved ? "unsave" : "save")}
            >
              <Bookmark size={16} fill={match.saved ? "currentColor" : "none"} />
              {match.saved ? "Saved" : "Save"}
            </button>
            <button
              type="button"
              className={buttonClass(true)}
              disabled={cardBusy}
              onClick={() => void onState(match, "dismiss")}
            >
              <CircleOff size={16} /> Dismiss
            </button>
          </>
        )}
        <span className="ml-auto flex items-center gap-1 text-xs text-[var(--loombus-text-subtle)]">
          <button
            type="button"
            className="rounded-full p-2 transition hover:bg-[var(--loombus-surface-muted)]"
            aria-label="Mark this match helpful"
            disabled={cardBusy}
            onClick={() => void onFeedback(match, "helpful")}
          >
            <ThumbsUp size={16} />
          </button>
          <button
            type="button"
            className="rounded-full p-2 transition hover:bg-[var(--loombus-surface-muted)]"
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

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 py-8 text-[var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 shadow-sm sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="max-w-4xl">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--loombus-text-subtle)]">
                Private compatibility layer
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
                Intelligent Matching
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--loombus-text-muted)]">
                Find Services that fit your active Requests and Requests that fit
                your published Services. Matching is deterministic, private, and
                never ranked by payment, followers, or popularity. Loombus does not
                contact anyone automatically.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={buttonClass(true)}
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
              <Link href="/requests/manage" className={buttonClass(true)}>
                My Requests
              </Link>
              <Link href="/services/manage" className={buttonClass()}>
                My Services
              </Link>
            </div>
          </div>
        </header>

        {notice ? (
          <div className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 text-sm text-[var(--loombus-text-muted)]">
            {notice}
            {unauthorized ? (
              <Link href="/login" className="ml-2 font-semibold underline">
                Sign in
              </Link>
            ) : null}
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Active", data.counts.active],
            ["Saved", data.counts.saved],
            ["Dismissed", data.counts.dismissed],
            ["For Requests", data.counts.requestToService],
            ["For Services", data.counts.serviceToRequest],
          ].map(([label, value]) => (
            <div
              key={String(label)}
              className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4"
            >
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--loombus-text-subtle)]">
                {label}
              </p>
              <p className="mt-2 text-3xl font-semibold">{value}</p>
            </div>
          ))}
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-3">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["active", `Active ${data.counts.active}`],
                    ["saved", `Saved ${data.counts.saved}`],
                    ["dismissed", `Dismissed ${data.counts.dismissed}`],
                  ] as Array<[ViewMode, string]>
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setViewMode(value)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      viewMode === value
                        ? "bg-[var(--loombus-text)] text-[var(--loombus-page-bg)]"
                        : "hover:bg-[var(--loombus-surface-muted)]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <select
                value={direction}
                onChange={(event) => setDirection(event.target.value as DirectionFilter)}
                className="min-h-10 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 text-sm font-semibold"
                aria-label="Filter match direction"
              >
                <option value="all">Both directions</option>
                <option value="request_to_service">Services for my Requests</option>
                <option value="service_to_request">Requests for my Services</option>
              </select>
            </div>

            {data.matchingPaused ? (
              <div className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-8 text-center">
                <PauseCircle className="mx-auto" size={34} />
                <h2 className="mt-4 text-2xl font-semibold">Matching is paused</h2>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--loombus-text-muted)]">
                  Existing candidates remain private. Loombus will not generate new
                  candidates until matching is resumed in preferences.
                </p>
              </div>
            ) : loading ? (
              <div className="grid min-h-64 place-items-center rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)]">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--loombus-text-muted)]">
                  <Loader2 className="animate-spin" size={18} /> Evaluating current compatibility
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
              <div className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-8 text-center">
                <Compass className="mx-auto" size={34} />
                <h2 className="mt-4 text-2xl font-semibold">No matches in this view</h2>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--loombus-text-muted)]">
                  Publish a Service or keep a Request open with a clear category,
                  location, budget, timing, tags, and specialties. Loombus only shows
                  candidates that pass your relevance and eligibility controls.
                </p>
              </div>
            )}
          </section>

          <aside className="space-y-5">
            <section className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
              <div className="flex items-center gap-2">
                <Settings2 size={19} />
                <h2 className="text-lg font-semibold">Matching preferences</h2>
              </div>
              <div className="mt-5 space-y-5 text-sm">
                <label className="flex items-center justify-between gap-4">
                  <span>
                    <span className="block font-semibold">Pause matching</span>
                    <span className="text-xs text-[var(--loombus-text-subtle)]">
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
                    className="h-5 w-5"
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
                        className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] px-3 py-2"
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
                                : current.activeSections.filter(
                                    (item) => item !== value,
                                  ),
                            }))
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>

                <label className="block">
                  <span className="font-semibold">Local radius</span>
                  <div className="mt-2 flex items-center gap-3">
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
                      className="w-full"
                    />
                    <span className="w-20 text-right font-semibold">
                      {preferences.radiusMiles} mi
                    </span>
                  </div>
                </label>

                <label className="flex items-center justify-between gap-4">
                  <span className="inline-flex items-center gap-2 font-semibold">
                    <Wifi size={16} /> Include remote matches
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
                    className="h-5 w-5"
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
                    className="mt-2 min-h-11 w-full rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-3"
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
                    className="mt-2 min-h-11 w-full rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-3"
                  >
                    <option value="none">None</option>
                    <option value="daily">Daily digest preference</option>
                    <option value="weekly">Weekly digest preference</option>
                  </select>
                  <span className="mt-1 block text-xs text-[var(--loombus-text-subtle)]">
                    Stored for match digests when delivery is enabled.
                  </span>
                </label>

                <details>
                  <summary className="cursor-pointer font-semibold">Categories</summary>
                  <div className="mt-3 grid gap-2">
                    {PROVIDER_SERVICE_CATEGORIES.map((category) => (
                      <label key={category} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={preferences.categories.includes(category)}
                          onChange={() => toggleCategory(category)}
                        />
                        <span>{category}</span>
                      </label>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-[var(--loombus-text-subtle)]">
                    Leave every category unchecked to match all categories.
                  </p>
                </details>

                <button
                  type="button"
                  className={`${buttonClass()} w-full`}
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

            <section className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
              <h2 className="text-lg font-semibold">Saved matching rules</h2>
              <p className="mt-2 text-xs leading-5 text-[var(--loombus-text-subtle)]">
                Rules reuse your current radius, remote, and relevance settings for a
                specific direction or category.
              </p>
              <div className="mt-4 space-y-3">
                <input
                  value={ruleName}
                  onChange={(event) => setRuleName(event.target.value)}
                  placeholder="Rule name"
                  maxLength={80}
                  className="min-h-11 w-full rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-3 text-sm"
                />
                <select
                  value={ruleSource}
                  onChange={(event) =>
                    setRuleSource(event.target.value as "request" | "service")
                  }
                  className="min-h-11 w-full rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-3 text-sm"
                >
                  <option value="request">Find Services for my Requests</option>
                  <option value="service">Find Requests for my Services</option>
                </select>
                <select
                  value={ruleCategory}
                  onChange={(event) => setRuleCategory(event.target.value)}
                  className="min-h-11 w-full rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-3 text-sm"
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
                  className={`${buttonClass(true)} w-full`}
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
                      className="rounded-xl border border-[var(--loombus-border)] p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{rule.name}</p>
                          <p className="mt-1 text-xs leading-5 text-[var(--loombus-text-subtle)]">
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
                          className="rounded-full p-2 transition hover:bg-[var(--loombus-surface-muted)]"
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
                  <p className="text-sm text-[var(--loombus-text-subtle)]">
                    No saved rules yet.
                  </p>
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
