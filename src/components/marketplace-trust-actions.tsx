"use client";

import Link from "next/link";
import { Bookmark, BookmarkCheck, Loader2, MessageCircle, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { MarketplaceListing } from "@/lib/marketplace";
import {
  getMarketplaceAccessToken,
  marketplaceAuthorizedFetch,
} from "@/lib/marketplace-auth-client";

export default function MarketplaceTrustActions({ slug }: { slug: string }) {
  const [listing, setListing] = useState<MarketplaceListing | null>(null);
  const [saved, setSaved] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [working, setWorking] = useState<"save" | "contact" | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      const response = await fetch(`/api/marketplace?slug=${encodeURIComponent(slug)}`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        listing?: MarketplaceListing;
      };
      if (!active || !response.ok || !payload.listing) return;
      setListing(payload.listing);

      const token = await getMarketplaceAccessToken().catch(() => "");
      if (!active || !token) return;

      const { data: userData } = await supabase.auth.getUser();
      if (active) {
        setIsOwner(userData.user?.id === payload.listing.sellerId);
      }

      const savedResponse = await marketplaceAuthorizedFetch(
        `/api/marketplace/watchlist?listingId=${encodeURIComponent(payload.listing.id)}`,
        { cache: "no-store" }
      ).catch(() => null);
      if (savedResponse?.ok) {
        const savedPayload = (await savedResponse.json().catch(() => ({}))) as {
          saved?: boolean;
        };
        if (active) setSaved(Boolean(savedPayload.saved));
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [slug]);

  async function requireSignIn() {
    const token = await getMarketplaceAccessToken().catch(() => "");
    if (token) return true;
    window.location.href = `/login?next=${encodeURIComponent(`/marketplace/${slug}`)}`;
    return false;
  }

  async function toggleSaved() {
    if (!listing || working || !(await requireSignIn())) return;
    setWorking("save");
    setMessage("");
    try {
      const response = await marketplaceAuthorizedFetch("/api/marketplace/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: saved ? "unsave" : "save",
          listingId: listing.id,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        saved?: boolean;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || "Saved items could not be updated.");
      setSaved(Boolean(payload.saved));
      setMessage(payload.saved ? "Listing saved." : "Listing removed from saved items.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Saved items could not be updated.");
    } finally {
      setWorking(null);
    }
  }

  async function contactSeller() {
    if (!listing || working || !(await requireSignIn())) return;
    setWorking("contact");
    setMessage("");
    try {
      const response = await marketplaceAuthorizedFetch("/api/marketplace/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: listing.id }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        conversationId?: string;
        error?: string;
      };
      if (!response.ok || !payload.conversationId) {
        throw new Error(payload.error || "Unable to contact the seller.");
      }
      window.location.href = `/messages?conversation=${encodeURIComponent(
        payload.conversationId
      )}`;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to contact the seller.");
      setWorking(null);
    }
  }

  if (!listing) return null;

  return (
    <aside className="fixed inset-x-3 bottom-24 z-40 mx-auto max-w-3xl rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-3 text-[var(--loombus-text)] shadow-2xl lg:bottom-5">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={toggleSaved}
          disabled={Boolean(working)}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--loombus-border)] px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          {working === "save" ? (
            <Loader2 size={17} className="animate-spin" />
          ) : saved ? (
            <BookmarkCheck size={17} />
          ) : (
            <Bookmark size={17} />
          )}
          {saved ? "Saved" : "Save listing"}
        </button>
        {!isOwner ? (
          <button
            type="button"
            onClick={contactSeller}
            disabled={Boolean(working)}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--loombus-text)] px-4 py-2.5 text-sm font-semibold text-[var(--loombus-page-bg)] disabled:opacity-50"
          >
            {working === "contact" ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              <MessageCircle size={17} />
            )}
            Message seller
          </button>
        ) : null}
        <Link
          href="/marketplace/safety"
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--loombus-border)] px-4 py-2.5 text-sm font-semibold"
        >
          <ShieldCheck size={17} /> Safety
        </Link>
      </div>
      {message ? (
        <p className="mt-2 text-center text-xs text-[var(--loombus-text-muted)]">{message}</p>
      ) : null}
    </aside>
  );
}
