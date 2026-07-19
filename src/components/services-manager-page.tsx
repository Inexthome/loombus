"use client";

import Link from "next/link";
import {
  Archive,
  ArrowUpRight,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  FileUp,
  Inbox,
  Loader2,
  MessageCircle,
  PauseCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wrench,
  XCircle,
} from "lucide-react";
import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  PROVIDER_SERVICE_CATEGORIES,
  formatProviderServiceDate,
  formatProviderServicePrice,
  type ProviderServiceInquiry,
  type ProviderServicesManageResponse,
  type PublicProviderService,
} from "@/lib/provider-services";
import { providerServicesAuthorizedFetch } from "@/lib/provider-services-client";

type Attachment = { path: string; url: string; type: string; name: string };
type ResponseDraft = {
  providerServiceId: string;
  message: string;
  availabilityText: string;
  estimateMin: string;
  estimateMax: string;
  currency: string;
};
type Draft = {
  serviceId: string;
  title: string;
  description: string;
  category: string;
  specialties: string;
  serviceMode: "remote" | "requester_location" | "provider_location" | "flexible";
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
  priceType: "fixed" | "range" | "hourly" | "contact";
  priceMin: string;
  priceMax: string;
  currency: string;
  typicalDurationMinutes: string;
  responseExpectation: string;
  availabilityText: string;
  businessId: string;
  appointmentServiceId: string;
  attachments: Attachment[];
};

type WorkspaceView = "services" | "editor" | "inquiries" | "requests" | "reports";

const EMPTY: Draft = {
  serviceId: "",
  title: "",
  description: "",
  category: "Home and property",
  specialties: "",
  serviceMode: "flexible",
  city: "",
  region: "",
  postalCode: "",
  countryCode: "US",
  priceType: "contact",
  priceMin: "",
  priceMax: "",
  currency: "USD",
  typicalDurationMinutes: "",
  responseExpectation: "",
  availabilityText: "",
  businessId: "",
  appointmentServiceId: "",
  attachments: [],
};

function editDraft(service: PublicProviderService): Draft {
  return {
    serviceId: service.id,
    title: service.title,
    description: service.description,
    category: service.category,
    specialties: service.specialties.join(", "),
    serviceMode: service.serviceMode,
    city: service.city ?? "",
    region: service.region ?? "",
    postalCode: service.postalCode ?? "",
    countryCode: service.countryCode,
    priceType: service.priceType,
    priceMin: service.priceMin === null ? "" : String(service.priceMin),
    priceMax: service.priceMax === null ? "" : String(service.priceMax),
    currency: service.currency,
    typicalDurationMinutes:
      service.typicalDurationMinutes === null ? "" : String(service.typicalDurationMinutes),
    responseExpectation: service.responseExpectation ?? "",
    availabilityText: service.availabilityText ?? "",
    businessId: service.businessId ?? "",
    appointmentServiceId: service.appointmentServiceId ?? "",
    attachments: service.attachmentUrls.map((url, index) => ({
      url,
      path: service.attachmentPaths[index] ?? "",
      type: service.attachmentTypes[index] ?? "",
      name: service.attachmentNames[index] ?? `Attachment ${index + 1}`,
    })),
  };
}

