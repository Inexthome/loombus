"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CircleAlert,
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

export default function BusinessManagerPage() {
  const [accessToken, setAccessToken] = useState("");
  const [data, setData] = useState<BusinessManageResponse | null>(null);
  const [draft, setDraft] = useState<BusinessDraft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState("");
  const [formOpen, setFormOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const editingBusiness = useMemo(
    () => data?.businesses.find((business) => business.id === editingId) ?? null,
    [data?.businesses, editingId]
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

  function updateDraft<K extends keyof BusinessDraft>(
    key: K,
    value: BusinessDraft[K]
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateService(index: number, key: keyof ServiceDraft, value: string) {
    setDraft((current) => ({
      ...current,
      services: current.services.map((service, serviceIndex) =>
        serviceIndex === index ? { ...service, [key]: value } : service
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
    setMessage("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startEdit(business: BusinessProfile) {
    setEditingId(business.id);
    setDraft(draftFromBusiness(business));
    setFormOpen(true);
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
          : "Business listing submitted for administrator review."
      );
      setEditingId("");
      setDraft({ ...EMPTY_DRAFT, services: [{ ...EMPTY_SERVICE }] });
      setFormOpen(false);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save the listing.");
    } finally {
      setWorking(false);
    }
  }

  async function moderate(
    payload: Record<string, unknown>,
    successMessage: string
  ) {
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
      <main className="loombus-shell-with-right-rail flex min-h-screen items-center justify-center bg-[var(--loombus-page-bg)] text-[var(--loombus-text)]">
        <Loader2 className="animate-spin" size={28} />
      </main>
    );
  }

  return (
    <main className="loombus-shell-with-right-rail min-h-screen bg-[var(--loombus-page-bg)] text-[var(--loombus-text)]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Link
          href="/businesses"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--loombus-text-muted)]"
        >
          <ArrowLeft size={16} /> Local Business and Services
        </Link>

        <section className="mt-5 rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 shadow-xl shadow-black/5 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-[var(--loombus-text-subtle)]">
                Business workspace
              </p>
              <h1 className="mt-2 text-4xl font-semibold tracking-[-0.05em]">
                Build an attributable local listing.
              </h1>
              <p className="mt-3 max-w-3xl leading-7 text-[var(--loombus-text-muted)]">
                Publish business facts, service areas, and individual offerings.
                New and materially edited listings enter review before becoming public.
              </p>
            </div>
            <button
              type="button"
              onClick={startNew}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--loombus-primary-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--loombus-primary-text)]"
            >
              <Plus size={16} /> New business
            </button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <article className="rounded-2xl bg-[var(--loombus-page-bg)] p-4">
              <ShieldCheck size={19} />
              <h2 className="mt-2 font-semibold">Ownership</h2>
              <p className="mt-1 text-sm leading-5 text-[var(--loombus-text-muted)]">
                Listing control and business verification are tracked separately.
              </p>
            </article>
            <article className="rounded-2xl bg-[var(--loombus-page-bg)] p-4">
              <Wrench size={19} />
              <h2 className="mt-2 font-semibold">Services</h2>
              <p className="mt-1 text-sm leading-5 text-[var(--loombus-text-muted)]">
                Each service becomes independently discoverable in Everything Search.
              </p>
            </article>
            <article className="rounded-2xl bg-[var(--loombus-page-bg)] p-4">
              <CircleAlert size={19} />
              <h2 className="mt-2 font-semibold">No pay-to-rank</h2>
              <p className="mt-1 text-sm leading-5 text-[var(--loombus-text-muted)]">
                Approval or verification does not purchase higher search placement.
              </p>
            </article>
          </div>
        </section>

        {message ? (
          <p className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-600">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-500">
            {error}
          </p>
        ) : null}

        <BusinessListingEditor
          editingBusiness={editingBusiness}
          formOpen={formOpen}
          toggleForm={() => setFormOpen((open) => !open)}
          submit={submit}
          draft={draft}
          updateDraft={updateDraft}
          updateService={updateService}
          addService={addService}
          removeService={removeService}
          isAdmin={Boolean(data?.isAdmin)}
          working={working}
          editingId={editingId}
          startNew={startNew}
        />

        <BusinessListingsPanel
          businesses={data?.businesses ?? []}
          claims={data?.claims ?? []}
          refresh={() => void load()}
          startEdit={startEdit}
        />

        {data?.isAdmin ? (
          <BusinessModerationPanel
            moderation={data.moderation}
            moderate={moderate}
          />
        ) : null}
      </div>
    </main>
  );
}
