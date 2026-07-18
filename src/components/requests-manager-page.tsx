"use client";

import Link from "next/link";
import { CheckCircle2, HandHeart, RefreshCw, Send, XCircle } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  SERVICE_REQUEST_CATEGORIES,
  SERVICE_REQUEST_TYPES,
  requestLocationLabel,
  requestTypeLabel,
  type PublicServiceRequest,
  type ServiceRequestManageResponse,
  type ServiceRequestResponse,
} from "@/lib/service-requests";
import { serviceRequestsAuthorizedFetch } from "@/lib/service-requests-client";

type Draft = {
  requestId: string;
  businessId: string;
  title: string;
  description: string;
  requestType: string;
  category: string;
  urgency: string;
  serviceMode: string;
  city: string;
  region: string;
  postalCode: string;
  deadline: string;
};

const EMPTY: Draft = {
  requestId: "",
  businessId: "",
  title: "",
  description: "",
  requestType: "service_needed",
  category: "Home and property",
  urgency: "normal",
  serviceMode: "flexible",
  city: "",
  region: "",
  postalCode: "",
  deadline: "",
};

function localDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

function editDraft(item: PublicServiceRequest): Draft {
  return {
    requestId: item.id,
    businessId: item.businessId ?? "",
    title: item.title,
    description: item.description,
    requestType: item.requestType,
    category: item.category,
    urgency: item.urgency,
    serviceMode: item.serviceMode,
    city: item.city ?? "",
    region: item.region ?? "",
    postalCode: item.postalCode ?? "",
    deadline: localDate(item.deadline),
  };
}

function Status({ value }: { value: string }) {
  return (
    <span className="rounded-full border border-[var(--loombus-border)] px-3 py-1 text-xs font-semibold capitalize">
      {value.replaceAll("_", " ")}
    </span>
  );
}