function Status({ value }: { value: string }) {
  return (
    <span className="rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface-muted)] px-3 py-1 text-xs font-semibold capitalize text-[color:var(--loombus-text-muted)]">
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
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={wide ? "sm:col-span-2" : ""}>
      <span className="mb-2 block text-sm font-semibold">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] px-4 py-3 text-[color:var(--loombus-text)] outline-none transition placeholder:text-[color:var(--loombus-text-subtle)] focus:border-[color:var(--loombus-gold)] focus:ring-4 focus:ring-[color:var(--loombus-gold-soft)]";
const secondary =
  "inline-flex items-center justify-center gap-2 rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-4 py-2 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] disabled:opacity-50";
const primary =
  "inline-flex items-center justify-center gap-2 rounded-full bg-[color:var(--loombus-gold)] px-4 py-2 text-sm font-semibold text-[color:var(--loombus-gold-contrast)] transition hover:opacity-90 disabled:opacity-50";

export default function ServicesManagerPage() {
  const [data, setData] = useState<ProviderServicesManageResponse | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [responses, setResponses] = useState<Record<string, ResponseDraft>>({});
  const [view, setView] = useState<WorkspaceView>("services");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setNotice("");
    try {
      const response = await providerServicesAuthorizedFetch(
        "/api/services?manage=1",
        { cache: "no-store" },
        "/services/manage",
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Unable to load Services.");
      setData(payload as ProviderServicesManageResponse);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load Services.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const appointments = useMemo(
    () =>
      (data?.appointmentServices ?? []).filter(
        (service) => service.businessId === draft.businessId,
      ),
    [data?.appointmentServices, draft.businessId],
  );

  const publishedServices = useMemo(
    () => (data?.services ?? []).filter((service) => service.status === "published"),
    [data?.services],
  );

  const openInquiryCount = useMemo(
    () =>
      [...(data?.receivedInquiries ?? []), ...(data?.sentInquiries ?? [])].filter(
        (inquiry) => inquiry.status === "submitted" || inquiry.status === "accepted",
      ).length,
    [data?.receivedInquiries, data?.sentInquiries],
  );

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function send(body: Record<string, unknown>, key: string, success: string) {
    if (working) return;
    setWorking(key);
    setNotice("");
    try {
      const response = await providerServicesAuthorizedFetch(
        "/api/services",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        "/services/manage",
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Unable to update Services.");
      if (payload.conversationId) {
        window.location.href = `/messages?conversation=${encodeURIComponent(payload.conversationId)}`;
        return;
      }
      setNotice(success);
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to update Services.");
    } finally {
      setWorking("");
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await send(
      {
        action: draft.serviceId ? "update" : "create",
        serviceId: draft.serviceId,
        title: draft.title,
        description: draft.description,
        category: draft.category,
        specialties: draft.specialties
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        serviceMode: draft.serviceMode,
        city: draft.city,
        region: draft.region,
        postalCode: draft.postalCode,
        countryCode: draft.countryCode,
        priceType: draft.priceType,
        priceMin: draft.priceMin,
        priceMax: draft.priceMax,
        currency: draft.currency,
        typicalDurationMinutes: draft.typicalDurationMinutes,
        responseExpectation: draft.responseExpectation,
        availabilityText: draft.availabilityText,
        businessId: draft.businessId,
        appointmentServiceId: draft.appointmentServiceId,
        attachmentPaths: draft.attachments.map((item) => item.path),
        attachmentUrls: draft.attachments.map((item) => item.url),
        attachmentTypes: draft.attachments.map((item) => item.type),
        attachmentNames: draft.attachments.map((item) => item.name),
      },
      "save",
      "Service saved and sent to administrator review.",
    );
    setDraft(EMPTY);
    setView("services");
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || working || draft.attachments.length >= 8) return;
    setWorking("upload");
    setNotice("");
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await providerServicesAuthorizedFetch(
        "/api/services/attachments",
        { method: "POST", body: form },
        "/services/manage",
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Unable to upload attachment.");
      setDraft((current) => ({
        ...current,
        attachments: [...current.attachments, payload.attachment as Attachment].slice(0, 8),
      }));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to upload attachment.");
    } finally {
      setWorking("");
    }
  }

  async function removeAttachment(index: number) {
    const attachment = draft.attachments[index];
    if (!attachment || working) return;
    setDraft((current) => ({
      ...current,
      attachments: current.attachments.filter((_, itemIndex) => itemIndex !== index),
    }));
    if (draft.serviceId) return;
    try {
      await providerServicesAuthorizedFetch(
        "/api/services/attachments",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: attachment.path }),
        },
        "/services/manage",
      );
    } catch {
      // Draft cleanup must not block editing.
    }
  }

  function requestResponse(requestId: string, category: string) {
    return (
      responses[requestId] ?? {
        providerServiceId:
          (data?.services ?? []).find(
            (service) => service.status === "published" && service.category === category,
          )?.id ?? "",
        message: "",
        availabilityText: "",
        estimateMin: "",
        estimateMax: "",
        currency: "USD",
      }
    );
  }

  function updateResponse(
    requestId: string,
    category: string,
    patch: Partial<ResponseDraft>,
  ) {
    setResponses((current) => ({
      ...current,
      [requestId]: { ...requestResponse(requestId, category), ...patch },
    }));
  }

  async function respondToRequest(requestId: string, category: string) {
    const responseDraft = requestResponse(requestId, category);
    if (!responseDraft.providerServiceId) {
      setNotice("Publish a matching Service before responding to this Request.");
      return;
    }
    if (working) return;
    setWorking(`request:${requestId}`);
    setNotice("");
    try {
      const response = await providerServicesAuthorizedFetch(
        "/api/requests",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "respond",
            requestId,
            ...responseDraft,
          }),
        },
        "/services/manage",
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Unable to respond to Request.");
      setResponses((current) => {
        const next = { ...current };
        delete next[requestId];
        return next;
      });
      setNotice("Response sent with your published Service.");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to respond to Request.");
    } finally {
      setWorking("");
    }
  }

  function beginCreate() {
    setDraft(EMPTY);
    setView("editor");
  }

  function beginEdit(service: PublicProviderService) {
    setDraft(editDraft(service));
    setView("editor");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (loading && !data) {
    return (
      <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[82rem] rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-10 text-center text-[color:var(--loombus-text-muted)] shadow-xl shadow-black/10">
          <Loader2 className="mx-auto animate-spin text-[color:var(--loombus-gold)]" size={28} />
          <p className="mt-3">Loading Services…</p>
        </div>
      </main>
    );
  }

  const tabs: Array<{ key: WorkspaceView; label: string; count: number }> = data?.isAdmin
    ? [
        { key: "services", label: "Service records", count: data.services.length },
        { key: "reports", label: "Open reports", count: data.reports.length },
      ]
    : [
        { key: "services", label: "My Services", count: data?.services.length ?? 0 },
        { key: "editor", label: draft.serviceId ? "Edit Service" : "Create Service", count: 0 },
        {
          key: "inquiries",
          label: "Inquiries",
          count: (data?.receivedInquiries.length ?? 0) + (data?.sentInquiries.length ?? 0),
        },
        { key: "requests", label: "Relevant Requests", count: data?.matchingRequests.length ?? 0 },
      ];

  return (
    <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[82rem]">
        <header className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">
              {data?.isAdmin ? "Service operations" : "Manage Services"}
            </h1>
            <p className="mt-3 text-base leading-7 text-[color:var(--loombus-text-muted)]">
              {data?.isAdmin
                ? "Review Service records, moderation status, and open reports from one operational workspace."
                : "Publish what you provide, manage availability and attachments, review inquiries, and respond to relevant Requests."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/services" className={secondary}>
              Browse Services <ArrowUpRight size={15} />
            </Link>
            <button type="button" onClick={() => void load()} className={secondary}>
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
            {!data?.isAdmin ? (
              <button type="button" onClick={beginCreate} className={primary}>
                <Plus size={16} /> New Service
              </button>
            ) : null}
          </div>
        </header>

        <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-[1.4rem] border border-[color:var(--loombus-gold)] bg-[color:var(--loombus-cream)] p-4 text-[color:var(--loombus-cream-contrast)] shadow-sm dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-text)]">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-gold)]">Published</span>
            <strong className="mt-2 block text-3xl tracking-[-0.04em]">{data?.metrics.published ?? 0}</strong>
          </article>
          <article className="rounded-[1.4rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">Pending review</span>
            <strong className="mt-2 block text-3xl tracking-[-0.04em]">{data?.metrics.pending ?? 0}</strong>
          </article>
          <article className="rounded-[1.4rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">Open inquiries</span>
            <strong className="mt-2 block text-3xl tracking-[-0.04em]">{openInquiryCount}</strong>
          </article>
          <article className="rounded-[1.4rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">
              {data?.isAdmin ? "Open reports" : "Relevant Requests"}
            </span>
            <strong className="mt-2 block text-3xl tracking-[-0.04em]">
              {data?.isAdmin ? data.metrics.openReports : data?.matchingRequests.length ?? 0}
            </strong>
          </article>
        </section>

        {notice ? (
          <div className="mb-6 rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 text-sm shadow-sm" role="status">
            {notice}
          </div>
        ) : null}

        <nav className="mb-6 flex gap-2 overflow-x-auto rounded-[1.5rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-2 shadow-sm" aria-label="Service management workspace">
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
              {tab.count > 0 ? (
                <span className="rounded-full bg-[color:var(--loombus-page-bg)] px-2 py-0.5 text-xs">{tab.count}</span>
              ) : null}
            </button>
          ))}
        </nav>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="min-w-0">
            {view === "services" ? (
              <section className="overflow-hidden rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] shadow-xl shadow-black/10">
                <div className="flex flex-col gap-4 border-b border-[color:var(--loombus-border-muted)] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Service records</p>
                    <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">
                      {data?.isAdmin ? "Platform Services" : "Your Services"}
                    </h2>
                  </div>
                  {!data?.isAdmin ? <button type="button" onClick={beginCreate} className={primary}><Plus size={15} /> Create Service</button> : null}
                </div>

                <div className="divide-y divide-[color:var(--loombus-border-muted)]">
                  {(data?.services ?? []).map((service) => (
                    <article key={service.id} className="p-5 sm:p-6">
                      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Status value={service.status} />
                            {service.businessName ? (
                              <span className="rounded-full bg-[color:var(--loombus-cream)] px-3 py-1 text-xs font-semibold text-[color:var(--loombus-cream-contrast)] dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-gold)]">
                                {service.businessName}
                              </span>
                            ) : null}
                          </div>
                          <h3 className="mt-3 text-xl font-semibold tracking-[-0.025em]">{service.title}</h3>
                          <p className="mt-2 text-sm text-[color:var(--loombus-text-muted)]">
                            {service.category} · {formatProviderServicePrice(service)}
                          </p>
                          <p className="mt-3 line-clamp-3 text-sm leading-6 text-[color:var(--loombus-text-muted)]">{service.description}</p>
                          {service.moderationReason ? (
                            <p className="mt-3 rounded-2xl bg-[color:var(--loombus-page-bg)] p-4 text-sm">Review note: {service.moderationReason}</p>
                          ) : null}
                        </div>

                        <div className="flex shrink-0 flex-wrap gap-2 lg:max-w-[19rem] lg:justify-end">
                          {service.status === "published" ? <Link href={`/services/${service.slug}`} className={secondary}>Open</Link> : null}
                          {!data?.isAdmin && !["archived", "removed"].includes(service.status) ? (
                            <button type="button" onClick={() => beginEdit(service)} className={secondary}>Edit</button>
                          ) : null}
                          {!data?.isAdmin && service.status === "published" ? (
                            <button type="button" onClick={() => void send({ action: "pause", serviceId: service.id }, `pause:${service.id}`, "Service paused.")} className={secondary}>
                              <PauseCircle size={14} /> Pause
                            </button>
                          ) : null}
                          {!data?.isAdmin && service.status === "paused" ? (
                            <button type="button" onClick={() => void send({ action: "activate", serviceId: service.id }, `activate:${service.id}`, "Service returned to review.")} className={secondary}>
                              <RotateCcw size={14} /> Activate
                            </button>
                          ) : null}
                          {!data?.isAdmin && !["archived", "removed"].includes(service.status) ? (
                            <button type="button" onClick={() => void send({ action: "archive", serviceId: service.id }, `archive:${service.id}`, "Service archived.")} className={secondary}>
                              <Archive size={14} /> Archive
                            </button>
                          ) : null}
                          {data?.isAdmin && service.status === "pending" ? (
                            <>
                              <button type="button" onClick={() => void send({ action: "moderate", serviceId: service.id, decision: "approve" }, `approve:${service.id}`, "Service approved.")} className={primary}>
                                <CheckCircle2 size={14} /> Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const note = window.prompt("Change request note", "");
                                  if (note !== null) void send({ action: "moderate", serviceId: service.id, decision: "reject", note }, `reject:${service.id}`, "Changes requested.");
                                }}
                                className={secondary}
                              >
                                <XCircle size={14} /> Changes
                              </button>
                            </>
                          ) : null}
                          {data?.isAdmin && service.status !== "removed" ? (
                            <button type="button" onClick={() => void send({ action: "moderate", serviceId: service.id, decision: "remove" }, `remove:${service.id}`, "Service removed.")} className={secondary}>Remove</button>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  ))}
                  {(data?.services.length ?? 0) === 0 ? (
                    <div className="p-10 text-center text-sm text-[color:var(--loombus-text-muted)]">No Service records yet.</div>
                  ) : null}
                </div>
              </section>
            ) : null}

            {view === "editor" && !data?.isAdmin ? (
              <form onSubmit={save} className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-xl shadow-black/10 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">{draft.serviceId ? "Edit Service" : "New Service"}</p>
                    <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">{draft.serviceId ? "Update and resubmit" : "Describe what you can provide"}</h2>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">Use clear scope, location, pricing, availability, and attribution so members can evaluate the Service before contacting you.</p>
                  </div>
                  {draft.serviceId ? <button type="button" onClick={() => setDraft(EMPTY)} className={secondary}>Clear edit</button> : null}
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <Field label="Service title" wide><input required minLength={5} maxLength={200} value={draft.title} onChange={(event) => update("title", event.target.value)} className={inputClass} /></Field>
                  <Field label="Description" wide><textarea required minLength={30} maxLength={16000} rows={6} value={draft.description} onChange={(event) => update("description", event.target.value)} className={inputClass} /></Field>
                  <Field label="Category"><select value={draft.category} onChange={(event) => update("category", event.target.value)} className={inputClass}>{PROVIDER_SERVICE_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></Field>
                  <Field label="Specialties"><input value={draft.specialties} onChange={(event) => update("specialties", event.target.value)} placeholder="Comma-separated" className={inputClass} /></Field>
                  <Field label="Location mode"><select value={draft.serviceMode} onChange={(event) => update("serviceMode", event.target.value as Draft["serviceMode"])} className={inputClass}><option value="flexible">Flexible</option><option value="remote">Remote</option><option value="requester_location">Customer location</option><option value="provider_location">Provider location</option></select></Field>
                  <Field label="Business attribution"><select value={draft.businessId} onChange={(event) => { update("businessId", event.target.value); update("appointmentServiceId", ""); }} className={inputClass}><option value="">Personal profile</option>{(data?.businesses ?? []).map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}</select></Field>
                  {draft.serviceMode !== "remote" ? <><Field label="City"><input value={draft.city} onChange={(event) => update("city", event.target.value)} className={inputClass} /></Field><Field label="State or region"><input value={draft.region} onChange={(event) => update("region", event.target.value)} className={inputClass} /></Field></> : null}
                  <Field label="Price type"><select value={draft.priceType} onChange={(event) => update("priceType", event.target.value as Draft["priceType"])} className={inputClass}><option value="contact">Contact for pricing</option><option value="fixed">Fixed</option><option value="range">Range</option><option value="hourly">Hourly</option></select></Field>
                  <Field label="Currency"><input maxLength={3} value={draft.currency} onChange={(event) => update("currency", event.target.value.toUpperCase())} className={inputClass} /></Field>
                  {draft.priceType !== "contact" ? <><Field label="Price minimum"><input type="number" min={0} step="0.01" value={draft.priceMin} onChange={(event) => update("priceMin", event.target.value)} className={inputClass} /></Field><Field label="Price maximum"><input type="number" min={0} step="0.01" value={draft.priceMax} onChange={(event) => update("priceMax", event.target.value)} className={inputClass} /></Field></> : null}
                  <Field label="Typical duration in minutes"><input type="number" min={15} max={10080} value={draft.typicalDurationMinutes} onChange={(event) => update("typicalDurationMinutes", event.target.value)} className={inputClass} /></Field>
                  <Field label="Appointment service"><select disabled={!draft.businessId} value={draft.appointmentServiceId} onChange={(event) => update("appointmentServiceId", event.target.value)} className={`${inputClass} disabled:opacity-50`}><option value="">No appointment connection</option>{appointments.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></Field>
                  <Field label="Response expectation"><input maxLength={300} value={draft.responseExpectation} onChange={(event) => update("responseExpectation", event.target.value)} placeholder="Example: Usually within one business day" className={inputClass} /></Field>
                  <Field label="Availability"><input maxLength={1000} value={draft.availabilityText} onChange={(event) => update("availabilityText", event.target.value)} className={inputClass} /></Field>
                  <Field label="Examples and documents" wide>
                    <label className={`${secondary} inline-flex cursor-pointer`}><FileUp size={16} /> Upload JPEG, PNG, WebP, or PDF<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => void upload(event)} className="sr-only" /></label>
                    <div className="mt-3 grid gap-2">
                      {draft.attachments.map((attachment, index) => (
                        <div key={`${attachment.path}:${index}`} className="flex items-center justify-between rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] p-3 text-sm">
                          <a href={attachment.url} target="_blank" rel="noreferrer" className="truncate underline">{attachment.name}</a>
                          <button type="button" onClick={() => void removeAttachment(index)} aria-label={`Remove ${attachment.name}`}><Trash2 size={16} /></button>
                        </div>
                      ))}
                    </div>
                  </Field>
                </div>
                <button type="submit" disabled={working === "save"} className={`${primary} mt-5 px-5 py-3`}>
                  {working === "save" ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                  {draft.serviceId ? "Update and resubmit" : "Create Service"}
                </button>
              </form>
            ) : null}

            {view === "inquiries" && !data?.isAdmin ? (
              <section className="grid gap-6 2xl:grid-cols-2">
                <InquiryList
                  title="Inquiries received"
                  inquiries={data?.receivedInquiries ?? []}
                  actions={(inquiry) =>
                    inquiry.status === "submitted" ? (
                      <>
                        <button type="button" onClick={() => void send({ action: "provider_inquiry_action", inquiryId: inquiry.id, decision: "accept" }, `accept:${inquiry.id}`, "Inquiry accepted.")} className={primary}>Accept and message</button>
                        <button type="button" onClick={() => void send({ action: "provider_inquiry_action", inquiryId: inquiry.id, decision: "decline" }, `decline:${inquiry.id}`, "Inquiry declined.")} className={secondary}>Decline</button>
                      </>
                    ) : inquiry.status === "accepted" ? (
                      <>
                        <Link href={`/messages?conversation=${encodeURIComponent(inquiry.conversationId ?? "")}`} className={secondary}><MessageCircle size={14} /> Open message</Link>
                        <button type="button" onClick={() => void send({ action: "provider_close_inquiry", inquiryId: inquiry.id }, `close:${inquiry.id}`, "Inquiry closed.")} className={secondary}>Close</button>
                      </>
                    ) : null
                  }
                />
                <InquiryList
                  title="Inquiries you sent"
                  inquiries={data?.sentInquiries ?? []}
                  actions={(inquiry) =>
                    ["submitted", "accepted"].includes(inquiry.status) ? (
                      <>
                        <button type="button" onClick={() => void send({ action: "requester_inquiry_action", inquiryId: inquiry.id, inquiryAction: inquiry.status === "accepted" ? "close" : "cancel" }, `requester:${inquiry.id}`, inquiry.status === "accepted" ? "Inquiry closed." : "Inquiry cancelled.")} className={secondary}>{inquiry.status === "accepted" ? "Close" : "Cancel"}</button>
                        {inquiry.conversationId ? <Link href={`/messages?conversation=${encodeURIComponent(inquiry.conversationId)}`} className={secondary}>Open message</Link> : null}
                      </>
                    ) : null
                  }
                />
              </section>
            ) : null}

            {view === "requests" && !data?.isAdmin ? (
              <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] shadow-xl shadow-black/10">
                <div className="border-b border-[color:var(--loombus-border-muted)] px-5 py-5 sm:px-6">
                  <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Matching opportunities</p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">Relevant open Requests</h2>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">Respond using one of your published Services. The requester remains in control of the Request.</p>
                </div>
                <div className="divide-y divide-[color:var(--loombus-border-muted)]">
                  {(data?.matchingRequests ?? []).map((request) => {
                    const responseDraft = requestResponse(request.id, request.category);
                    const options = publishedServices.filter((service) => service.category === request.category);
                    return (
                      <article key={request.id} className="p-5 sm:p-6">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[color:var(--loombus-text-muted)]">
                          <span className="rounded-full border border-[color:var(--loombus-border)] px-3 py-1">{request.category}</span>
                          <span className="rounded-full bg-[color:var(--loombus-cream)] px-3 py-1 text-[color:var(--loombus-cream-contrast)] dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-gold)]">{request.urgency}</span>
                        </div>
                        <Link href={`/requests/${request.slug}`} className="mt-3 block text-xl font-semibold tracking-[-0.025em] hover:underline">{request.title}</Link>
                        <p className="mt-2 line-clamp-3 text-sm leading-6 text-[color:var(--loombus-text-muted)]">{request.description}</p>
                        <div className="mt-5 grid gap-3 sm:grid-cols-2">
                          <select value={responseDraft.providerServiceId} onChange={(event) => updateResponse(request.id, request.category, { providerServiceId: event.target.value })} className={inputClass}><option value="">Choose matching Service</option>{options.map((service) => <option key={service.id} value={service.id}>{service.title}</option>)}</select>
                          <input value={responseDraft.availabilityText} onChange={(event) => updateResponse(request.id, request.category, { availabilityText: event.target.value })} placeholder="Availability" className={inputClass} />
                          <textarea value={responseDraft.message} onChange={(event) => updateResponse(request.id, request.category, { message: event.target.value })} placeholder="Explain how your Service can help" rows={4} className={`${inputClass} sm:col-span-2`} />
                          <input type="number" min={0} step="0.01" value={responseDraft.estimateMin} onChange={(event) => updateResponse(request.id, request.category, { estimateMin: event.target.value })} placeholder="Estimate minimum" className={inputClass} />
                          <input type="number" min={0} step="0.01" value={responseDraft.estimateMax} onChange={(event) => updateResponse(request.id, request.category, { estimateMax: event.target.value })} placeholder="Estimate maximum" className={inputClass} />
                        </div>
                        <button type="button" onClick={() => void respondToRequest(request.id, request.category)} disabled={working === `request:${request.id}`} className={`${primary} mt-4`}><Send size={14} /> Respond with Service</button>
                      </article>
                    );
                  })}
                  {(data?.matchingRequests.length ?? 0) === 0 ? <div className="p-10 text-center text-sm text-[color:var(--loombus-text-muted)]">No relevant open Requests right now.</div> : null}
                </div>
              </section>
            ) : null}

            {view === "reports" && data?.isAdmin ? (
              <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] shadow-xl shadow-black/10">
                <div className="border-b border-[color:var(--loombus-border-muted)] px-5 py-5 sm:px-6">
                  <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Moderation</p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">Open Service reports</h2>
                </div>
                <div className="divide-y divide-[color:var(--loombus-border-muted)]">
                  {data.reports.map((report) => (
                    <article key={report.id} className="p-5 sm:p-6">
                      <strong className="text-lg">{report.serviceTitle}</strong>
                      <p className="mt-2 text-sm font-semibold">{report.reason}</p>
                      <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">{report.details}</p>
                      <div className="mt-4 flex gap-2">
                        <button type="button" onClick={() => void send({ action: "review_report", reportId: report.id, decision: "resolve" }, `resolve-report:${report.id}`, "Report resolved.")} className={secondary}>Resolve</button>
                        <button type="button" onClick={() => void send({ action: "review_report", reportId: report.id, decision: "dismiss" }, `dismiss-report:${report.id}`, "Report dismissed.")} className={secondary}>Dismiss</button>
                      </div>
                    </article>
                  ))}
                  {data.reports.length === 0 ? <div className="p-10 text-center text-sm text-[color:var(--loombus-text-muted)]">No open Service reports.</div> : null}
                </div>
              </section>
            ) : null}
          </section>

          <aside className="space-y-5 xl:sticky xl:top-28 xl:self-start">
            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-[0.3em]">Workspace status</p>
                <BriefcaseBusiness className="h-5 w-5 text-[color:var(--loombus-gold)]" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {[
                  ["Pending", data?.metrics.pending ?? 0],
                  ["Published", data?.metrics.published ?? 0],
                  ["Paused", data?.metrics.paused ?? 0],
                  ["Accepted", data?.metrics.accepted ?? 0],
                ].map(([label, value]) => (
                  <article key={String(label)} className="rounded-2xl bg-[color:var(--loombus-page-bg)] p-4">
                    <span className="text-xs font-semibold text-[color:var(--loombus-text-muted)]">{label}</span>
                    <strong className="mt-1 block text-2xl">{value}</strong>
                  </article>
                ))}
              </div>
            </section>

            {!data?.isAdmin ? (
              <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
                <p className="text-xs font-bold uppercase tracking-[0.3em]">Service actions</p>
                <div className="mt-4 space-y-2">
                  <button type="button" onClick={beginCreate} className="flex w-full items-center justify-between rounded-2xl bg-[color:var(--loombus-cream)] px-4 py-3 text-left text-sm font-semibold text-[color:var(--loombus-cream-contrast)] transition hover:opacity-90 dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-gold)]">
                    Create Service <Plus className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => setView("inquiries")} className="flex w-full items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-left text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]">
                    Review inquiries <Inbox className="h-4 w-4 text-[color:var(--loombus-gold)]" />
                  </button>
                  <button type="button" onClick={() => setView("requests")} className="flex w-full items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-left text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]">
                    Relevant Requests <ChevronRight className="h-4 w-4 text-[color:var(--loombus-gold)]" />
                  </button>
                  <Link href="/appointments" className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]">
                    Appointments <ArrowUpRight className="h-4 w-4 text-[color:var(--loombus-gold)]" />
                  </Link>
                  <Link href="/businesses/manage" className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]">
                    Business management <ArrowUpRight className="h-4 w-4 text-[color:var(--loombus-gold)]" />
                  </Link>
                </div>
              </section>
            ) : null}

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <div className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--loombus-cream)] text-[color:var(--loombus-gold)] dark:bg-[color:var(--loombus-gold-soft)]">
                  {data?.isAdmin ? <ShieldCheck className="h-5 w-5" /> : <Wrench className="h-5 w-5" />}
                </span>
                <div>
                  <h3 className="font-semibold">{data?.isAdmin ? "Moderation remains explicit" : "Accountable Service records"}</h3>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                    {data?.isAdmin
                      ? "Approval, requested changes, removal, and report resolution remain separate actions with visible status."
                      : "A Service should state scope, location, price expectations, attribution, and availability clearly before a member makes contact."}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <div className="flex gap-3">
                <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--loombus-gold)]" />
                <p className="text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                  Loombus does not process Service payments or guarantee licensing, credentials, pricing, or performance. Members and providers must confirm material details directly.
                </p>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

