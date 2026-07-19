"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Bookmark,
  ChevronRight,
  Flag,
  Loader2,
  PackageCheck,
  Plus,
  RefreshCw,
  ShieldCheck,
  Store,
} from "lucide-react";
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
import { supabase } from "@/lib/supabase/client";
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

type WorkspaceView = "listings" | "editor" | "moderation";

const secondaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-4 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] hover:bg-[color:var(--loombus-surface-muted)] disabled:opacity-50";
const primaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[color:var(--loombus-gold)] px-4 text-sm font-semibold text-[color:var(--loombus-gold-contrast)] transition hover:opacity-90 disabled:opacity-50";

export default function MarketplaceManagerPage() {
  const [data, setData] = useState<MarketplaceManageResponse | null>(null);
  const [draft, setDraft] = useState<MarketplaceDraft>(emptyMarketplaceDraft);
  const [editing, setEditing] = useState<MarketplaceListing | null>(null);
  const [view, setView] = useState<WorkspaceView>("listings");
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
        { redirectTo: "/marketplace/manage" },
      );
      const payload = (await response.json()) as MarketplaceManageResponse & {
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || "Marketplace management could not load.");
      setData(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Marketplace management could not load.");
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
    [data?.listings],
  );

  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const listing of data?.listings ?? []) {
      counts.set(listing.status, (counts.get(listing.status) ?? 0) + 1);
    }
    return counts;
  }, [data?.listings]);

  const draftCount = statusCounts.get("draft") ?? 0;
  const pendingCount = statusCounts.get("pending") ?? 0;
  const publishedCount = statusCounts.get("published") ?? 0;
  const closedCount =
    (statusCounts.get("sold") ?? 0) +
    (statusCounts.get("expired") ?? 0) +
    (statusCounts.get("removed") ?? 0);

  function updateDraft<K extends keyof MarketplaceDraft>(key: K, value: MarketplaceDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function startNew() {
    const staleUploads = [...sessionPhotoPaths.current];
    if (staleUploads.length > 0) void Promise.all(staleUploads.map(deleteUnusedPhoto));
    setEditing(null);
    setDraft(emptyMarketplaceDraft());
    originalPhotoPaths.current = [];
    sessionPhotoPaths.current = new Set();
    setFormOpen(true);
    setView("editor");
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
    setView("editor");
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
    const input = event.currentTarget;
    const files = Array.from(input.files ?? []);
    input.value = "";
    if (files.length === 0) return;

    setUploading(true);
    setError("");
    const uploaded: MarketplacePhoto[] = [];

    try {
      for (const file of files) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
          throw new Error(`${file.name} must be a JPEG, PNG, or WebP image.`);
        }
        if (file.size <= 0 || file.size > 12 * 1024 * 1024) {
          throw new Error(`${file.name} must be 12 MB or smaller.`);
        }

        const preparationResponse = await marketplaceAuthorizedFetch(
          "/api/marketplace/photos",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileName: file.name,
              contentType: file.type,
              size: file.size,
            }),
          },
        );

        const responseText = await preparationResponse.text();
        let payload: {
          upload?: MarketplacePhoto & { token?: string };
          error?: string;
        } = {};
        if (responseText) {
          try {
            payload = JSON.parse(responseText) as typeof payload;
          } catch {
            payload = {};
          }
        }

        if (!preparationResponse.ok || !payload.upload?.path || !payload.upload?.url || !payload.upload?.token) {
          throw new Error(payload.error || `Unable to prepare ${file.name} for upload.`);
        }

        const { path, token, url } = payload.upload;
        const { error: uploadError } = await supabase.storage
          .from("marketplace-images")
          .uploadToSignedUrl(path, token, file, {
            contentType: file.type,
            cacheControl: "31536000",
          });
        if (uploadError) throw new Error(`Unable to upload ${file.name}.`);

        const photo: MarketplacePhoto = { path, url };
        uploaded.push(photo);
        sessionPhotoPaths.current.add(path);
      }

      setDraft((current) => ({
        ...current,
        photos: [...current.photos, ...uploaded],
      }));
    } catch (cause) {
      await Promise.all(uploaded.map((photo) => deleteUnusedPhoto(photo.path)));
      for (const photo of uploaded) sessionPhotoPaths.current.delete(photo.path);
      setError(cause instanceof Error ? cause.message : "Photo upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto(photo: MarketplacePhoto) {
    updateDraft(
      "photos",
      draft.photos.filter((item) => item.path !== photo.path),
    );
    if (sessionPhotoPaths.current.has(photo.path)) {
      sessionPhotoPaths.current.delete(photo.path);
      await deleteUnusedPhoto(photo.path);
    }
  }

  function listingPayload(saveAsDraft: boolean) {
    return {
      action: editing ? "update" : "create",
      listingId: editing?.id,
      saveAsDraft,
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
      draftData: saveAsDraft
        ? {
            businessId: draft.businessId,
            title: draft.title,
            description: draft.description,
            category: draft.category,
            condition: draft.condition,
            price: draft.price,
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
            tags: draft.tags,
            attributes: draft.attributes.map((attribute) => ({
              key: attribute.key,
              value: attribute.value,
            })),
            expiresAt: draft.expiresAt,
          }
        : null,
    };
  }

  async function persistListing(saveAsDraft: boolean) {
    setWorking(true);
    setMessage("");
    setError("");
    const wasPreviouslySubmitted = Boolean(editing) && editing?.status !== "draft";

    try {
      await marketplaceApiAction(listingPayload(saveAsDraft));
      const retained = new Set(draft.photos.map((photo) => photo.path));
      const removed = originalPhotoPaths.current.filter((path) => !retained.has(path));
      await Promise.all(removed.map(deleteUnusedPhoto));
      setMessage(
        saveAsDraft
          ? "Draft saved privately. You can continue editing it later."
          : wasPreviouslySubmitted
            ? "Listing updated and returned to administrator review."
            : "Listing submitted for administrator review.",
      );
      setEditing(null);
      setDraft(emptyMarketplaceDraft());
      originalPhotoPaths.current = [];
      sessionPhotoPaths.current = new Set();
      setView("listings");
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : saveAsDraft
            ? "Draft could not be saved."
            : "Listing could not be submitted.",
      );
    } finally {
      setWorking(false);
    }
  }

  async function saveDraft() {
    await persistListing(true);
  }

  async function submitListing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await persistListing(false);
  }

  async function sellerAction(action: "sold" | "reopen" | "remove", listingId: string) {
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
            : "Listing removed.",
      );
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Listing could not be updated.");
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

  if (loading && !data) {
    return (
      <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
        <div className="mx-auto grid min-h-64 max-w-[82rem] place-items-center rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] shadow-xl shadow-black/10">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--loombus-text-muted)]">
            <Loader2 className="animate-spin text-[color:var(--loombus-gold)]" size={18} /> Loading Marketplace management
          </span>
        </div>
      </main>
    );
  }

  const tabs: Array<{ key: WorkspaceView; label: string; count: number }> = [
    { key: "listings", label: data?.isAdmin ? "Listing records" : "My listings", count: data?.listings.length ?? 0 },
    { key: "editor", label: editing ? "Edit listing" : "Create listing", count: 0 },
    ...(data?.isAdmin
      ? [{
          key: "moderation" as const,
          label: "Moderation",
          count: (data.moderation.pendingListings.length ?? 0) + (data.moderation.openReports.length ?? 0),
        }]
      : []),
  ];

  return (
    <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-16 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[82rem]">
        <header className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">{data?.isAdmin ? "Marketplace operations" : "Manage Marketplace"}</h1>
            <p className="mt-3 text-base leading-7 text-[color:var(--loombus-text-muted)]">
              {data?.isAdmin
                ? "Review Marketplace records, seller attribution, moderation states, and reports from one operational workspace."
                : "Create attributable listings, save private drafts, manage publication states, and close the lifecycle when an item sells."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/marketplace" className={secondaryButton}>Browse Marketplace <ArrowUpRight size={15} /></Link>
            <button type="button" onClick={() => void load()} className={secondaryButton} disabled={loading}>
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
            <button type="button" onClick={startNew} className={primaryButton}><Plus size={16} /> New listing</button>
          </div>
        </header>

        <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-[1.4rem] border border-[color:var(--loombus-gold)] bg-[color:var(--loombus-cream)] p-4 text-[color:var(--loombus-cream-contrast)] shadow-sm dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-text)]">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-gold)]">Published</span>
            <strong className="mt-2 block text-3xl tracking-[-0.04em]">{publishedCount}</strong>
          </article>
          <article className="rounded-[1.4rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">Private drafts</span>
            <strong className="mt-2 block text-3xl tracking-[-0.04em]">{draftCount}</strong>
          </article>
          <article className="rounded-[1.4rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">Pending review</span>
            <strong className="mt-2 block text-3xl tracking-[-0.04em]">{pendingCount}</strong>
          </article>
          <article className="rounded-[1.4rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">Closed lifecycle</span>
            <strong className="mt-2 block text-3xl tracking-[-0.04em]">{closedCount}</strong>
          </article>
        </section>

        {message ? <div className="mb-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-800 dark:text-emerald-200">{message}</div> : null}
        {error ? <div className="mb-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">{error}</div> : null}

        <nav className="mb-6 flex gap-2 overflow-x-auto rounded-[1.5rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-2 shadow-sm" aria-label="Marketplace management workspace">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setView(tab.key)}
              className={`flex shrink-0 items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                view === tab.key
                  ? "bg-[color:var(--loombus-cream)] text-[color:var(--loombus-cream-contrast)] dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-gold)]"
                  : "hover:bg-[color:var(--loombus-surface-muted)]"
              }`}
            >
              {tab.label}
              {tab.count > 0 ? <span className="rounded-full bg-[color:var(--loombus-page-bg)] px-2 py-0.5 text-xs">{tab.count}</span> : null}
            </button>
          ))}
        </nav>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="min-w-0">
            {view === "listings" ? (
              <MarketplaceSellerListings
                listings={data?.listings ?? []}
                working={working}
                onRefresh={load}
                startEdit={startEdit}
                sellerAction={sellerAction}
              />
            ) : null}

            {view === "editor" ? (
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
                saveDraft={saveDraft}
                submitListing={submitListing}
                startNew={startNew}
              />
            ) : null}

            {view === "moderation" && data?.isAdmin ? (
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
          </section>

          <aside className="space-y-5 xl:sticky xl:top-28 xl:self-start">
            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-[0.3em]">Workspace status</p>
                <Store className="h-5 w-5 text-[color:var(--loombus-gold)]" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {[
                  ["All", data?.listings.length ?? 0],
                  ["Drafts", draftCount],
                  ["Published", publishedCount],
                  ["Pending", pendingCount],
                ].map(([label, value]) => (
                  <article key={String(label)} className="rounded-2xl bg-[color:var(--loombus-page-bg)] p-4">
                    <span className="text-xs font-semibold text-[color:var(--loombus-text-muted)]">{label}</span>
                    <strong className="mt-1 block text-2xl">{value}</strong>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <p className="text-xs font-bold uppercase tracking-[0.3em]">Marketplace actions</p>
              <div className="mt-4 space-y-2">
                <button type="button" onClick={startNew} className="flex w-full items-center justify-between rounded-2xl bg-[color:var(--loombus-cream)] px-4 py-3 text-left text-sm font-semibold text-[color:var(--loombus-cream-contrast)] transition hover:opacity-90 dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-gold)]">
                  Create listing <Plus className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setView("listings")} className="flex w-full items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-left text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]">
                  Listing records <PackageCheck className="h-4 w-4 text-[color:var(--loombus-gold)]" />
                </button>
                {data?.isAdmin ? <button type="button" onClick={() => setView("moderation")} className="flex w-full items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-left text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]">Moderation queue <Flag className="h-4 w-4 text-[color:var(--loombus-gold)]" /></button> : null}
                <Link href="/marketplace/saved" className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]">
                  Saved items <Bookmark className="h-4 w-4 text-[color:var(--loombus-gold)]" />
                </Link>
                <Link href="/marketplace" className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]">
                  Browse Marketplace <ChevronRight className="h-4 w-4 text-[color:var(--loombus-gold)]" />
                </Link>
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <div className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--loombus-cream)] text-[color:var(--loombus-gold)] dark:bg-[color:var(--loombus-gold-soft)]">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-semibold">Attribution and lifecycle remain explicit</h3>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                    Personal and approved business attribution remain separate. Draft, review, publication, sold, reopened, and removed states stay visible to the seller.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <p className="text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                Loombus does not process Marketplace payments. Confirm identity, item condition, ownership, delivery, and payment terms before completing a transaction.
              </p>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
