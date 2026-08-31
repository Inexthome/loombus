"use client";

import { normalizePublicText } from "@/lib/public-text";
import { Bookmark, ChevronRight, Eye, MessageCircle, X } from "lucide-react";
import Link from "next/link";
import {
  formatDate,
  getDimensionSingular,
  getProfileName,
  type DirectoryDimension,
  type DirectoryItem,
  type Discussion,
  type Profile,
} from "./signal-directory-model";

type SignalDirectoryDetailProps = {
  dimension: DirectoryDimension;
  item: DirectoryItem;
  discussions: Discussion[];
  profiles: Record<string, Profile>;
  replyCounts: Record<string, number>;
  viewCounts: Record<string, number>;
  saveCounts: Record<string, number>;
  onClose: () => void;
};

export default function SignalDirectoryDetail({
  dimension,
  item,
  discussions,
  profiles,
  replyCounts,
  viewCounts,
  saveCounts,
  onClose,
}: SignalDirectoryDetailProps) {
  return (
    <section className="border-b border-[color:var(--loombus-border)]">
      <div className="flex flex-col gap-4 py-6 sm:flex-row sm:items-start sm:justify-between sm:py-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--loombus-gold)]">
            Selected {getDimensionSingular(dimension)}
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">{item.value}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">
            {item.description}
          </p>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[color:var(--loombus-text-muted)]">
            <span>{item.discussionCount} discussions</span>
            <span>{item.replyCount} replies</span>
            <span>{item.viewCount} views</span>
            <span>{item.saveCount} saves</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-11 min-w-11 self-start items-center justify-center border border-[color:var(--loombus-border)] text-[color:var(--loombus-text-muted)] transition hover:border-[color:var(--loombus-gold)] hover:text-[color:var(--loombus-gold)] motion-reduce:transition-none"
          aria-label="Close selected directory item"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>

      {discussions.length === 0 ? (
        <div className="border-t border-[color:var(--loombus-border)] py-8">
          <h3 className="text-lg font-semibold">No discussions use this classification yet.</h3>
          <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
            It remains visible so the framing option does not disappear while quiet.
          </p>
          <Link
            href="/create"
            className="mt-5 inline-flex min-h-11 items-center border border-[color:var(--loombus-gold)] bg-[color:var(--loombus-gold)] px-4 py-2.5 text-sm font-semibold text-[#17140B]"
          >
            Start a discussion
          </Link>
        </div>
      ) : (
        <div className="border-t border-[color:var(--loombus-border)]">
          <p className="py-4 text-xs font-medium uppercase tracking-[0.16em] text-[color:var(--loombus-text-muted)]">
            Discussions using this classification
          </p>
          <div className="divide-y divide-[color:var(--loombus-border)] border-t border-[color:var(--loombus-border)]">
            {discussions.map((discussion) => (
              <article key={discussion.id} className="py-5 sm:py-6">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[color:var(--loombus-text-muted)]">
                  <span>{getProfileName(profiles[discussion.user_id])}</span>
                  <span aria-hidden="true">·</span>
                  <span>{formatDate(discussion.created_at)}</span>
                </div>
                <Link href={`/discussions/${discussion.id}`} className="group mt-2 block">
                  <h3 className="text-lg font-semibold transition group-hover:text-[color:var(--loombus-gold)] motion-reduce:transition-none">
                    {normalizePublicText(discussion.title)}
                  </h3>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                    {normalizePublicText(discussion.body ?? "")}
                  </p>
                </Link>
                <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-[color:var(--loombus-text-muted)]">
                  <span className="flex items-center gap-1.5"><MessageCircle aria-hidden="true" className="h-4 w-4" />{replyCounts[discussion.id] ?? 0}</span>
                  <span className="flex items-center gap-1.5"><Eye aria-hidden="true" className="h-4 w-4" />{viewCounts[discussion.id] ?? 0}</span>
                  <span className="flex items-center gap-1.5"><Bookmark aria-hidden="true" className="h-4 w-4" />{saveCounts[discussion.id] ?? 0}</span>
                  <Link
                    href={`/discussions/${discussion.id}`}
                    className="ml-auto flex min-h-11 items-center gap-1 font-semibold text-[color:var(--loombus-gold)]"
                  >
                    Open discussion
                    <ChevronRight aria-hidden="true" className="h-4 w-4" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
