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
      className="group grid gap-4 rounded-[1.55rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-lg shadow-black/5 transition hover:-translate-y-0.5 hover:border-[color:var(--loombus-gold)] hover:shadow-xl sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-start"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--loombus-cream)] text-[color:var(--loombus-gold)] dark:bg-[color:var(--loombus-gold-soft)]">
        <ResultIcon result={result} />
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-[color:var(--loombus-border)] px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.15em] text-[color:var(--loombus-text-subtle)]">
            {result.sourceLabel}
          </span>
          {accessLabel ? (
            <span className="rounded-full bg-[color:var(--loombus-surface-muted)] px-2.5 py-1 text-[0.68rem] text-[color:var(--loombus-text-muted)]">
              {accessLabel}
            </span>
          ) : null}
        </span>
        <strong className="mt-2 block text-lg leading-snug tracking-[-0.025em] group-hover:underline">
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
      <span className="hidden h-9 w-9 items-center justify-center rounded-full border border-[color:var(--loombus-border)] text-[color:var(--loombus-gold)] transition group-hover:border-[color:var(--loombus-gold)] sm:flex">
        <Sparkles size={15} />
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
    <section className="rounded-[1.6rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-lg shadow-black/5">
      <p className="text-xs font-bold uppercase tracking-[0.24em] text-[color:var(--loombus-gold)]">
        Search brief
      </p>
      <p className="mt-2 leading-7 text-[color:var(--loombus-text-muted)]">
        {loading ? "Organizing permitted Loombus sources…" : search.brief}
      </p>
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-[color:var(--loombus-cream)] px-3 py-1.5 font-semibold text-[color:var(--loombus-cream-contrast)] dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-gold)]">
          {search.intentLabel}
        </span>
        {search.locationQuery ? (
          <span className="flex items-center gap-1.5 rounded-full bg-[color:var(--loombus-surface-muted)] px-3 py-1.5">
            <MapPin size={13} /> {search.locationQuery}
          </span>
        ) : null}
        <span className="rounded-full border border-[color:var(--loombus-border)] px-3 py-1.5 text-[color:var(--loombus-text-subtle)]">
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
    <section className="rounded-[1.7rem] border border-[color:var(--loombus-gold)] bg-[color:var(--loombus-cream)] p-5 text-[color:var(--loombus-cream-contrast)] shadow-xl shadow-black/10 dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-text)]">
      <div className="flex gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/65 text-[color:var(--loombus-gold)] dark:bg-black/10">
          <Bot size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold tracking-[-0.025em]">Ask Loombus AI</h2>
          <p className="mt-1 text-sm leading-6 opacity-80">
            Organize the current permitted results into a grounded answer, then return to the original Loombus sources. Private Room and saved-item content stays outside AI context.
          </p>

          {answer ? (
            <div className="mt-4 whitespace-pre-wrap rounded-2xl border border-black/5 bg-white/65 p-5 text-sm leading-7 dark:border-white/5 dark:bg-black/10">
              {answer}
            </div>
          ) : null}

          {sources.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {sources.map((source) => (
                <Link
                  key={`${source.href}:${source.title}`}
                  href={source.href}
                  className="rounded-full border border-black/10 bg-white/40 px-3 py-2 text-xs font-semibold transition hover:bg-white/70 dark:border-white/10 dark:bg-black/10 dark:hover:bg-black/20"
                >
                  Original result: {source.title}
                </Link>
              ))}
            </div>
          ) : null}

          {message ? <p className="mt-3 text-sm opacity-80">{message}</p> : null}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onAsk}
              disabled={working || loading}
              className="flex items-center gap-2 rounded-xl bg-[color:var(--loombus-gold)] px-4 py-2.5 text-sm font-semibold text-[color:var(--loombus-gold-contrast)] transition hover:opacity-90 disabled:opacity-50"
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
