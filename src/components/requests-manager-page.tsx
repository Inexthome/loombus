"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  FileText,
  Loader2,
  MessageCircle,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  SERVICE_REQUEST_CATEGORIES,
  SERVICE_REQUEST_TYPES,
  formatRequestBudget,
  formatRequestDate,
  requestLocationLabel,
  requestTypeLabel,
  requestUrgencyLabel,
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

type WorkspaceView = "requests" | "editor" | "responses" | "reports";

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

const inputClass =
  "w-full border-0 border-b border-[color:var(--loombus-border)] bg-transparent px-0 py-3 text-[color:var(--loombus-text)] outline-none transition placeholder:text-[color:var(--loombus-text-subtle)] focus:border-[color:var(--loombus-gold)] focus:ring-0";
const secondary =
  "inline-flex items-center justify-center gap-2 rounded-full border border-[color:var(--loombus-border)] bg-transparent px-4 py-2 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] disabled:opacity-50";
const primary =
  "inline-flex items-center justify-center gap-2 rounded-full bg-[color:var(--loombus-gold)] px-4 py-2 text-sm font-semibold text-[color:var(--loombus-gold-contrast)] transition hover:opacity-90 disabled:opacity-50";

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
    <span className="text-xs font-semibold capitalize text-[color:var(--loombus-text-muted)]">
      {value.replaceAll("_", " ")}
    </span>
  );
}

function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={wide ? "sm:col-span-2" : ""}>
      <span className="block text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}

