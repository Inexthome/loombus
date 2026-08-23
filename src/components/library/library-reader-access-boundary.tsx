"use client";

import Link from "next/link";
import { BookOpen, Loader2 } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type AccessState = "checking" | "available" | "unavailable";

export function LibraryReaderAccessBoundary({
  publicationId,
  children,
}: {
  publicationId: string;
  children: ReactNode;
}) {
  const [accessState, setAccessState] = useState<AccessState>("checking");

  useEffect(() => {
    let cancelled = false;

    async function verifyPublishedPublication() {
      const { data, error } = await supabase
        .from("library_publications")
        .select("id")
        .eq("id", publicationId)
        .eq("status", "published")
        .maybeSingle();

      if (cancelled) return;
      setAccessState(!error && data ? "available" : "unavailable");
    }

    void verifyPublishedPublication();
    return () => {
      cancelled = true;
    };
  }, [publicationId]);

  if (accessState === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--loombus-page-bg)] text-[var(--loombus-text)]">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--loombus-gold)]" aria-label="Checking publication availability" />
      </main>
    );
  }

  if (accessState === "unavailable") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--loombus-page-bg)] px-4 text-[var(--loombus-text)]">
        <section className="w-full max-w-lg rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-8 text-center shadow-sm">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[var(--loombus-gold-surface)] text-[var(--loombus-gold)]">
            <BookOpen className="h-5 w-5" aria-hidden="true" />
          </span>
          <h1 className="mt-5 text-2xl font-semibold">This publication is no longer available.</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--loombus-text-muted)]">
            It may have been unpublished or retired by its author. Your private reading history remains preserved internally.
          </p>
          <Link
            href="/library"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--loombus-gold)] px-5 text-sm font-semibold text-black transition hover:opacity-90"
          >
            Back to Library
          </Link>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}
