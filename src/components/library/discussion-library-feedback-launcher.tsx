"use client";

import Link from "next/link";
import { FlaskConical, MessageCircle } from "lucide-react";
import { useParams } from "next/navigation";

export function DiscussionLibraryFeedbackLauncher() {
  const params = useParams<{ id: string }>();
  const discussionId = params?.id;

  if (!discussionId) return null;

  return (
    <div className="fixed bottom-24 right-4 z-40 flex flex-col items-end gap-2 md:bottom-6 md:right-6">
      <Link
        href={`/library/research/from-reply?discussionId=${encodeURIComponent(discussionId)}`}
        className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-2.5 text-sm font-black text-[var(--loombus-gold)] shadow-lg"
        aria-label="Build private Library knowledge from a reply in this discussion"
      >
        <MessageCircle className="size-4" />
        From Reply
      </Link>
      <Link
        href={`/library/research/from-discussion?discussionId=${encodeURIComponent(discussionId)}`}
        className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-2.5 text-sm font-black text-[var(--loombus-gold)] shadow-lg"
        aria-label="Build private Library knowledge from this discussion opening post"
      >
        <FlaskConical className="size-4" />
        Build Knowledge
      </Link>
    </div>
  );
}
