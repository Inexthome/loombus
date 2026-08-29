"use client";

import Link from "next/link";
import { CheckCircle2, Loader2, MessageCircle, PackageCheck } from "lucide-react";
import { useEffect, useState } from "react";
import type { MarketplaceListing } from "@/lib/marketplace";
import { formatMarketplaceDate } from "@/lib/marketplace";
import {
  getMarketplaceAccessToken,
  marketplaceAuthorizedFetch,
} from "@/lib/marketplace-auth-client";
import { supabase } from "@/lib/supabase/client";

type WorkingAction = "message" | "availability" | null;

export default function MarketplaceSellerContactActions({
  listing,
}: {
  listing: MarketplaceListing;
}) {
  const [isOwner, setIsOwner] = useState(false);
  const [working, setWorking] = useState<WorkingAction>(null);
  const [notice, setNotice] = useState("");
  const [conversationId, setConversationId] = useState("");

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (active) setIsOwner(data.user?.id === listing.sellerId);
    });
    return () => {
      active = false;
    };
  }, [listing.sellerId]);

  async function requireSignIn() {
    const token = await getMarketplaceAccessToken().catch(() => "");
    if (token) return true;
    window.location.href = `/login?next=${encodeURIComponent(
      `/marketplace/${listing.slug}`
    )}`;
    return false;
  }

  async function contact(type: "general" | "availability") {
    if (working || !(await requireSignIn())) return;
    const action: WorkingAction = type === "availability" ? "availability" : "message";
    setWorking(action);
    setNotice("");

    try {
      const response = await marketplaceAuthorizedFetch("/api/marketplace/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: listing.id,
          inquiryType: type,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        conversationId?: string;
        messageSent?: boolean;
        error?: string;
      };
      if (!response.ok || !payload.conversationId) {
        throw new Error(payload.error || "Unable to contact the seller.");
      }

      setConversationId(payload.conversationId);
      if (type === "general") {
        window.location.href = `/messages?conversation=${encodeURIComponent(
          payload.conversationId
        )}`;
        return;
      }

      setNotice(
        payload.messageSent
          ? "Availability question sent to the seller."
          : "Your Marketplace conversation is ready."
      );
      window.dispatchEvent(new Event("loombus:messages-changed"));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to contact the seller.");
    } finally {
      setWorking(null);
    }
  }

  if (isOwner) return null;

  const updated = formatMarketplaceDate(listing.updatedAt ?? listing.publishedAt);

  return (
    <section className="mb-6 border-y border-[color:var(--loombus-border-muted)] py-5" aria-labelledby="marketplace-buyer-actions-heading">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[color:var(--loombus-gold)]">
            Buyer actions
          </p>
          <h2 id="marketplace-buyer-actions-heading" className="mt-1 text-xl font-semibold tracking-[-0.025em]">
            Interested in this item?
          </h2>
          <p className="mt-1 text-sm text-[color:var(--loombus-text-muted)]">
            Listed as available{updated ? ` · Updated ${updated}` : ""}. Ask the seller before making plans.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={Boolean(working)}
            onClick={() => void contact("availability")}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-4 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] disabled:opacity-50"
          >
            {working === "availability" ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <PackageCheck size={16} />
            )}
            Ask if available
          </button>
          <button
            type="button"
            disabled={Boolean(working)}
            onClick={() => void contact("general")}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[color:var(--loombus-gold)] px-4 text-sm font-semibold text-[color:var(--loombus-gold-contrast)] transition hover:opacity-90 disabled:opacity-50"
          >
            {working === "message" ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <MessageCircle size={16} />
            )}
            Message seller
          </button>
        </div>
      </div>

      {notice ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[color:var(--loombus-text-muted)]" role="status">
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 size={16} className="text-[color:var(--loombus-gold)]" />
            {notice}
          </span>
          {conversationId ? (
            <Link
              href={`/messages?conversation=${encodeURIComponent(conversationId)}`}
              className="font-semibold text-[color:var(--loombus-gold)] underline underline-offset-4"
            >
              Open conversation
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
