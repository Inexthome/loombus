"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  Building2,
  ClipboardList,
  Loader2,
  Plus,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import type {
  BusinessManageResponse,
  BusinessProfile,
} from "@/lib/business-directory";
import { supabase } from "@/lib/supabase/client";
import { BusinessListingEditor } from "@/components/business-listing-editor";
import { BusinessListingsPanel } from "@/components/business-listings-panel";
import { BusinessModerationPanel } from "@/components/business-moderation-panel";
import {
  type BusinessDraft,
  type ServiceDraft,
  EMPTY_DRAFT,
  EMPTY_SERVICE,
  draftFromBusiness,
} from "@/components/business-manager-model";

type WorkspaceTab = "records" | "editor" | "review";

export default function BusinessManagerPage() {
  const [accessToken, setAccessToken] = useState("");
  const [data, setData] = useState<BusinessManageResponse | null>(null);
  const [draft, setDraft] = useState<BusinessDraft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState("");
  const [formOpen, setFormOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("records");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const editingBusiness = useMemo(
    () => data?.businesses.find((business) => business.id === editingId) ?? null,
    [data?.businesses, editingId],
  );

  const publishedCount = useMemo(
    () => data?.businesses.filter((business) => business.status === "published").length ?? 0,
    [data?.businesses],
  );
  const reviewCount = useMemo(
    () =>
      (data?.moderation.pendingBusinesses.length ?? 0) +
      (data?.moderation.pendingClaims.length ?? 0) +
      (data?.moderation.openReports.length ?? 0),
    [data?.moderation],
  );
  const serviceCount = useMemo(
    () => data?.businesses.reduce((total, business) => total + business.services.length, 0) ?? 0,
    [data?.businesses],
  );

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data: sessionData }) => {
      if (!active) return;
      const token = sessionData.session?.access_token ?? "";
      if (!token) {
        window.location.href = `/login?next=${encodeURIComponent("/businesses/manage")}`;
        return;
      }
      setAccessToken(token);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (accessToken) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/businesses?manage=1", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error ?? "Unable to load business management.");
        return;
      }
      setData(payload as BusinessManageResponse);
    } catch {
      setError("Unable to load business management. Refresh and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function action(payload: Record<string, unknown>) {
    const response = await fetch("/api/businesses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error ?? "Unable to complete the request.");
    return result;
  }

  function updateDraft<K extends keyof BusinessDraft>(key: K, value: BusinessDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateService(index: number, key: keyof ServiceDraft, value: string) {
    setDraft((current) => ({
      ...current,
      services: current.services.map((service, serviceIndex) =>
        serviceIndex === index ? { ...service, [key]: value } : service,
      ),
    }));
  }

  function addService() {
    setDraft((current) => ({
      ...current,
      services: [...current.services, { ...EMPTY_SERVICE }],
    }));
  }

  function removeService(index: number) {
    setDraft((current) => ({
      ...current,
      services:
        current.services.length === 1
          ? [{ ...EMPTY_SERVICE }]
          : current.services.filter((_, serviceIndex) => serviceIndex !== index),
    }));
  }

  function startNew() {
    setEditingId("");
    setDraft({ ...EMPTY_DRAFT, services: [{ ...EMPTY_SERVICE }] });
    setFormOpen(true);
    setActiveTab("editor");
    setMessage("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startEdit(business: BusinessProfile) {
    setEditingId(business.id);
    setDraft(draftFromBusiness(business));
    setFormOpen(true);
    setActiveTab("editor");
    setMessage("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (working) return;
    setWorking(true);
    setMessage("");
    setError("");

    try {
      await action({
        action: editingId ? "update" : "create",
        businessId: editingId || undefined,
        ...draft,
        serviceAreas: draft.serviceAreas
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        services: draft.services.filter((service) => service.name.trim()),
      });
      setMessage(
        data?.isAdmin && draft.publishNow
          ? "Business listing saved and published."
          : "Business listing submitted for administrator review.",
      );
      setEditingId("");
      setDraft({ ...EMPTY_DRAFT, services: [{ ...EMPTY_SERVICE }] });
      setFormOpen(false);
      setActiveTab("records");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save the listing.");
    } finally {
      setWorking(false);
    }
  }

  async function moderate(payload: Record<string, unknown>, successMessage: string) {
    if (working) return;
    setWorking(true);
    setMessage("");
    setError("");
    try {
      await action(payload);
      setMessage(successMessage);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update the queue.");
    } finally {
      setWorking(false);
    }
  }

  if (loading && !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[color:var(--loombus-page-bg)] text-[color:var(--loombus-text)]">
        <Loader2 className="animate-spin text-[color:var(--loombus-gold)]" size={28} />
      </main>
    );
  }

  const tabs: Array<{ key: WorkspaceTab; label: string; count?: number }> = [
    { key: "records", label: "Business records", count: data?.businesses.length ?? 0 },
    { key: "editor", label: editingId ? "Edit business" : "Create business" },
    ...(data?.isAdmin ? [{ key: "review" as const, label: "Admin review", count: reviewCount }] : []),
  ];

  return (
    <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[88rem]">
        <div className="mb-5">
          <Link href="/businesses" className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--loombus-text-muted)] transition hover:text-[color:var(--loombus-gold)]">
            <ArrowLeft size={16} /> Business Directory
          </Link>
        </div>

        <header className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">Manage Businesses</h1>
            <p className="mt-3 text-base leading-7 text-[color:var(--loombus-text-muted)]">
              Build attributable business profiles, publish service areas and offerings, track ownership claims, and manage review status from one workspace.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/services/manage" className="inline-flex h-12 items-center gap-2 rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-4 text-sm font-semibold shadow-sm transition hover:border-[color:var(--loombus-gold)]">
              <Wrench size={16} className="text-[color:var(--loombus-gold)]" /> Manage Services
            </Link>
            <button type="button" onClick={startNew} className="inline-flex h-12 items-center gap-2 rounded-2xl bg-[color:var(--loombus-gold)] px-4 text-sm font-semibold text-[color:var(--loombus-gold-contrast)] transition hover:opacity-90">
              <Plus size={16} /> New business
            </button>
          </div>
        </header>

        <section className="mb-6 grid gap-3 sm:grid-cols-4">
          <article className="rounded-[1.4rem] border border-[color:var(--loombus-gold)] bg-[color:var(--loombus-cream)] p-4 text-[color:var(--loombus-cream-contrast)] shadow-sm dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-text)]">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-gold)]">Business records</span>
            <strong className="mt-2 block text-3xl tracking-[-0.04em]">{data?.businesses.length ?? 0}</strong>
          </article>
          <article className="rounded-[1.4rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">Published</span>
            <strong className="mt-2 block text-3xl tracking-[-0.04em]">{publishedCount}</strong>
          </article>
          <article className="rounded-[1.4rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">Listed Services</span>
            <strong className="mt-2 block text-3xl tracking-[-0.04em]">{serviceCount}</strong>
          </article>
          <article className="rounded-[1.4rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">Ownership claims</span>
            <strong className="mt-2 block text-3xl tracking-[-0.04em]">{data?.claims.length ?? 0}</strong>
          </article>
        </section>

        <nav className="mb-6 flex gap-2 overflow-x-auto rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-2 shadow-sm" aria-label="Business management workspace">
          {tabs.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${active ? "bg-[color:var(--loombus-gold)] text-[color:var(--loombus-gold-contrast)]" : "text-[color:var(--loombus-text-muted)] hover:bg-[color:var(--loombus-page-bg)]"}`}>
                {tab.label}
                {typeof tab.count === "number" ? <span className={`rounded-full px-2 py-0.5 text-xs ${active ? "bg-black/10" : "bg-[color:var(--loombus-page-bg)]"}`}>{tab.count}</span> : null}
              </button>
            );
          })}
        </nav>

        {message ? <p className="mb-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">{message}</p> : null}
        {error ? <p className="mb-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-300">{error}</p> : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
          <section className="min-w-0">
            {activeTab === "records" ? (
              <BusinessListingsPanel businesses={data?.businesses ?? []} claims={data?.claims ?? []} refresh={() => void load()} startEdit={startEdit} />
            ) : null}
            {activeTab === "editor" ? (
              <BusinessListingEditor editingBusiness={editingBusiness} formOpen={formOpen} toggleForm={() => setFormOpen((open) => !open)} submit={submit} draft={draft} updateDraft={updateDraft} updateService={updateService} addService={addService} removeService={removeService} isAdmin={Boolean(data?.isAdmin)} working={working} editingId={editingId} startNew={startNew} />
            ) : null}
            {activeTab === "review" && data?.isAdmin ? (
              <BusinessModerationPanel moderation={data.moderation} moderate={moderate} />
            ) : null}
          </section>

          <aside className="space-y-5 xl:sticky xl:top-28 xl:self-start">
            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <div className="flex items-center justify-between gap-3"><p className="text-xs font-bold uppercase tracking-[0.3em]">Workspace guide</p><Building2 className="h-5 w-5 text-[color:var(--loombus-gold)]" /></div>
              <div className="mt-4 space-y-3 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                <div className="rounded-2xl bg-[color:var(--loombus-page-bg)] p-4"><strong className="block text-[color:var(--loombus-text)]">Records</strong>Review publication, verification, service counts, and ownership claim status.</div>
                <div className="rounded-2xl bg-[color:var(--loombus-page-bg)] p-4"><strong className="block text-[color:var(--loombus-text)]">Editor</strong>Create or update the attributable profile, location, service areas, and individual offerings.</div>
                {data?.isAdmin ? <div className="rounded-2xl bg-[color:var(--loombus-page-bg)] p-4"><strong className="block text-[color:var(--loombus-text)]">Admin review</strong>Handle publication decisions, verification, claims, and reports separately.</div> : null}
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <p className="text-xs font-bold uppercase tracking-[0.3em]">Business destinations</p>
              <div className="mt-4 space-y-2">
                <Link href="/businesses" className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]">Business Directory <ArrowUpRight className="h-4 w-4 text-[color:var(--loombus-gold)]" /></Link>
                <Link href="/jobs/manage" className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]">Manage Jobs <ArrowUpRight className="h-4 w-4 text-[color:var(--loombus-gold)]" /></Link>
                <Link href="/local/manage" className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]">Manage Local area <ArrowUpRight className="h-4 w-4 text-[color:var(--loombus-gold)]" /></Link>
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[color:var(--loombus-cream)] text-[color:var(--loombus-gold)] dark:bg-[color:var(--loombus-gold-soft)]"><ShieldCheck size={18} /></span><div><h3 className="font-semibold">Attribution boundary</h3><p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">Listing control and verification remain separate. Approval does not guarantee credentials, service quality, pricing, or higher search placement.</p></div></div>
            </section>

            {data?.isAdmin ? (
              <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
                <div className="flex items-center gap-2"><ClipboardList size={17} className="text-[color:var(--loombus-gold)]" /><strong>Admin attention</strong></div>
                <p className="mt-3 text-3xl font-semibold">{reviewCount}</p>
                <p className="mt-1 text-sm text-[color:var(--loombus-text-muted)]">Listings, claims, and reports awaiting a decision.</p>
              </section>
            ) : null}
          </aside>
        </div>
      </div>
    </main>
  );
}
