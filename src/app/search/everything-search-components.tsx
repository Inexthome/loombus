"use client";

import Link from "next/link";
import {
  Bot,
  CalendarDays,
  FileText,
  Image as ImageIcon,
  Layers3,
  Loader2,
  MapPin,
  MessageCircle,
  Sparkles,
  UserRound,
  UsersRound,
  Video,
} from "lucide-react";
import type {
  EverythingSearchResponse,
  EverythingSearchResult,
} from "@/lib/everything-search";
import {
  type AiSource,
  formatSearchDate,
} from "./everything-search-model";

function ResultIcon({ result }: { result: EverythingSearchResult }) {
  const props = { "aria-hidden": true, size: 18 } as const;

  if (result.type === "person") return <UserRound {...props} />;
  if (result.type === "room") return <UsersRound {...props} />;
  if (result.type === "event") return <CalendarDays {...props} />;
  if (result.type === "image") return <ImageIcon {...props} />;
  if (result.type === "video") return <Video {...props} />;
  if (["document", "file", "resource"].includes(result.type)) {
    return <FileText {...props} />;
  }
  if (result.type === "page") return <Layers3 {...props} />;
  return <MessageCircle {...props} />;
}

export function EverythingSearchResultCard({
  result,
}: {
  result: EverythingSearchResult;
}) {
  const date = formatSearchDate(result.createdAt);

  return (
    <Link
      href={result.href}
      className="grid gap-4 rounded-[1.4rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 transition hover:-translate-y-0.5 hover:border-[var(--loombus-text-subtle)] hover:shadow-lg sm:grid-cols-[auto_minmax(0,1fr)]"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)]">
        <ResultIcon result={result} />
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-[var(--loombus-border)] px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.15em] text-[var(--loombus-text-subtle)]">
            {result.sourceLabel}
          </span>
          {result.visibility !== "public" ? (
            <span className="rounded-full bg-[var(--loombus-surface-muted)] px-2.5 py-1 text-[0.68rem] text-[var(--loombus-text-muted)]">
              {result.visibility === "member"
                ? "Private Room"
                : result.visibility === "private"
                  ? "Only you"
                  : result.visibility === "premium"
                    ? "Premium"
                    : "Members"}
            </span>
          ) : null}
        </span>
        <strong className="mt-2 block text-lg leading-snug tracking-[-0.02em]">
          {result.title}
        </strong>
        {result.snippet ? (
          <span className="mt-2 block line-clamp-3 text-sm leading-6 text-[var(--loombus-text-muted)]">
            {result.snippet}
          </span>
        ) : null}
        <span className="mt-3 flex flex-wrap gap-x-3 text-xs text-[var(--loombus-text-subtle)]">
          {result.ownerName ? <span>{result.ownerName}</span> : null}
          {result.roomName ? <span>{result.roomName}</span> : null}
          {date ? <span>{date}</span> : null}
        </span>
      </span>
    </Link>
  );
}

export function EverythingSearchBrief({
  search,
  loading,
}: {
  search: EverythingSearchResponse;
  loading: boolean;
}) {
  return (
    <section className="mt-5 rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--loombus-text-subtle)]">
        Search brief
      </p>
      <p className="mt-2 leading-7 text-[var(--loombus-text-muted)]">
        {loading ? "Organizing Loombus sources…" : search.brief}
      </p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-[var(--loombus-surface-muted)] px-3 py-1.5 font-semibold">
          {search.intentLabel}
        </span>
        {search.locationQuery ? (
          <span className="flex items-center gap-1.5 rounded-full bg-[var(--loombus-surface-muted)] px-3 py-1.5">
            <MapPin size={13} /> {search.locationQuery}
          </span>
        ) : null}
        <span className="rounded-full border border-[var(--loombus-border)] px-3 py-1.5 text-[var(--loombus-text-subtle)]">
          {search.indexed ? "Unified index active" : "Compatibility search"}
        </span>
      </div>
    </section>
  );
}

export function EverythingSearchAi({
  working,
  loading,
  answer,
  message,
  upgradeRequired,
  sources,
  onAsk,
}: {
  working: boolean;
  loading: boolean;
  answer: string;
  message: string;
  upgradeRequired: boolean;
  sources: AiSource[];
  onAsk: () => void;
}) {
  return (
    <section className="mt-5 rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
      <div className="flex gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--loombus-surface-muted)]">
          <Bot size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold">Ask Loombus AI</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--loombus-text-muted)]">
            Generate a grounded answer and return to the original Loombus sources.
            Private Room and saved-item content stays outside AI context.
          </p>
          {answer ? (
            <div className="mt-4 whitespace-pre-wrap rounded-2xl bg-[var(--loombus-page-bg)] p-5 text-sm leading-7">
              {answer}
            </div>
          ) : null}
          {sources.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {sources.map((source) => (
                <Link
                  key={`${source.href}:${source.title}`}
                  href={source.href}
                  className="rounded-full border border-[var(--loombus-border)] px-3 py-2 text-xs text-[var(--loombus-text-muted)]"
                >
                  Original result: {source.title}
                </Link>
              ))}
            </div>
          ) : null}
          {message ? (
            <p className="mt-3 text-sm text-[var(--loombus-text-muted)]">
              {message}
            </p>
          ) : null}
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={onAsk}
              disabled={working || loading}
              className="flex items-center gap-2 rounded-xl border border-[var(--loombus-border)] px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {working || loading ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <Sparkles size={16} />
              )}
              {working
                ? "Organizing…"
                : loading
                  ? "Finding sources…"
                  : answer
                    ? "Regenerate grounded answer"
                    : "Ask Loombus AI"}
            </button>
            {upgradeRequired ? (
              <Link href="/premium" className="text-sm font-semibold underline">
                Review Premium
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
