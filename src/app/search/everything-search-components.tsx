"use client";

import Link from "next/link";
import {
  Bookmark,
  Bot,
  BriefcaseBusiness,
  CalendarDays,
  FileText,
  HandHeart,
  Image as ImageIcon,
  Layers3,
  Loader2,
  MapPin,
  MessageCircle,
  ShoppingBag,
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
  if (result.type === "job") return <BriefcaseBusiness {...props} />;
  if (result.type === "service" || result.type === "company") {
    return <BriefcaseBusiness {...props} />;
  }
  if (result.type === "request") return <HandHeart {...props} />;
  if (result.type === "marketplace" || result.type === "product") {
    return <ShoppingBag {...props} />;
  }
  if (result.type === "event") return <CalendarDays {...props} />;
  if (result.type === "image") return <ImageIcon {...props} />;
  if (result.type === "video") return <Video {...props} />;
  if (result.type === "saved") return <Bookmark {...props} />;
  if (["document", "file", "resource", "knowledge"].includes(result.type)) {
    return <FileText {...props} />;
  }
  if (result.type === "page") return <Layers3 {...props} />;
  return <MessageCircle {...props} />;
}

function visibilityLabel(result: EverythingSearchResult) {
  if (result.visibility === "member") return "Private Room";
  if (result.visibility === "private") return "Only you";
  if (result.visibility === "premium") return "Premium";
  if (result.visibility === "authenticated") return "Members";
  return "";
}

export function EverythingSearchResultCard({
  result,
}: {
  result: EverythingSearchResult;
}) {
  const date = formatSearchDate(result.createdAt);
  const accessLabel = visibilityLabel(result);

  return (
    <Link
      href={result.href}
      className="group grid min-h-24 gap-4 border-b border-[color:var(--loombus-border)] py-5 transition-colors hover:border-[color:var(--loombus-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--loombus-gold)] focus-visible:ring-offset-4 focus-visible:ring-offset-[color:var(--loombus-page-bg)] sm:grid-cols-[2.75rem_minmax(0,1fr)_auto] sm:items-start"
    >
      <span className="flex h-11 w-11 items-center justify-center border-l-2 border-[color:var(--loombus-gold)] text-[color:var(--loombus-gold)]">
        <ResultIcon result={result} />
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.68rem] font-semibold uppercase tracking-[0.15em] text-[color:var(--loombus-text-subtle)]">
          <span>{result.sourceLabel}</span>
          {accessLabel ? <span>· {accessLabel}</span> : null}
        </span>
        <strong className="mt-2 block text-lg leading-snug tracking-[-0.025em] decoration-[color:var(--loombus-gold)] underline-offset-4 group-hover:underline">
          {result.title}
        </strong>
        {result.snippet ? (
          <span className="mt-2 block line-clamp-3 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
            {result.snippet}
          </span>
        ) : null}
        <span className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[color:var(--loombus-text-subtle)]">
          {result.ownerName ? <span>{result.ownerName}</span> : null}
          {result.roomName ? <span>{result.roomName}</span> : null}
          {date ? <span>{date}</span> : null}
        </span>
      </span>
      <Sparkles className="mt-1 hidden text-[color:var(--loombus-gold)] sm:block" size={15} aria-hidden="true" />
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
    <section className="border-y border-[color:var(--loombus-border)] py-5">
      <p className="text-xs font-bold uppercase tracking-[0.24em] text-[color:var(--loombus-gold)]">
        Search brief
      </p>
      <p className="mt-2 max-w-4xl leading-7 text-[color:var(--loombus-text-muted)]">
        {loading ? "Organizing permitted Loombus sources…" : search.brief}
      </p>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[color:var(--loombus-text-subtle)]">
        <span className="font-semibold text-[color:var(--loombus-text)]">{search.intentLabel}</span>
        {search.locationQuery ? (
          <span className="flex items-center gap-1.5">
            <MapPin size={13} aria-hidden="true" /> {search.locationQuery}
          </span>
        ) : null}
        <span>{search.indexed ? "Unified index active" : "Compatibility search"}</span>
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
    <section className="border-b border-[color:var(--loombus-border)] py-6">
      <div className="grid gap-4 sm:grid-cols-[2.75rem_minmax(0,1fr)]">
        <span className="flex h-11 w-11 items-center justify-center border-l-2 border-[color:var(--loombus-gold)] text-[color:var(--loombus-gold)]">
          <Bot size={20} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-[-0.025em]">Ask Loombus AI</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">
            Organize the current permitted results into a grounded answer, then return to the original Loombus sources. Private Room and saved-item content stays outside AI context.
          </p>

          {answer ? (
            <div className="mt-5 border-l border-[color:var(--loombus-gold)] pl-4 text-sm leading-7 whitespace-pre-wrap">
              {answer}
            </div>
          ) : null}

          {sources.length > 0 ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {sources.map((source) => (
                <Link
                  key={`${source.href}:${source.title}`}
                  href={source.href}
                  className="min-h-11 border-b border-[color:var(--loombus-border)] py-2 text-xs font-semibold transition-colors hover:border-[color:var(--loombus-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--loombus-gold)]"
                >
                  Original result: {source.title}
                </Link>
              ))}
            </div>
          ) : null}

          {message ? <p className="mt-3 text-sm text-[color:var(--loombus-text-muted)]">{message}</p> : null}

          <div className="mt-5 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={onAsk}
              disabled={working || loading}
              className="inline-flex min-h-11 items-center gap-2 border-b-2 border-[color:var(--loombus-gold)] px-1 py-2 text-sm font-semibold text-[color:var(--loombus-text)] transition-colors hover:text-[color:var(--loombus-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--loombus-gold)] disabled:opacity-50"
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
              <Link href="/premium" className="min-h-11 py-2 text-sm font-semibold underline decoration-[color:var(--loombus-gold)] underline-offset-4">
                Review Premium
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
