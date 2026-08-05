"use client";

import { normalizePublicText } from "@/lib/public-text";
import {
  Activity,
  Bell,
  BellOff,
  Bookmark,
  ChevronRight,
  Clock3,
  Eye,
  MessageCircle,
} from "lucide-react";
import Link from "next/link";
import {
  formatRelativeTime,
  getDimensionSingular,
  type DirectoryDimension,
  type DirectoryItem,
} from "./signal-directory-model";

type SignalDirectoryCardProps = {
  dimension: DirectoryDimension;
  item: DirectoryItem;
  isFollowing: boolean;
  saving: boolean;
  onFollow: (topic: string) => void;
  onOpen: (value: string) => void;
};

export default function SignalDirectoryCard({
  dimension,
  item,
  isFollowing,
  saving,
  onFollow,
  onOpen,
}: SignalDirectoryCardProps) {
  return (
    <article className="flex min-w-0 flex-col rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#CBAB5B]/70 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-black ${
              item.active
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "bg-[color:var(--loombus-surface-muted)] text-[color:var(--loombus-text-muted)]"
            }`}
          >
            {item.active ? "Active" : "Quiet"}
          </span>
          {item.newThisWeek > 0 ? (
            <span className="rounded-full bg-[#CBAB5B]/10 px-2.5 py-1 text-[11px] font-black text-[#8B6B24]">
              {item.newThisWeek} new this week
            </span>
          ) : null}
        </div>

        {dimension === "topic" ? (
          <button
            type="button"
            onClick={() => onFollow(item.value)}
            disabled={saving}
            className="rounded-full border border-[color:var(--loombus-border)] p-2 transition hover:bg-[color:var(--loombus-surface-muted)] disabled:opacity-50"
            aria-label={
              isFollowing ? `Unfollow ${item.value}` : `Follow ${item.value}`
            }
            title="Following a topic turns on new-discussion alerts"
          >
            {isFollowing ? (
              <BellOff aria-hidden="true" className="h-4 w-4" />
            ) : (
              <Bell aria-hidden="true" className="h-4 w-4" />
            )}
          </button>
        ) : null}
      </div>

      <div className="mt-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#A9822F]">
          {getDimensionSingular(dimension)}
        </p>
        <h2 className="mt-2 text-xl font-black">{item.value}</h2>
        <p className="mt-2 min-h-16 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
          {item.description}
        </p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 text-xs font-bold text-[color:var(--loombus-text-muted)]">
        <span className="flex items-center gap-2 rounded-xl bg-[color:var(--loombus-page-bg)] p-2.5">
          <Activity aria-hidden="true" className="h-4 w-4" />
          {item.discussionCount} discussions
        </span>
        <span className="flex items-center gap-2 rounded-xl bg-[color:var(--loombus-page-bg)] p-2.5">
          <MessageCircle aria-hidden="true" className="h-4 w-4" />
          {item.replyCount} replies
        </span>
        <span className="flex items-center gap-2 rounded-xl bg-[color:var(--loombus-page-bg)] p-2.5">
          <Eye aria-hidden="true" className="h-4 w-4" />
          {item.viewCount} views
        </span>
        <span className="flex items-center gap-2 rounded-xl bg-[color:var(--loombus-page-bg)] p-2.5">
          <Bookmark aria-hidden="true" className="h-4 w-4" />
          {item.saveCount} saves
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-2xl bg-[#CBAB5B]/10 px-4 py-3">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-[#8B6B24]">
          Activity
        </span>
        <strong className="text-lg text-[#8B6B24]">
          {item.activityScore.toLocaleString()}
        </strong>
      </div>

      <div className="mt-4 min-h-20 rounded-2xl border border-[color:var(--loombus-border-muted)] p-3">
        {item.latestDiscussion ? (
          <>
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[color:var(--loombus-text-muted)]">
              Latest discussion
            </p>
            <Link
              href={`/discussions/${item.latestDiscussion.id}`}
              className="mt-1 line-clamp-2 block text-sm font-black hover:text-[#A9822F]"
            >
              {normalizePublicText(item.latestDiscussion.title)}
            </Link>
            <span className="mt-1 flex items-center gap-1.5 text-xs text-[color:var(--loombus-text-muted)]">
              <Clock3 aria-hidden="true" className="h-3.5 w-3.5" />
              {formatRelativeTime(item.latestAt)}
            </span>
          </>
        ) : (
          <p className="text-sm leading-6 text-[color:var(--loombus-text-muted)]">
            No discussion activity yet. This classification remains available.
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => onOpen(item.value)}
        className="mt-5 flex items-center justify-between rounded-full border border-[color:var(--loombus-border)] px-4 py-2.5 text-sm font-black transition hover:border-[#CBAB5B] hover:bg-[#CBAB5B]/10"
      >
        View discussions
        <ChevronRight aria-hidden="true" className="h-4 w-4" />
      </button>
    </article>
  );
}
