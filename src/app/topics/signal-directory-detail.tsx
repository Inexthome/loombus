"use client";

import { normalizePublicText } from "@/lib/public-text";
import {
  Bookmark,
  ChevronRight,
  Eye,
  MessageCircle,
  Sparkles,
  X,
} from "lucide-react";
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
    <section className="overflow-hidden rounded-[2rem] border border-[#CBAB5B]/60 bg-[color:var(--loombus-surface)] shadow-sm">
      <div className="flex flex-col gap-4 border-b border-[color:var(--loombus-border-muted)] p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#A9822F]">
            {getDimensionSingular(dimension)}
          </p>
          <h2 className="mt-2 text-2xl font-black">{item.value}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">
            {item.description}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="self-start rounded-full border border-[color:var(--loombus-border)] p-2 transition hover:bg-[color:var(--loombus-surface-muted)]"
          aria-label="Close selected directory item"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>

      <div className="grid border-b border-[color:var(--loombus-border-muted)] sm:grid-cols-4">
        <span className="p-4 text-sm font-semibold">
          {item.discussionCount} discussions
        </span>
        <span className="p-4 text-sm font-semibold">{item.replyCount} replies</span>
        <span className="p-4 text-sm font-semibold">{item.viewCount} views</span>
        <span className="p-4 text-sm font-semibold">{item.saveCount} saves</span>
      </div>

      {discussions.length === 0 ? (
        <div className="p-8 text-center">
          <Sparkles aria-hidden="true" className="mx-auto h-6 w-6 text-[#A9822F]" />
          <h3 className="mt-3 text-lg font-black">
            No discussions use this classification yet.
          </h3>
          <p className="mt-2 text-sm text-[color:var(--loombus-text-muted)]">
            It remains visible so the framing option does not disappear while quiet.
          </p>
          <Link
            href="/create"
            className="mt-4 inline-flex rounded-full bg-[#CBAB5B] px-4 py-2.5 text-sm font-black text-black"
          >
            Start a discussion
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-[color:var(--loombus-border-muted)]">
          {discussions.map((discussion) => (
            <article key={discussion.id} className="p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-[color:var(--loombus-text-muted)]">
                <span>{getProfileName(profiles[discussion.user_id])}</span>
                <span>·</span>
                <span>{formatDate(discussion.created_at)}</span>
              </div>
              <Link
                href={`/discussions/${discussion.id}`}
                className="group mt-2 block"
              >
                <h3 className="text-lg font-black transition group-hover:text-[#A9822F]">
                  {normalizePublicText(discussion.title)}
                </h3>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                  {normalizePublicText(discussion.body ?? "")}
                </p>
              </Link>
              <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-bold text-[color:var(--loombus-text-muted)]">
                <span className="flex items-center gap-1.5">
                  <MessageCircle aria-hidden="true" className="h-4 w-4" />
                  {replyCounts[discussion.id] ?? 0}
                </span>
                <span className="flex items-center gap-1.5">
                  <Eye aria-hidden="true" className="h-4 w-4" />
                  {viewCounts[discussion.id] ?? 0}
                </span>
                <span className="flex items-center gap-1.5">
                  <Bookmark aria-hidden="true" className="h-4 w-4" />
                  {saveCounts[discussion.id] ?? 0}
                </span>
                <Link
                  href={`/discussions/${discussion.id}`}
                  className="ml-auto flex items-center gap-1 text-[#8B6B24]"
                >
                  Open discussion
                  <ChevronRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
