"use client";

import { normalizePublicText } from "@/lib/public-text";
import { Bell, BellOff, Bookmark, ChevronRight, Clock3, Eye, MessageCircle } from "lucide-react";
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
    <article className="py-6 sm:py-7">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.42fr)] lg:gap-8">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-[color:var(--loombus-text-muted)]">
            <span className="font-semibold uppercase tracking-[0.16em] text-[color:var(--loombus-gold)]">
              {getDimensionSingular(dimension)}
            </span>
            <span aria-hidden="true">·</span>
            <span>{item.active ? "Active in the last 30 days" : "Quiet"}</span>
            {item.newThisWeek > 0 ? (
              <>
                <span aria-hidden="true">·</span>
                <span>{item.newThisWeek} new this week</span>
              </>
            ) : null}
          </div>

          <div className="mt-2 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{item.value}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                {item.description}
              </p>
            </div>

            {dimension === "topic" ? (
              <button
                type="button"
                onClick={() => onFollow(item.value)}
                disabled={saving}
                className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center border border-[color:var(--loombus-border)] text-[color:var(--loombus-text-muted)] transition hover:border-[color:var(--loombus-gold)] hover:text-[color:var(--loombus-gold)] disabled:opacity-50 motion-reduce:transition-none"
                aria-label={isFollowing ? `Unfollow ${item.value}` : `Follow ${item.value}`}
                title="Following a topic turns on new-discussion alerts"
              >
                {isFollowing ? <BellOff aria-hidden="true" className="h-4 w-4" /> : <Bell aria-hidden="true" className="h-4 w-4" />}
              </button>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[color:var(--loombus-text-muted)]">
            <span>{item.discussionCount} discussions</span>
            <span className="flex items-center gap-1.5"><MessageCircle aria-hidden="true" className="h-3.5 w-3.5" />{item.replyCount} replies</span>
            <span className="flex items-center gap-1.5"><Eye aria-hidden="true" className="h-3.5 w-3.5" />{item.viewCount} views</span>
            <span className="flex items-center gap-1.5"><Bookmark aria-hidden="true" className="h-3.5 w-3.5" />{item.saveCount} saves</span>
            <span className="font-semibold text-[color:var(--loombus-text)]">Activity {item.activityScore.toLocaleString()}</span>
          </div>

          <button
            type="button"
            onClick={() => onOpen(item.value)}
            className="mt-5 inline-flex min-h-11 items-center gap-2 border-b border-[color:var(--loombus-gold)] text-sm font-semibold transition hover:text-[color:var(--loombus-gold)] motion-reduce:transition-none"
          >
            View discussions
            <ChevronRight aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        <aside className="border-t border-[color:var(--loombus-border)] pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--loombus-text-muted)]">
            Latest discussion
          </p>
          {item.latestDiscussion ? (
            <>
              <Link
                href={`/discussions/${item.latestDiscussion.id}`}
                className="mt-2 line-clamp-3 block text-sm font-semibold leading-6 transition hover:text-[color:var(--loombus-gold)] motion-reduce:transition-none"
              >
                {normalizePublicText(item.latestDiscussion.title)}
              </Link>
              <span className="mt-2 flex items-center gap-1.5 text-xs text-[color:var(--loombus-text-muted)]">
                <Clock3 aria-hidden="true" className="h-3.5 w-3.5" />
                {formatRelativeTime(item.latestAt)}
              </span>
            </>
          ) : (
            <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
              No discussion activity yet. This classification remains available.
            </p>
          )}
        </aside>
      </div>
    </article>
  );
}
