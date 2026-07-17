"use client";

import Link from "next/link";
import { Plus, Store } from "lucide-react";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MARKETPLACE_CATEGORIES,
  type MarketplaceListing,
  type MarketplaceManageResponse,
  type MarketplacePhoto,
  type MarketplaceReport,
} from "@/lib/marketplace";
import { marketplaceAuthorizedFetch } from "@/lib/marketplace-auth-client";
import { MarketplaceAdminReview } from "@/components/marketplace-admin-review";
import { MarketplaceListingEditor } from "@/components/marketplace-listing-editor";
import {
  buildMarketplaceAttributes,
  emptyMarketplaceDraft,
  marketplaceApiAction,
  marketplaceDraftFromListing,
  parseMarketplaceTags,
  type MarketplaceDraft,
} from "@/components/marketplace-manager-model";
import { MarketplaceSellerListings } from "@/components/marketplace-seller-listings";

export default function MarketplaceManagerPage() {
  const [data, setData] = useState<MarketplaceManageResponse | null>(null);
  const [draft, setDraft] = useState<MarketplaceDraft>(emptyMarketplaceDraft);
  const [editing, setEditing] = useState<MarketplaceListing | null>(null);
  const [formOpen, setFormOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [moderationNotes, setModerationNotes] = useState<Record<string, string>>({});
  const [reportNotes, setReportNotes] = useState<Record<string, string>>({});
  const originalPhotoPaths = useRef<string[]>([]);
  const sessionPhotoPaths = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await marketplaceAuthorizedFetch(
        "/api/marketplace?manage=1",
        { cache: "no-store" },
        { redirectTo: "/marketplace/manage" }
      );
      const payload = (await response.json()) as MarketplaceManageResponse & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Marketplace management could not load.");
      }
      setData(payload);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Marketplace management could not load."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const usedCategories = useMemo(
    () => [
      ...new Set([
        ...MARKETPLACE_CATEGORIES,
        ...(data?.listings.map((listing) => listing.category) ?? []),
      ]),
    ],
    [data?.listings]
  );

  function updateDraft<K extends keyof MarketplaceDraft>(
    key: K,
    value: MarketplaceDraft[K]
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function startNew() {
    const staleUploads = [...sessionPhotoPaths.current];
    if (staleUploads.length > 0) {
      void Promise.all(staleUploads.map(deleteUnusedPhoto));
    }
    setEditing(null);
    setDraft(emptyMarketplaceDraft());
    originalPhotoPaths.current = [];
    sessionPhotoPaths.current = new Set();
    setFormOpen(true);
    setMessage("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startEdit(listing: MarketplaceListing) {
    setEditing(listing);
    setDraft(marketplaceDraftFromListing(listing));
    originalPhotoPaths.current = listing.photos.map((photo) => photo.path);
    sessionPhotoPaths.current = new Set();
    setFormOpen(true);
    setMessage("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteUnusedPhoto(path: string) {
    await marketplaceAuthorizedFetch("/api/marketplace/photos", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    }).catch(() => null);
  }

  async function uploadPhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    setUploading(true);
    setError("");
    const uploaded: MarketplacePhoto[] = [];
    try {
      for (const file of files) {
        const form = new FormData();
        form.set("file", file);
        const response = await marketplaceAuthorizedFetch(
          "/api/marketplace/photos",
          {
            method: "POST",
            body: form,
          }
        );
        const payload = (await response.json()) as {
          photo?: MarketplacePhoto;
          error?: string;
        };
        if (!response.ok || !payload.photo) {
          throw new Error(payload.error || `Unable to upload ${file.name}.`);
        }
        uploaded.push(payload.photo);
        sessionPhotoPaths.current.add(payload.photo.path);
      }
      setDraft((current) => ({
        ...current,
        photos: [...current.photos, ...uploaded],
      }));
    } catch (cause) {
      await Promise.all(uploaded.map((photo) => deleteUnusedPhoto(photo.path)));
      for (const photo of uploaded) {
        sessionPhotoPaths.current.delete(photo.path);
      }
      setError(cause instanceof Error ? cause.message : "Photo upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto(photo: MarketplacePhoto) {
    updateDraft(
      "photos",
      draft.photos.filter((item) => item.path !== photo.path)
    );
    if (sessionPhotoPaths.current.has(photo.path)) {
      sessionPhotoPaths.current.delete(photo.path);
      await deleteUnusedPhoto(photo.path);
    }
  }

  async function submitListing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking(true);
    setMessage("");
    setError("");
    try {
      await marketplaceApiAction({
        action: editing ? "update" : "create",
        listingId: editing?.id,
        businessId: draft.businessId || null,
        title: draft.title,
        description: draft.description,
        category: draft.category,
        condition: draft.condition,
        price: draft.isFree ? 0 : draft.price,
        currency: draft.currency,
        isFree: draft.isFree,
        isNegotiable: draft.isNegotiable,
        city: draft.city,
        region: draft.region,
        postalCode: draft.postalCode,
        countryCode: draft.countryCode,
        pickupAvailable: draft.pickupAvailable,
        localDeliveryAvailable: draft.localDeliveryAvailable,
        shippingAvailable: draft.shippingAvailable,
        tags: parseMarketplaceTags(draft.tags),
        attributes: buildMarketplaceAttributes(draft.attributes),
        photoUrls: draft.photos.map((photo) => photo.url),
        photoPaths: draft.photos.map((photo) => photo.path),
        expiresAt: draft.expiresAt || null,
      });

      const retained = new Set(draft.photos.map((photo) => photo.path));
      const removed = originalPhotoPaths.current.filter(
        (path) => !retained.has(path)
      );
      await Promise.all(removed.map(deleteUnusedPhoto));
      setMessage(
        editing
          ? "Listing updated and returned to administrator review."
          : "Listing submitted for administrator review."
      );
      setEditing(null);
      setDraft(emptyMarketplaceDraft());
      originalPhotoPaths.current = [];
      sessionPhotoPaths.current = new Set();
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Listing could not be saved."
      );
    } finally {
      setWorking(false);
    }
  }

  async function sellerAction(
    action: "sold" | "reopen" | "remove",
    listingId: string
  ) {
    setWorking(true);
    setMessage("");
    setError("");
    try {
      await marketplaceApiAction({ action, listingId });
      setMessage(
        action === "sold"
          ? "Listing marked sold."
          : action === "reopen"
            ? "Listing reopened and returned to review."
            : "Listing removed."
      );
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Listing could not be updated."
      );
    } finally {
      setWorking(false);
    }
  }

  async function moderate(listingId: string, decision: string) {
    setWorking(true);
    setError("");
    try {
      await marketplaceApiAction({
        action: "moderate",
        listingId,
        decision,
        note: moderationNotes[listingId] ?? "",
      });
      setMessage("Marketplace moderation decision saved.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Moderation failed.");
    } finally {
      setWorking(false);
    }
  }

  async function reviewReport(report: MarketplaceReport, decision: string) {
    setWorking(true);
    setError("");
    try {
      await marketplaceApiAction({
        action: "review_report",
        reportId: report.id,
        decision,
        note: reportNotes[report.id] ?? "",
      });
      setMessage("Marketplace report reviewed.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Report review failed.");
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--loombus-page-bg)] p-8 text-center text-[var(--loombus-text-muted)]">
        Loading Marketplace management…
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] text-[var(--loombus-text)]">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--loombus-text-subtle)]">
                <Store size={16} /> Marketplace seller workspace
              </div>
              <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em]">
                Manage attributable listings.
              </h1>
              <p className="mt-3 max-w-3xl leading-7 text-[var(--loombus-text-muted)]">
                Personal sellers may list their own items. Approved business attribution is optional and available only for a published business profile you control. Loombus does not process payments.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/marketplace"
                className="rounded-xl border border-[var(--loombus-border)] px-4 py-3 font-semibold"
              >
                Browse Marketplace
              </Link>
              <button
                type="button"
                onClick={startNew}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--loombus-text)] px-4 py-3 font-semibold text-[var(--loombus-page-bg)]"
              >
                <Plus size={17} /> New listing
              </button>
            </div>
          </div>
        </section>

        {message ? (
          <div className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-800 dark:text-emerald-200">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        ) : null}

        <MarketplaceListingEditor
          data={data}
          draft={draft}
          editing={editing}
          formOpen={formOpen}
          setFormOpen={setFormOpen}
          usedCategories={usedCategories}
          working={working}
          uploading={uploading}
          updateDraft={updateDraft}
          uploadPhotos={uploadPhotos}
          removePhoto={removePhoto}
          submitListing={submitListing}
          startNew={startNew}
        />

        <MarketplaceSellerListings
          listings={data?.listings ?? []}
          working={working}
          onRefresh={load}
          startEdit={startEdit}
          sellerAction={sellerAction}
        />

        {data?.isAdmin ? (
          <MarketplaceAdminReview
            data={data}
            working={working}
            moderationNotes={moderationNotes}
            setModerationNotes={setModerationNotes}
            reportNotes={reportNotes}
            setReportNotes={setReportNotes}
            moderate={moderate}
            reviewReport={reviewReport}
          />
        ) : null}
      </div>
    </main>
  );
}
