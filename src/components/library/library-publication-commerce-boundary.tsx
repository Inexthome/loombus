"use client";

import Link from "next/link";
import { ArrowLeft, BookOpen, LibraryBig, Loader2, LockKeyhole } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { LibraryCoverImage } from "@/components/library/library-cover-image";
import { LibraryPurchaseButton } from "@/components/library/library-purchase-button";
import { supabase } from "@/lib/supabase/client";

type PublicationOffer = {
  id: string;
  title: string;
  subtitle: string | null;
  author_name: string | null;
  cover_url: string | null;
  status: "published" | "draft" | "archived";
  is_free: boolean;
  price_cents: number | null;
  currency: string | null;
};

type GateState = "checking" | "available" | "purchase_required" | "unavailable";

export function LibraryPublicationCommerceBoundary({
  publicationId,
  children,
}: {
  publicationId: string;
  children: ReactNode;
}) {
  const [state, setState] = useState<GateState>("checking");
  const [publication, setPublication] = useState<PublicationOffer | null>(null);
  const [checkoutSessionId, setCheckoutSessionId] = useState<string | null>(null);

  const verifyAccess = useCallback(async () => {
    const { data: publicationRow, error: publicationError } = await supabase
      .from("library_publications")
      .select("id,title,subtitle,author_name,cover_url,status,is_free,price_cents,currency")
      .eq("id", publicationId)
      .maybeSingle();

    if (publicationError || !publicationRow || publicationRow.status !== "published") {
      setPublication(null);
      setState("unavailable");
      return;
    }

    const offer = publicationRow as PublicationOffer;
    setPublication(offer);
    if (offer.is_free) {
      setState("available");
      return;
    }

    const { data: userResult } = await supabase.auth.getUser();
    if (!userResult.user) {
      setState("purchase_required");
      return;
    }

    const { data: allowed, error: accessError } = await supabase.rpc(
      "library_current_user_can_access_publication",
      { p_publication_id: publicationId }
    );
    if (accessError) {
      setState("unavailable");
      return;
    }
    setState(allowed ? "available" : "purchase_required");
  }, [publicationId]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("checkout") === "success") {
        setCheckoutSessionId(params.get("session_id"));
      }
    }
    void verifyAccess();
  }, [verifyAccess]);

  const handlePurchased = useCallback(async () => {
    await verifyAccess();
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", `/library/publication/${encodeURIComponent(publicationId)}`);
    }
    setCheckoutSessionId(null);
  }, [publicationId, verifyAccess]);

  if (state === "checking") {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--loombus-page-bg)] text-[var(--loombus-text)]">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--loombus-gold)]" aria-label="Checking Library access" />
      </main>
    );
  }

  if (state === "unavailable" || !publication) {
    return (
      <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-8 text-[var(--loombus-text)] sm:px-6 md:pt-24">
        <div className="mx-auto max-w-xl rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-8 text-center shadow-sm">
          <LibraryBig className="mx-auto h-8 w-8 text-[var(--loombus-gold)]" />
          <h1 className="mt-4 text-2xl font-semibold">This publication is unavailable.</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--loombus-text-muted)]">Loombus could not verify access to this publication.</p>
          <Link href="/library" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--loombus-gold)] px-5 text-sm font-semibold text-black"><ArrowLeft className="h-4 w-4" />Back to Library</Link>
        </div>
      </main>
    );
  }

  if (state === "purchase_required") {
    const validPrice = Number.isInteger(publication.price_cents) && (publication.price_cents ?? 0) >= 100 && publication.currency === "USD";
    return (
      <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-6 text-[var(--loombus-text)] sm:px-6 md:pt-24 lg:px-8">
        <div className="mx-auto w-full max-w-5xl">
          <Link href="/library" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--loombus-border)] px-4 text-sm font-semibold text-[var(--loombus-text-muted)]"><ArrowLeft className="h-4 w-4" />Library</Link>
          <section className="mt-6 grid gap-8 rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 sm:p-8 lg:grid-cols-[190px_minmax(0,1fr)]">
            <div className="mx-auto w-full max-w-[190px] lg:mx-0">
              <div className="grid aspect-[2/3] overflow-hidden rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-gold-surface)] text-[var(--loombus-gold)]">
                <LibraryCoverImage storagePath={publication.cover_url} alt={`${publication.title} cover`} fallbackClassName="m-auto h-9 w-9" />
              </div>
            </div>
            <div className="min-w-0 self-center">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--loombus-gold-surface)] text-[var(--loombus-gold)]"><LockKeyhole className="h-5 w-5" /></span>
              <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-[var(--loombus-gold)]">Paid Library publication</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">{publication.title}</h1>
              {publication.subtitle ? <p className="mt-2 text-base leading-7 text-[var(--loombus-text-muted)]">{publication.subtitle}</p> : null}
              <p className="mt-3 text-sm font-semibold">{publication.author_name ?? "Loombus Library"}</p>
              <p className="mt-5 max-w-2xl text-sm leading-6 text-[var(--loombus-text-muted)]">Purchase once to unlock the full publication on your Loombus account. Access is granted only after Loombus verifies the completed Stripe payment.</p>
              <div className="mt-6">
                {validPrice ? (
                  <LibraryPurchaseButton
                    publicationId={publication.id}
                    priceCents={publication.price_cents!}
                    currency={publication.currency!}
                    checkoutSessionId={checkoutSessionId}
                    onPurchased={handlePurchased}
                  />
                ) : (
                  <p role="alert" className="text-sm text-[var(--loombus-text-muted)]">This publication is not currently available for checkout.</p>
                )}
              </div>
            </div>
          </section>
          <p className="mt-5 flex items-center gap-2 text-xs text-[var(--loombus-text-subtle)]"><BookOpen className="h-4 w-4 text-[var(--loombus-gold)]" />Full reading, passage tools, and Library AI unlock with the same entitlement.</p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