export default function RequestsManagerPage() {
  const [data, setData] = useState<ServiceRequestManageResponse | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await serviceRequestsAuthorizedFetch(
        "/api/requests?manage=1",
        { cache: "no-store" },
        "/requests/manage",
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Unable to load Requests.");
      setData(payload as ServiceRequestManageResponse);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load Requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const responses = useMemo(() => {
    const map = new Map<string, ServiceRequestResponse[]>();
    for (const response of data?.receivedResponses ?? []) {
      map.set(response.requestId, [...(map.get(response.requestId) ?? []), response]);
    }
    return map;
  }, [data?.receivedResponses]);

  async function send(body: Record<string, unknown>, key: string, success: string) {
    if (working) return;
    setWorking(key);
    setNotice("");
    try {
      const response = await serviceRequestsAuthorizedFetch(
        "/api/requests",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        "/requests/manage",
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Unable to update the Request.");
      if (payload.conversationId) {
        window.location.href = `/messages?conversation=${encodeURIComponent(payload.conversationId)}`;
        return;
      }
      setNotice(success);
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to update the Request.");
    } finally {
      setWorking("");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await send(
      {
        ...draft,
        action: draft.requestId ? "update" : "create",
        countryCode: "US",
        currency: "USD",
        budgetType: "flexible",
        deadline: draft.deadline ? new Date(draft.deadline).toISOString() : "",
        tags: [],
        attachmentPaths: [],
        attachmentUrls: [],
        attachmentTypes: [],
        attachmentNames: [],
      },
      "save",
      "Request saved and sent to administrator review.",
    );
    setDraft(EMPTY);
  }

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 py-8 text-[var(--loombus-text)] sm:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--loombus-text-subtle)]">Requests workspace</p>
              <h1 className="mt-2 text-4xl font-semibold">Turn an unmet need into accountable action.</h1>
              <p className="mt-3 max-w-2xl text-[var(--loombus-text-muted)]">Create public Requests, review attributable responses, select one, and continue through private Loombus messages.</p>
            </div>
            <div className="flex gap-3">
              <Link href="/requests" className="rounded-full border border-[var(--loombus-border)] px-5 py-3 text-sm font-semibold">Browse Requests</Link>
              <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] px-5 py-3 text-sm font-semibold"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh</button>
            </div>
          </div>
        </header>

        {notice ? <div className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 text-sm" role="status">{notice}</div> : null}

        {!data?.isAdmin ? (
          <form onSubmit={submit} className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 sm:p-6">
            <div className="flex justify-between gap-4"><h2 className="text-2xl font-semibold">{draft.requestId ? "Edit Request" : "Create Request"}</h2>{draft.requestId ? <button type="button" onClick={() => setDraft(EMPTY)} className="text-sm font-semibold">Clear edit</button> : null}</div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2"><span className="mb-2 block text-sm font-semibold">Title</span><input required minLength={5} maxLength={200} value={draft.title} onChange={(event: any) => setDraft({ ...draft, title: event.target.value })} className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3" /></label>
              <label className="sm:col-span-2"><span className="mb-2 block text-sm font-semibold">Describe the need</span><textarea required minLength={30} maxLength={16000} rows={6} value={draft.description} onChange={(event: any) => setDraft({ ...draft, description: event.target.value })} className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3" /></label>
              <label><span className="mb-2 block text-sm font-semibold">Type</span><select value={draft.requestType} onChange={(event: any) => setDraft({ ...draft, requestType: event.target.value })} className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3">{SERVICE_REQUEST_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
              <label><span className="mb-2 block text-sm font-semibold">Category</span><select value={draft.category} onChange={(event: any) => setDraft({ ...draft, category: event.target.value })} className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3">{SERVICE_REQUEST_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label><span className="mb-2 block text-sm font-semibold">Urgency</span><select value={draft.urgency} onChange={(event: any) => setDraft({ ...draft, urgency: event.target.value })} className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3"><option value="normal">Normal</option><option value="soon">Needed soon</option><option value="urgent">Urgent</option></select></label>
              <label><span className="mb-2 block text-sm font-semibold">Location mode</span><select value={draft.serviceMode} onChange={(event: any) => setDraft({ ...draft, serviceMode: event.target.value })} className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3"><option value="flexible">Flexible</option><option value="remote">Remote</option><option value="requester_location">Requester location</option><option value="provider_location">Provider location</option></select></label>
              {draft.serviceMode !== "remote" ? <><label><span className="mb-2 block text-sm font-semibold">City</span><input value={draft.city} onChange={(event: any) => setDraft({ ...draft, city: event.target.value })} className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3" /></label><label><span className="mb-2 block text-sm font-semibold">State or region</span><input value={draft.region} onChange={(event: any) => setDraft({ ...draft, region: event.target.value })} className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3" /></label></> : null}
              <label><span className="mb-2 block text-sm font-semibold">Deadline</span><input type="datetime-local" value={draft.deadline} onChange={(event: any) => setDraft({ ...draft, deadline: event.target.value })} className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3" /></label>
              <label><span className="mb-2 block text-sm font-semibold">Business attribution</span><select value={draft.businessId} onChange={(event: any) => setDraft({ ...draft, businessId: event.target.value })} className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3"><option value="">Personal profile</option>{(data?.businesses ?? []).map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}</select></label>
            </div>
            <button type="submit" disabled={working === "save"} className="mt-5 rounded-full bg-[var(--loombus-primary-bg)] px-6 py-3 text-sm font-semibold text-[var(--loombus-primary-text)] disabled:opacity-50">{draft.requestId ? "Update and resubmit" : "Create Request"}</button>
          </form>
        ) : null}

        <section className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 sm:p-6">
          <div className="flex items-center gap-2"><HandHeart size={19} /><h2 className="text-2xl font-semibold">Request records</h2></div>
          <div className="mt-5 grid gap-4">
            {(data?.requests ?? []).map((item) => (
              <article key={item.id} className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div><div className="flex gap-2"><Status value={item.status} /><span className="text-xs">{requestTypeLabel(item.requestType)}</span></div><h3 className="mt-3 text-xl font-semibold">{item.title}</h3><p className="mt-2 text-sm text-[var(--loombus-text-muted)]">{requestLocationLabel(item)}</p></div>
                  <div className="flex flex-wrap gap-2">
                    {item.status === "open" ? <Link href={`/requests/${item.slug}`} className="rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm font-semibold">Open</Link> : null}
                    {!data?.isAdmin && !["in_progress", "resolved", "closed", "removed"].includes(item.status) ? <button type="button" onClick={() => { setDraft(editDraft(item)); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm font-semibold">Edit</button> : null}
                    {!data?.isAdmin && item.status === "open" ? <button type="button" onClick={() => void send({ action: "reviewing", requestId: item.id }, `reviewing:${item.id}`, "Request moved to review.")} className="rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm font-semibold">Review responses</button> : null}
                    {!data?.isAdmin && ["reviewing", "in_progress"].includes(item.status) ? <button type="button" onClick={() => void send({ action: "resolved", requestId: item.id }, `resolved:${item.id}`, "Request resolved.")} className="rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm font-semibold">Resolve</button> : null}
                    {data?.isAdmin && item.status === "pending" ? <><button type="button" onClick={() => void send({ action: "moderate", requestId: item.id, decision: "approve" }, `approve:${item.id}`, "Request approved.")} className="inline-flex items-center gap-1 rounded-full bg-[var(--loombus-primary-bg)] px-4 py-2 text-sm font-semibold text-[var(--loombus-primary-text)]"><CheckCircle2 size={14} /> Approve</button><button type="button" onClick={() => { const note = window.prompt("Change request note", ""); if (note !== null) void send({ action: "moderate", requestId: item.id, decision: "reject", note }, `reject:${item.id}`, "Changes requested."); }} className="inline-flex items-center gap-1 rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm font-semibold"><XCircle size={14} /> Changes</button></> : null}
                  </div>
                </div>
                {(responses.get(item.id)?.length ?? 0) > 0 ? <div className="mt-5 grid gap-3 border-t border-[var(--loombus-border)] pt-4">{responses.get(item.id)?.map((response) => <div key={response.id} className="rounded-xl border border-[var(--loombus-border)] p-4"><Status value={response.status} /><strong className="mt-2 block">{response.businessName || response.responderName}</strong><p className="mt-2 text-sm text-[var(--loombus-text-muted)]">{response.message}</p>{response.status === "submitted" && !item.selectedResponseId ? <button type="button" onClick={() => void send({ action: "select_response", requestId: item.id, responseId: response.id }, `select:${response.id}`, "Response selected.")} className="mt-3 inline-flex items-center gap-2 rounded-full bg-[var(--loombus-primary-bg)] px-4 py-2 text-sm font-semibold text-[var(--loombus-primary-text)]"><Send size={14} /> Select and message</button> : null}</div>)}</div> : null}
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
