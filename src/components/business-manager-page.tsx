"use client";

import Link from "next/link";
import { ArrowLeft, Loader2, Plus, Wrench } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import type { BusinessManageResponse, BusinessProfile } from "@/lib/business-directory";
import { supabase } from "@/lib/supabase/client";
import { BusinessListingEditor } from "@/components/business-listing-editor";
import { BusinessListingsPanel } from "@/components/business-listings-panel";
import { BusinessModerationPanel } from "@/components/business-moderation-panel";
import { type BusinessDraft, type ServiceDraft, EMPTY_DRAFT, EMPTY_SERVICE, draftFromBusiness } from "@/components/business-manager-model";

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

  const editingBusiness = useMemo(() => data?.businesses.find((business) => business.id === editingId) ?? null, [data?.businesses, editingId]);
  const publishedCount = useMemo(() => data?.businesses.filter((business) => business.status === "published").length ?? 0, [data?.businesses]);
  const reviewCount = useMemo(() => (data?.moderation.pendingBusinesses.length ?? 0) + (data?.moderation.pendingClaims.length ?? 0) + (data?.moderation.openReports.length ?? 0), [data?.moderation]);
  const serviceCount = useMemo(() => data?.businesses.reduce((total, business) => total + business.services.length, 0) ?? 0, [data?.businesses]);

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
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (accessToken) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/businesses?manage=1", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error ?? "Unable to load business management.");
        return;
      }
      setData(payload as BusinessManageResponse);
    } catch {
      setError("Unable to load business management. Refresh and try again.");
    } finally { setLoading(false); }
  }

  async function action(payload: Record<string, unknown>) {
    const response = await fetch("/api/businesses", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error ?? "Unable to complete the request.");
    return result;
  }

  function updateDraft<K extends keyof BusinessDraft>(key: K, value: BusinessDraft[K]) { setDraft((current) => ({ ...current, [key]: value })); }
  function updateService(index: number, key: keyof ServiceDraft, value: string) { setDraft((current) => ({ ...current, services: current.services.map((service, serviceIndex) => serviceIndex === index ? { ...service, [key]: value } : service) })); }
  function addService() { setDraft((current) => ({ ...current, services: [...current.services, { ...EMPTY_SERVICE }] })); }
  function removeService(index: number) { setDraft((current) => ({ ...current, services: current.services.length === 1 ? [{ ...EMPTY_SERVICE }] : current.services.filter((_, serviceIndex) => serviceIndex !== index) })); }

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
      await action({ action: editingId ? "update" : "create", businessId: editingId || undefined, ...draft, serviceAreas: draft.serviceAreas.split(",").map((item) => item.trim()).filter(Boolean), services: draft.services.filter((service) => service.name.trim()) });
      setMessage(data?.isAdmin && draft.publishNow ? "Business listing saved and published." : "Business listing submitted for administrator review.");
      setEditingId("");
      setDraft({ ...EMPTY_DRAFT, services: [{ ...EMPTY_SERVICE }] });
      setFormOpen(false);
      setActiveTab("records");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save the listing.");
    } finally { setWorking(false); }
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
    } finally { setWorking(false); }
  }

  if (loading && !data) return <main className="flex min-h-screen items-center justify-center bg-[color:var(--loombus-page-bg)] text-[color:var(--loombus-text)]"><Loader2 className="animate-spin text-[color:var(--loombus-gold)]" size={26} /></main>;

  const tabs: Array<{ key: WorkspaceTab; label: string; count?: number }> = [
    { key: "records", label: "Business records", count: data?.businesses.length ?? 0 },
    { key: "editor", label: editingId ? "Edit business" : "Create business" },
    ...(data?.isAdmin ? [{ key: "review" as const, label: "Admin review", count: reviewCount }] : []),
  ];

  return (
    <main data-business-editorial="manage" className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-7 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[82rem]">
        <Link href="/businesses" className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--loombus-text-muted)] hover:text-[color:var(--loombus-gold)]"><ArrowLeft size={15} /> Business Directory</Link>

        <header className="mt-5 flex flex-col gap-5 border-b border-[color:var(--loombus-border)] pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl"><p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Business workspace</p><h1 className="mt-2 text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">Manage Businesses</h1><p className="mt-3 max-w-2xl text-base leading-7 text-[color:var(--loombus-text-muted)]">Create, update, publish, and review attributable business records.</p></div>
          <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold"><Link href="/services/manage" className="inline-flex items-center gap-2 hover:text-[color:var(--loombus-gold)]"><Wrench size={15} /> Manage Services</Link><button type="button" onClick={startNew} className="inline-flex items-center gap-2 text-[color:var(--loombus-gold)] hover:underline"><Plus size={15} /> New business</button></div>
        </header>

        <section aria-label="Business management signals" className="grid border-b border-[color:var(--loombus-border)] sm:grid-cols-4">
          {[["Records", data?.businesses.length ?? 0], ["Published", publishedCount], ["Services", serviceCount], ["Claims", data?.claims.length ?? 0]].map(([label, value]) => <div key={String(label)} className="flex items-baseline justify-between gap-4 border-b border-[color:var(--loombus-border-muted)] py-4 sm:border-b-0 sm:border-r sm:px-4 sm:first:pl-0 sm:last:border-r-0 sm:last:pr-0"><span className="text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--loombus-text-subtle)]">{label}</span><strong className="text-xl font-semibold">{value}</strong></div>)}
        </section>

        <nav className="flex gap-6 overflow-x-auto border-b border-[color:var(--loombus-border)]" aria-label="Business management workspace">
          {tabs.map((tab) => {
            const active = activeTab === tab.key;
            return <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-0 py-4 text-sm font-semibold ${active ? "border-[color:var(--loombus-gold)] text-[color:var(--loombus-text)]" : "border-transparent text-[color:var(--loombus-text-muted)] hover:text-[color:var(--loombus-text)]"}`}>{tab.label}{typeof tab.count === "number" ? <span className="text-xs text-[color:var(--loombus-text-subtle)]">{tab.count}</span> : null}</button>;
          })}
        </nav>

        {message ? <p className="border-b border-emerald-500/30 py-4 text-sm text-emerald-700 dark:text-emerald-300" role="status">{message}</p> : null}
        {error ? <p className="border-b border-red-500/30 py-4 text-sm text-red-600 dark:text-red-300" role="alert">{error}</p> : null}

        <section className="py-7">
          {activeTab === "records" ? <BusinessListingsPanel businesses={data?.businesses ?? []} claims={data?.claims ?? []} refresh={() => void load()} startEdit={startEdit} /> : null}
          {activeTab === "editor" ? <BusinessListingEditor editingBusiness={editingBusiness} formOpen={formOpen} toggleForm={() => setFormOpen((open) => !open)} submit={submit} draft={draft} updateDraft={updateDraft} updateService={updateService} addService={addService} removeService={removeService} isAdmin={Boolean(data?.isAdmin)} working={working} editingId={editingId} startNew={startNew} /> : null}
          {activeTab === "review" && data?.isAdmin ? <BusinessModerationPanel moderation={data.moderation} moderate={moderate} /> : null}
        </section>
      </div>
    </main>
  );
}
