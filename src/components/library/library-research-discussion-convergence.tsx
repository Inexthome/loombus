"use client";

import Link from "next/link";
import { ArrowUpRight, MessageSquareText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type ResearchItem = {
  publication_id: string;
  locator: string;
  start_offset: number;
  end_offset: number;
  text_sha256: string;
};

type PassageDiscussion = ResearchItem & {
  discussion_id: string;
};

type Discussion = { id: string; title: string };

function identity(row: ResearchItem) {
  return `${row.publication_id}:${row.locator}:${row.start_offset}:${row.end_offset}:${row.text_sha256}`;
}

export function LibraryResearchDiscussionConvergence() {
  const [links, setLinks] = useState<PassageDiscussion[]>([]);
  const [discussions, setDiscussions] = useState<Discussion[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user || cancelled) return;

      const [researchResult, passageResult] = await Promise.all([
        supabase.from("library_research_items").select("publication_id,locator,start_offset,end_offset,text_sha256"),
        supabase.from("library_passage_discussions").select("discussion_id,publication_id,locator,start_offset,end_offset,text_sha256"),
      ]);
      if (cancelled || researchResult.error || passageResult.error) return;

      const researchIdentities = new Set(((researchResult.data ?? []) as ResearchItem[]).map(identity));
      const matched = ((passageResult.data ?? []) as PassageDiscussion[]).filter((row) => researchIdentities.has(identity(row)));
      setLinks(matched);

      const ids = [...new Set(matched.map((row) => row.discussion_id))];
      if (!ids.length) {
        setDiscussions([]);
        return;
      }

      const discussionResult = await supabase.from("discussions").select("id,title").in("id", ids);
      if (!cancelled && !discussionResult.error) setDiscussions((discussionResult.data ?? []) as Discussion[]);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const discussionById = useMemo(() => new Map(discussions.map((row) => [row.id, row])), [discussions]);
  const visible = links.filter((row) => discussionById.has(row.discussion_id)).slice(0, 4);
  if (!visible.length) return null;

  return (
    <section className="mx-auto mt-4 max-w-6xl px-4 sm:px-6">
      <div className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--loombus-gold)]">Discussion ↔ Evidence</p>
            <h2 className="mt-1 text-sm font-black">Research passages already connected to discussions</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--loombus-text-muted)]">These discussions began from the same verified Library passage now saved in your private Research workspace.</p>
          </div>
          <span className="rounded-full bg-[var(--loombus-gold-surface)] px-2.5 py-1 text-[10px] font-black text-[var(--loombus-gold)]">{links.length} linked</span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {visible.map((link) => {
            const discussion = discussionById.get(link.discussion_id)!;
            return (
              <Link key={link.discussion_id} href={`/discussions/${link.discussion_id}`} className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-[var(--loombus-surface-strong)] px-3 py-2 ring-1 ring-[var(--loombus-border)] hover:ring-[var(--loombus-gold)]">
                <span className="min-w-0"><span className="flex items-center gap-2 text-xs font-black"><MessageSquareText className="size-3.5 text-[var(--loombus-gold)]" /><span className="truncate">{discussion.title}</span></span><span className="mt-1 block text-[10px] text-[var(--loombus-text-subtle)]">Same passage provenance · {link.start_offset}–{link.end_offset}</span></span>
                <ArrowUpRight className="size-4 shrink-0 text-[var(--loombus-gold)]" />
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