function InquiryList({
  title,
  inquiries,
  actions,
}: {
  title: string;
  inquiries: ProviderServiceInquiry[];
  actions: (inquiry: ProviderServiceInquiry) => ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] shadow-xl shadow-black/10">
      <div className="border-b border-[color:var(--loombus-border-muted)] px-5 py-5 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Inquiry records</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">{title}</h2>
      </div>
      <div className="divide-y divide-[color:var(--loombus-border-muted)]">
        {inquiries.map((inquiry) => (
          <article key={inquiry.id} className="p-5 sm:p-6">
            <Status value={inquiry.status} />
            <strong className="mt-3 block text-lg">{inquiry.serviceTitle}</strong>
            <p className="mt-1 text-sm text-[color:var(--loombus-text-muted)]">{inquiry.requesterName} · {formatProviderServiceDate(inquiry.createdAt)}</p>
            <p className="mt-3 text-sm leading-6">{inquiry.message}</p>
            {inquiry.linkedRequestTitle ? (
              <Link href={inquiry.linkedRequestSlug ? `/requests/${inquiry.linkedRequestSlug}` : "/requests"} className="mt-3 block text-sm font-semibold text-[color:var(--loombus-gold)] hover:underline">Linked Request: {inquiry.linkedRequestTitle}</Link>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">{actions(inquiry)}</div>
          </article>
        ))}
        {inquiries.length === 0 ? <div className="p-10 text-center text-sm text-[color:var(--loombus-text-muted)]">No inquiry records.</div> : null}
      </div>
    </section>
  );
}