export default function RequestsManagerPage() {
  const [data, setData] = useState<ServiceRequestManageResponse | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [view, setView] = useState<WorkspaceView>("requests");
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

  const responsesByRequest = useMemo(() => {
    const map = new Map<string, ServiceRequestResponse[]>();
    for (const response of data?.receivedResponses ?? []) {
      map.set(response.requestId, [...(map.get(response.requestId) ?? []), response]);
    }
    return map;
  }, [data?.receivedResponses]);

  const actionableResponses = useMemo(
    () =>
      (data?.receivedResponses ?? []).filter(
        (response) => response.status === "submitted",
      ).length,
    [data?.receivedResponses],
  );

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
    setView("requests");
  }

  function updateDraft<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function beginCreate() {
    setDraft(EMPTY);
    setView("editor");
  }

  function beginEdit(item: PublicServiceRequest) {
    setDraft(editDraft(item));
    setView("editor");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (loading && !data) {
    return (
      <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-8 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[78rem] border-y border-[color:var(--loombus-border)] py-16 text-center text-[color:var(--loombus-text-muted)]">
          <Loader2 className="mx-auto animate-spin text-[color:var(--loombus-gold)]" size={28} />
          <p className="mt-3">Loading Requests…</p>
        </div>
      </main>
    );
  }

  const tabs: Array<{ key: WorkspaceView; label: string; count: number }> = data?.isAdmin
    ? [
        { key: "requests", label: "Request records", count: data.requests.length },
        { key: "reports", label: "Open reports", count: data.reports.length },
      ]
    : [
        { key: "requests", label: "My Requests", count: data?.requests.length ?? 0 },
        { key: "editor", label: draft.requestId ? "Edit Request" : "Create Request", count: 0 },
        {
          key: "responses",
          label: "Responses",
          count: (data?.receivedResponses.length ?? 0) + (data?.sentResponses.length ?? 0),
        },
      ];

  const signals = [
    ["Open", data?.metrics.open ?? 0],
    ["Pending review", data?.metrics.pending ?? 0],
    [data?.isAdmin ? "In progress" : "Responses to review", data?.isAdmin ? data.metrics.inProgress : actionableResponses],
    [data?.isAdmin ? "Open reports" : "Resolved", data?.isAdmin ? data.metrics.openReports : data?.metrics.resolved ?? 0],
  ];

  return (
    <main
      data-requests-editorial="manage"
      className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-8 text-[color:var(--loombus-text)] sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-[78rem]">
        <header className="border-b border-[color:var(--loombus-border)] pb-7">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-[color:var(--loombus-gold)]">
            {data?.isAdmin ? "Request moderation" : "Request workspace"}
          </p>
          <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <h1 className="text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">
                {data?.isAdmin ? "Request operations" : "Manage Requests"}
              </h1>
              <p className="mt-3 text-base leading-7 text-[color:var(--loombus-text-muted)]">
                {data?.isAdmin
                  ? "Review public Request records, moderation status, and open reports."
                  : "Create public Requests, review attributable responses, select one, and continue through private Loombus messages."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/requests" className={secondary}>Browse Requests <ArrowUpRight size={15} /></Link>
              <button type="button" onClick={() => void load()} className={secondary}><RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh</button>
              {!data?.isAdmin ? <button type="button" onClick={beginCreate} className={primary}><Plus size={16} /> New Request</button> : null}
            </div>
          </div>
        </header>

        <section className="grid border-b border-[color:var(--loombus-border)] sm:grid-cols-2 lg:grid-cols-4" aria-label="Request signals">
          {signals.map(([label, value]) => (
            <div key={String(label)} className="border-b border-[color:var(--loombus-border-muted)] py-4 sm:border-b-0 sm:border-r sm:px-4 first:pl-0 last:border-r-0">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--loombus-text-muted)]">{label}</span>
              <strong className="mt-1 block text-2xl tracking-[-0.04em]">{value}</strong>
            </div>
          ))}
        </section>

        {notice ? <div className="border-b border-[color:var(--loombus-border)] py-4 text-sm" role="status">{notice}</div> : null}

        <nav className="flex gap-6 overflow-x-auto border-b border-[color:var(--loombus-border)]" aria-label="Request management workspace">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setView(tab.key)}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-0 py-4 text-sm font-semibold transition ${
                view === tab.key
                  ? "border-[color:var(--loombus-gold)] text-[color:var(--loombus-gold)]"
                  : "border-transparent text-[color:var(--loombus-text-muted)] hover:text-[color:var(--loombus-text)]"
              }`}
            >
              {tab.label}
              {tab.count > 0 ? <span className="text-xs">{tab.count}</span> : null}
            </button>
          ))}
        </nav>

        <section className="py-7">
          {view === "requests" ? (
            <section>
              <div className="flex flex-col gap-3 border-b border-[color:var(--loombus-border)] pb-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Request records</p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">{data?.isAdmin ? "Platform Requests" : "Your Requests"}</h2>
                </div>
                {!data?.isAdmin ? <button type="button" onClick={beginCreate} className={primary}><Plus size={15} /> Create Request</button> : null}
              </div>

              <div className="divide-y divide-[color:var(--loombus-border-muted)]">
                {(data?.requests ?? []).map((item) => (
                  <article key={item.id} className="py-6">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 max-w-4xl">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                          <Status value={item.status} />
                          <span className="font-semibold text-[color:var(--loombus-gold)]">{requestTypeLabel(item.requestType)}</span>
                          <span className="font-semibold text-[color:var(--loombus-text-muted)]">{requestUrgencyLabel(item.urgency)}</span>
                        </div>
                        <h3 className="mt-3 text-xl font-semibold tracking-[-0.025em]">{item.title}</h3>
                        <p className="mt-2 text-sm text-[color:var(--loombus-text-muted)]">{requestLocationLabel(item)} · {formatRequestBudget(item)}</p>
                        <p className="mt-3 line-clamp-3 text-sm leading-6 text-[color:var(--loombus-text-muted)]">{item.description}</p>
                        {item.deadline ? <p className="mt-3 text-xs text-[color:var(--loombus-text-subtle)]">Deadline {formatRequestDate(item.deadline)}</p> : null}
                        {item.moderationReason ? <p className="mt-4 border-l-2 border-[color:var(--loombus-gold)] pl-4 text-sm">Review note: {item.moderationReason}</p> : null}
                        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[color:var(--loombus-text-muted)]">
                          <span>{item.responseCount} response{item.responseCount === 1 ? "" : "s"}</span>
                          <span>{item.savedCount} save{item.savedCount === 1 ? "" : "s"}</span>
                          {(responsesByRequest.get(item.id)?.length ?? 0) > 0 && !data?.isAdmin ? (
                            <button type="button" onClick={() => setView("responses")} className="font-semibold text-[color:var(--loombus-gold)]">Review response records</button>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2 lg:max-w-[19rem] lg:justify-end">
                        {item.status === "open" ? <Link href={`/requests/${item.slug}`} className={secondary}>Open</Link> : null}
                        {!data?.isAdmin && !["in_progress", "resolved", "closed", "removed"].includes(item.status) ? <button type="button" onClick={() => beginEdit(item)} className={secondary}>Edit</button> : null}
                        {!data?.isAdmin && item.status === "open" ? <button type="button" onClick={() => void send({ action: "reviewing", requestId: item.id }, `reviewing:${item.id}`, "Request moved to review.")} className={secondary}>Review responses</button> : null}
                        {!data?.isAdmin && ["reviewing", "in_progress"].includes(item.status) ? <button type="button" onClick={() => void send({ action: "resolved", requestId: item.id }, `resolved:${item.id}`, "Request resolved.")} className={secondary}>Resolve</button> : null}
                        {data?.isAdmin && item.status === "pending" ? (
                          <>
                            <button type="button" onClick={() => void send({ action: "moderate", requestId: item.id, decision: "approve" }, `approve:${item.id}`, "Request approved.")} className={primary}><CheckCircle2 size={14} /> Approve</button>
                            <button type="button" onClick={() => { const note = window.prompt("Change request note", ""); if (note !== null) void send({ action: "moderate", requestId: item.id, decision: "reject", note }, `reject:${item.id}`, "Changes requested."); }} className={secondary}><XCircle size={14} /> Changes</button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </article>
                ))}
                {(data?.requests.length ?? 0) === 0 ? <div className="py-12 text-sm text-[color:var(--loombus-text-muted)]">No Request records yet.</div> : null}
              </div>
            </section>
          ) : null}

          {view === "editor" && !data?.isAdmin ? (
            <form onSubmit={submit} className="max-w-4xl">
              <div className="border-b border-[color:var(--loombus-border)] pb-5">
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">{draft.requestId ? "Edit Request" : "New Request"}</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">{draft.requestId ? "Update and resubmit" : "Describe the need clearly"}</h2>
                <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">State the desired outcome, location, urgency, deadline, and attribution so responders can determine whether they are a real fit.</p>
                {draft.requestId ? <button type="button" onClick={() => setDraft(EMPTY)} className={`${secondary} mt-4`}>Clear edit</button> : null}
              </div>

              <div className="grid gap-x-8 gap-y-6 py-6 sm:grid-cols-2">
                <Field label="Title" wide><input required minLength={5} maxLength={200} value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} className={inputClass} /></Field>
                <Field label="Describe the need" wide><textarea required minLength={30} maxLength={16000} rows={7} value={draft.description} onChange={(event) => updateDraft("description", event.target.value)} className={inputClass} /></Field>
                <Field label="Type"><select value={draft.requestType} onChange={(event) => updateDraft("requestType", event.target.value)} className={inputClass}>{SERVICE_REQUEST_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>
                <Field label="Category"><select value={draft.category} onChange={(event) => updateDraft("category", event.target.value)} className={inputClass}>{SERVICE_REQUEST_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></Field>
                <Field label="Urgency"><select value={draft.urgency} onChange={(event) => updateDraft("urgency", event.target.value)} className={inputClass}><option value="normal">Normal</option><option value="soon">Needed soon</option><option value="urgent">Urgent</option></select></Field>
                <Field label="Location mode"><select value={draft.serviceMode} onChange={(event) => updateDraft("serviceMode", event.target.value)} className={inputClass}><option value="flexible">Flexible</option><option value="remote">Remote</option><option value="requester_location">Requester location</option><option value="provider_location">Provider location</option></select></Field>
                {draft.serviceMode !== "remote" ? <><Field label="City"><input value={draft.city} onChange={(event) => updateDraft("city", event.target.value)} className={inputClass} /></Field><Field label="State or region"><input value={draft.region} onChange={(event) => updateDraft("region", event.target.value)} className={inputClass} /></Field></> : null}
                <Field label="Deadline"><input type="datetime-local" value={draft.deadline} onChange={(event) => updateDraft("deadline", event.target.value)} className={inputClass} /></Field>
                <Field label="Business attribution"><select value={draft.businessId} onChange={(event) => updateDraft("businessId", event.target.value)} className={inputClass}><option value="">Personal profile</option>{(data?.businesses ?? []).map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}</select></Field>
              </div>
              <button type="submit" disabled={working === "save"} className={`${primary} px-5 py-3`}>{working === "save" ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}{draft.requestId ? "Update and resubmit" : "Create Request"}</button>
            </form>
          ) : null}

          {view === "responses" && !data?.isAdmin ? (
            <section className="divide-y divide-[color:var(--loombus-border)]">
              <ResponseList
                title="Responses received"
                responses={data?.receivedResponses ?? []}
                actions={(response) => {
                  const request = data?.requests.find((item) => item.id === response.requestId);
                  return response.status === "submitted" && request && !request.selectedResponseId ? (
                    <button type="button" onClick={() => void send({ action: "select_response", requestId: response.requestId, responseId: response.id }, `select:${response.id}`, "Response selected.")} className={primary}><Send size={14} /> Select and message</button>
                  ) : response.conversationId ? (
                    <Link href={`/messages?conversation=${encodeURIComponent(response.conversationId)}`} className={secondary}><MessageCircle size={14} /> Open message</Link>
                  ) : null;
                }}
              />
              <ResponseList
                title="Responses you sent"
                responses={data?.sentResponses ?? []}
                actions={(response) => response.status === "submitted" ? <button type="button" onClick={() => void send({ action: "withdraw_response", responseId: response.id }, `withdraw:${response.id}`, "Response withdrawn.")} className={secondary}>Withdraw response</button> : response.conversationId ? <Link href={`/messages?conversation=${encodeURIComponent(response.conversationId)}`} className={secondary}>Open message</Link> : null}
              />
            </section>
          ) : null}

          {view === "reports" && data?.isAdmin ? (
            <section>
              <div className="border-b border-[color:var(--loombus-border)] pb-5">
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Moderation</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">Open Request reports</h2>
              </div>
              <div className="divide-y divide-[color:var(--loombus-border-muted)]">
                {data.reports.map((report) => (
                  <article key={report.id} className="py-6">
                    <strong className="text-lg">{report.requestTitle}</strong>
                    <p className="mt-2 text-sm font-semibold">{report.reason}</p>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">{report.details}</p>
                    <p className="mt-2 text-xs text-[color:var(--loombus-text-subtle)]">Reported {formatRequestDate(report.createdAt)}</p>
                    <div className="mt-4 flex gap-2">
                      <button type="button" onClick={() => void send({ action: "review_report", reportId: report.id, decision: "resolve" }, `resolve-report:${report.id}`, "Report resolved.")} className={secondary}>Resolve</button>
                      <button type="button" onClick={() => void send({ action: "review_report", reportId: report.id, decision: "dismiss" }, `dismiss-report:${report.id}`, "Report dismissed.")} className={secondary}>Dismiss</button>
                    </div>
                  </article>
                ))}
                {data.reports.length === 0 ? <div className="py-12 text-sm text-[color:var(--loombus-text-muted)]">No open Request reports.</div> : null}
              </div>
            </section>
          ) : null}
        </section>

        <footer className="grid gap-8 border-t border-[color:var(--loombus-border)] py-7 md:grid-cols-2">
          <section>
            <div className="flex items-center gap-2">
              {data?.isAdmin ? <ShieldCheck className="h-4 w-4 text-[color:var(--loombus-gold)]" /> : <FileText className="h-4 w-4 text-[color:var(--loombus-gold)]" />}
              <h3 className="font-semibold">{data?.isAdmin ? "Moderation remains explicit" : "Clear needs receive better responses"}</h3>
            </div>
            <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
              {data?.isAdmin ? "Approval, requested changes, lifecycle status, response selection, and report resolution remain separate actions." : "State the desired outcome, location, deadline, and material constraints before selecting a responder."}
            </p>
          </section>
          <section>
            {!data?.isAdmin ? (
              <div className="mb-3 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
                <Link href="/requests/saved" className="hover:text-[color:var(--loombus-gold)]">Saved Requests</Link>
                <Link href="/services/manage" className="hover:text-[color:var(--loombus-gold)]">Manage Services</Link>
              </div>
            ) : null}
            <p className="text-sm leading-6 text-[color:var(--loombus-text-muted)]">Loombus does not process payments or guarantee licensing, credentials, pricing, safety, or outcomes. Confirm material details directly.</p>
          </section>
        </footer>
      </div>
    </main>
  );
}

function ResponseList({
  title,
  responses,
  actions,
}: {
  title: string;
  responses: ServiceRequestResponse[];
  actions: (response: ServiceRequestResponse) => React.ReactNode;
}) {
  return (
    <section className="py-6 first:pt-0 last:pb-0">
      <div className="border-b border-[color:var(--loombus-border)] pb-4">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Response records</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">{title}</h2>
      </div>
      <div className="divide-y divide-[color:var(--loombus-border-muted)]">
        {responses.map((response) => (
          <article key={response.id} className="py-5">
            <Status value={response.status} />
            <Link href={response.requestSlug ? `/requests/${response.requestSlug}` : "/requests"} className="mt-2 block text-lg font-semibold hover:underline">{response.requestTitle}</Link>
            <p className="mt-1 text-sm text-[color:var(--loombus-text-muted)]">{response.businessName || response.responderName} · {formatRequestDate(response.createdAt)}</p>
            <p className="mt-3 max-w-4xl text-sm leading-6">{response.message}</p>
            {response.availabilityText ? <p className="mt-2 text-sm text-[color:var(--loombus-text-muted)]">Availability: {response.availabilityText}</p> : null}
            <div className="mt-4 flex flex-wrap gap-2">{actions(response)}</div>
          </article>
        ))}
        {responses.length === 0 ? <div className="py-10 text-sm text-[color:var(--loombus-text-muted)]">No response records.</div> : null}
      </div>
    </section>
  );
}
