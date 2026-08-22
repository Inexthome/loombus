"use client";

import Link from "next/link";
import { FlaskConical } from "lucide-react";
import { useParams } from "next/navigation";

export function DiscussionLibraryFeedbackLauncher() {
  const params = useParams<{ id: string }>();
  const discussionId = params?.id;

  if (!discussionId) return null;

  return (
    <Link
      href={`/library/research/from-discussion?discussionId=${encodeURIComponent(discussionId)}`}
      className="fixed bottom-24 right-4 z-40 inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-2.5 text-sm font-black text-[var(--loombus-gold)] shadow-lg md:bottom-6 md:right-6"
      aria-label="Build private Library knowledge from this discussion"
    >
      <FlaskConical className="size-4" />
      Build Knowledge
    </Link>
  );
}
