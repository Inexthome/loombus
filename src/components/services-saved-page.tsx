"use client";

import Link from "next/link";
import { ArrowUpRight, Bookmark, BriefcaseBusiness, CalendarClock, Loader2, MapPin, Search, Sparkles, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatProviderServicePrice, providerServiceLocationLabel, type PublicProviderService } from "@/lib/provider-services";
import { providerServicesAuthorizedFetch } from "@/lib/provider-services-client";
import { SavedControls, SavedEmpty, SavedHeader, SavedLoading, SavedMetrics, SavedRail, type SavedViewOption } from "@/components/saved-directory-ui";

type SavedServiceView = "all" | "available" | "unavailable";
const statusLabel = (status: PublicProviderService["status"]) => status.replaceAll("_", " ");

export default function ServicesSavedPage() {
  const [services, setServices] = useState<PublicProviderService[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<SavedServiceView>("all");

  const load = useCallback(async () => {
    setLoading(true); setNotice("");
    try {
      const response = await providerServicesAuthorizedFetch("/api/services?saved=1", { cache: "no-store" }, "/services/saved");
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Unable to load saved Services.");
      setServices(Array.isArray(payload.services) ? payload.services : []);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load saved Services."); setServices([]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function remove(serviceId: string) {
    if (working) return;
    setWorking(serviceId); setNotice("");
    try {
      const response = await providerServicesAuthorizedFetch("/api/services", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "unsave", serviceId }) }, "/services/saved");
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Unable to remove the saved Service.");
      setServices((current) => current.filter((service) => service.id !== serviceId));
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to remove the saved Service."); }
    finally { setWorking(""); }
  }

  const publishedCount = useMemo(() => services.filter((service) => service.status === "published").length, [services]);
  const appointmentCount = useMemo(() => services.filter((service) => service.appointmentServiceId).length, [services]);
  const filteredServices = useMemo(() => {
    const clean = query.trim().toLowerCase();
    return services.filter((service) => {
      if (view === "available" && service.status !== "published") return false;
      if (view === "unavailable" && service.status === "published") return false;
      if (!clean) return true;
      return [service.title, service.description, service.category, service.providerName, service.businessName, service.city, service.region, service.status, ...service.specialties].filter(Boolean).some((value) => String(value).toLowerCase().includes(clean));
    });
  }, [query, services, view]);
  const options: SavedViewOption<SavedServiceView>[] = [
    { value: "all", label: "All saved", count: services.length },
    { value: "available", label: "Available", count: publishedCount },
    { value: "unavailable", label: "No longer public", count: services.length - publishedCount },
  ];
  const clear = () => { setQuery(""); setView("all"); };

  return <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8"><div className="mx-auto max-w-[86rem]">
    <SavedHeader eyebrow="Private watchlist" title="Saved Services" copy="Compare providers you may return to without exposing your saved state to other members. Services that leave public view remain here until you remove them." browseHref="/services" browseLabel="Browse Services" browseIcon={<BriefcaseBusiness size={16} className="text-[color:var(--loombus-gold)]"/>} loading={loading} refresh={() => void load()}/>
    <SavedMetrics items={[{ label: "Saved Services", value: services.length }, { label: "Available now", value: publishedCount }, { label: "Appointment connected", value: appointmentCount }]}/>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]"><section className="min-w-0">
      <SavedControls query={query} setQuery={setQuery} placeholder="Search saved Service, provider, category, or place" view={view} setView={setView} options={options}/>
      {notice ? <section className="mb-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm" role="alert">{notice}</section> : null}
      {loading ? <SavedLoading label="Loading your private Service watchlist…"/> : services.length === 0 ? <SavedEmpty icon={<Bookmark size={42}/>} title="No saved Services yet." copy="Save a Service from the public directory to compare it here later." action={<Link href="/services" className="inline-flex rounded-full bg-[color:var(--loombus-gold)] px-5 py-3 text-sm font-semibold text-[color:var(--loombus-gold-contrast)]">Browse Services</Link>}/> : filteredServices.length === 0 ? <SavedEmpty icon={<Search size={38}/>} title="No saved Services match this view." copy="Clear the search or return to all saved Services." action={<button type="button" onClick={clear} className="rounded-full border border-[color:var(--loombus-border)] px-5 py-2.5 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)]">Clear search and filters</button>}/> : <section>
        <div className="mb-4"><p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Private shortlist</p><h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">{filteredServices.length} Service{filteredServices.length === 1 ? "" : "s"} in view</h2></div>
        <div className="grid gap-4 lg:grid-cols-2" aria-label="Saved Services">{filteredServices.map((service) => { const published = service.status === "published"; return <article key={service.id} className="flex min-h-[350px] flex-col rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-lg shadow-black/5 transition hover:border-[color:var(--loombus-gold)] hover:shadow-xl">
          <div className="flex items-start justify-between gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[color:var(--loombus-cream)] text-[color:var(--loombus-gold)] dark:bg-[color:var(--loombus-gold-soft)]"><Sparkles size={20}/></span><div className="flex flex-wrap justify-end gap-2 text-[11px] font-semibold text-[color:var(--loombus-text-muted)]"><span className="rounded-full border border-[color:var(--loombus-border)] px-3 py-1">{service.category}</span><span className={`rounded-full px-3 py-1 capitalize ${published ? "bg-[color:var(--loombus-cream)] text-[color:var(--loombus-cream-contrast)] dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-gold)]" : "bg-amber-500/10 text-amber-600 dark:text-amber-300"}`}>{statusLabel(service.status)}</span></div></div>
          {published ? <Link href={`/services/${service.slug}`} className="mt-5 text-2xl font-semibold leading-tight tracking-[-0.035em] hover:underline">{service.title}</Link> : <h3 className="mt-5 text-2xl font-semibold leading-tight tracking-[-0.035em]">{service.title}</h3>}
          <p className="mt-3 line-clamp-4 text-sm leading-6 text-[color:var(--loombus-text-muted)]">{service.description}</p>
          <div className="mt-auto space-y-3 pt-6 text-sm text-[color:var(--loombus-text-muted)]"><span className="flex items-start gap-3"><MapPin className="mt-0.5 shrink-0 text-[color:var(--loombus-gold)]" size={16}/>{providerServiceLocationLabel(service)}</span><span className="flex items-start gap-3"><BriefcaseBusiness className="mt-0.5 shrink-0 text-[color:var(--loombus-gold)]" size={16}/>{service.businessName || service.providerName}</span>{service.appointmentServiceId ? <span className="flex items-start gap-3"><CalendarClock className="mt-0.5 shrink-0 text-[color:var(--loombus-gold)]" size={16}/>Appointment connected</span> : null}</div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--loombus-border-muted)] pt-4 text-xs"><span className="font-semibold text-[color:var(--loombus-text)]">{formatProviderServicePrice(service)}</span><div className="flex items-center gap-3">{published ? <Link href={`/services/${service.slug}`} className="inline-flex items-center gap-1 font-semibold text-[color:var(--loombus-gold)] hover:underline">Open Service <ArrowUpRight size={13}/></Link> : <span className="text-[color:var(--loombus-text-subtle)]">Detail unavailable</span>}<button type="button" onClick={() => void remove(service.id)} disabled={Boolean(working)} className="inline-flex items-center gap-1.5 rounded-full border border-red-500/25 px-3 py-2 font-semibold text-red-500 transition hover:bg-red-500/10 disabled:opacity-50" aria-label={`Remove ${service.title} from saved Services`}>{working === service.id ? <Loader2 className="animate-spin" size={14}/> : <Trash2 size={14}/>}Remove</button></div></div>
        </article>; })}</div>
      </section>}
    </section><SavedRail privacyCopy="Providers cannot see who saved a Service. Your shortlist is loaded only for your authenticated account." tools={[["Browse Services", "/services"], ["Offer or manage Services", "/services/manage"], ["Saved Requests", "/requests/saved"], ["Everything Search", "/search"]]} safetyTitle="Saving is not verification" safetyCopy="Confirm licensing, credentials, pricing, availability, and payment terms directly before hiring a provider."/></div>
  </div></main>;
}
