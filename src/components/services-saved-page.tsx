"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Bookmark,
  BriefcaseBusiness,
  CalendarClock,
  ChevronRight,
  Loader2,
  LockKeyhole,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  formatProviderServicePrice,
  providerServiceLocationLabel,
  type PublicProviderService,
} from "@/lib/provider-services";
import { providerServicesAuthorizedFetch } from "@/lib/provider-services-client";

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
    setLoading(true);
    setNotice("");
    try {
      const response = await providerServicesAuthorizedFetch("/api/services?saved=1", { cache: "no-store" }, "/services/saved");
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Unable to load saved Services.");
      setServices(Array.isArray(payload.services) ? payload.services : []);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load saved Services.");
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(serviceId: string) {
    if (working) return;
    setWorking(serviceId);
    setNotice("");
    try {
      const response = await providerServicesAuthorizedFetch(
        "/api/services",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "unsave", serviceId }) },
        "/services/saved",
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Unable to remove the saved Service.");
      setServices((current) => current.filter((service) => service.id !== serviceId));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to remove the saved Service.");
    } finally {
      setWorking("");
    }
  }

  const publishedCount = useMemo(() => services.filter((service) => service.status === "published").length, [services]);
  const appointmentCount = useMemo(() => services.filter((service) => service.appointmentServiceId).length, [services]);
  const filteredServices = useMemo(() => {
    const clean = query.trim().toLowerCase();
    return services.filter((service) => {
      if (view === "available" && service.status !== "published") return false;
      if (view === "unavailable" && service.status === "published") return false;
      if (!clean) return true;
      return [service.title, service.description, service.category, service.providerName, service.businessName, service.city, service.region, service.status, ...service.specialties]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(clean));
    });
  }, [query, services, view]);

  const options: Array<{ value: SavedServiceView; label: string; count: number }> = [
    { value: "all", label: "All saved", count: services.length },
    { value: "available", label: "Available", count: publishedCount },
    { value: "unavailable", label: "No longer public", count: services.length - publishedCount },
  ];

  const clear = () => {
    setQuery("");
    setView("all");
  };

  return (
    <main data-services-saved-editorial className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-6 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <header className="border-b border-[color:var(--loombus-border)] pb-8 sm:pb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--loombus-gold)]">Private watchlist</p>
          <div className="mt-3 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <h1 className="text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Saved Services</h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[color:var(--loombus-text-muted)] sm:text-base">
                Compare providers you may return to without exposing your saved state to other members. Services that leave public view remain here until you remove them.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              <Link href="/services" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium underline decoration-[color:var(--loombus-gold)] underline-offset-4 transition motion-reduce:transition-none hover:text-[color:var(--loombus-gold)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--loombus-gold)]">
                <BriefcaseBusiness size={16} /> Browse Services
              </Link>
              <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-11 items-center gap-2 border border-[color:var(--loombus-border)] px-4 py-2.5 text-sm font-medium transition motion-reduce:transition-none hover:border-[color:var(--loombus-gold)] disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--loombus-gold)]">
                <RefreshCw size={16} className={loading ? "animate-spin motion-reduce:animate-none" : ""} /> Refresh
              </button>
            </div>
          </div>
        </header>

        <section aria-label="Saved Services summary" className="grid border-b border-[color:var(--loombus-border)] sm:grid-cols-3">
          <div className="py-5 sm:border-r sm:border-[color:var(--loombus-border)] sm:pr-6">
            <span className="text-xs font-medium text-[color:var(--loombus-text-muted)]">Saved Services</span>
            <strong className="mt-1 block text-2xl font-semibold">{services.length}</strong>
          </div>
          <div className="border-t border-[color:var(--loombus-border)] py-5 sm:border-t-0 sm:border-r sm:px-6">
            <span className="text-xs font-medium text-[color:var(--loombus-text-muted)]">Available now</span>
            <strong className="mt-1 block text-2xl font-semibold">{publishedCount}</strong>
          </div>
          <div className="border-t border-[color:var(--loombus-border)] py-5 sm:border-t-0 sm:pl-6">
            <span className="text-xs font-medium text-[color:var(--loombus-text-muted)]">Appointment connected</span>
            <strong className="mt-1 block text-2xl font-semibold">{appointmentCount}</strong>
          </div>
        </section>

        <section className="border-b border-[color:var(--loombus-border)] py-6">
          <label className="relative block">
            <span className="sr-only">Search saved Services</span>
            <Search className="pointer-events-none absolute left-0 top-1/2 h-5 w-5 -translate-y-1/2 text-[color:var(--loombus-text-subtle)]" />
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search saved Service, provider, category, or place" className="min-h-12 w-full border-0 border-b border-[color:var(--loombus-border)] bg-transparent py-3 pl-8 pr-4 text-base outline-none transition motion-reduce:transition-none placeholder:text-[color:var(--loombus-text-subtle)] focus:border-[color:var(--loombus-gold)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--loombus-gold)]" />
          </label>
          <nav className="mt-5 flex gap-6 overflow-x-auto border-b border-[color:var(--loombus-border)]" aria-label="Saved Service views">
            {options.map((option) => (
              <button key={option.value} type="button" onClick={() => setView(option.value)} aria-current={view === option.value ? "page" : undefined} className={`min-h-11 shrink-0 border-b-2 px-0 text-sm font-medium transition motion-reduce:transition-none ${view === option.value ? "border-[color:var(--loombus-gold)] text-[color:var(--loombus-text)]" : "border-transparent text-[color:var(--loombus-text-muted)] hover:text-[color:var(--loombus-text)]"}`}>
                {option.label} <span className="ml-1 text-xs opacity-70">{option.count}</span>
              </button>
            ))}
          </nav>
        </section>

        <div className="grid gap-10 py-8 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-12">
          <section className="min-w-0">
            {notice ? <div className="mb-6 border-y border-red-500/30 py-4 text-sm" role="alert">{notice}</div> : null}

            {loading ? (
              <section className="border-y border-[color:var(--loombus-border)] py-12 text-center text-[color:var(--loombus-text-muted)]">
                <Loader2 className="mx-auto animate-spin text-[color:var(--loombus-gold)] motion-reduce:animate-none" size={26} />
                <p className="mt-3 text-sm">Loading your private Service watchlist…</p>
              </section>
            ) : services.length === 0 ? (
              <section className="border-y border-[color:var(--loombus-border)] py-12 text-center">
                <Bookmark className="mx-auto text-[color:var(--loombus-gold)]" size={34} />
                <h2 className="mt-4 text-xl font-semibold">No saved Services yet.</h2>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">Save a Service from the public directory to compare it here later.</p>
                <Link href="/services" className="mt-5 inline-flex min-h-11 items-center border border-[color:var(--loombus-gold)] bg-[color:var(--loombus-gold)] px-4 py-2.5 text-sm font-semibold text-[color:var(--loombus-gold-contrast)]">Browse Services</Link>
              </section>
            ) : filteredServices.length === 0 ? (
              <section className="border-y border-[color:var(--loombus-border)] py-12 text-center">
                <Search className="mx-auto text-[color:var(--loombus-gold)]" size={32} />
                <h2 className="mt-4 text-xl font-semibold">No saved Services match this view.</h2>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">Clear the search or return to all saved Services.</p>
                <button type="button" onClick={clear} className="mt-5 min-h-11 text-sm font-medium underline underline-offset-4 hover:text-[color:var(--loombus-gold)]">Clear search and filters</button>
              </section>
            ) : (
              <section>
                <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[color:var(--loombus-border)] pb-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--loombus-gold)]">Private shortlist</p>
                    <h2 className="mt-2 text-xl font-semibold">{filteredServices.length} Service{filteredServices.length === 1 ? "" : "s"} in view</h2>
                  </div>
                  {(query || view !== "all") ? <button type="button" onClick={clear} className="min-h-11 text-sm font-medium text-[color:var(--loombus-text-muted)] underline underline-offset-4 hover:text-[color:var(--loombus-text)]">Clear search and filters</button> : null}
                </div>

                <div className="divide-y divide-[color:var(--loombus-border)]" aria-label="Saved Services">
                  {filteredServices.map((service) => {
                    const published = service.status === "published";
                    return (
                      <article key={service.id} className="py-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 max-w-3xl">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-[color:var(--loombus-text-muted)]">
                              <span className="font-semibold uppercase tracking-[0.14em] text-[color:var(--loombus-gold)]">{service.category}</span>
                              <span className="capitalize">{statusLabel(service.status)}</span>
                              {service.appointmentServiceId ? <span className="inline-flex items-center gap-1"><CalendarClock size={13} /> Appointment connected</span> : null}
                            </div>
                            {published ? (
                              <Link href={`/services/${service.slug}`} className="mt-2 block text-xl font-semibold tracking-tight transition motion-reduce:transition-none hover:text-[color:var(--loombus-gold)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--loombus-gold)] sm:text-2xl">{service.title}</Link>
                            ) : (
                              <h3 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">{service.title}</h3>
                            )}
                            <p className="mt-2 line-clamp-3 text-sm leading-6 text-[color:var(--loombus-text-muted)]">{service.description}</p>
                          </div>
                          <p className="shrink-0 text-sm font-semibold">{formatProviderServicePrice(service)}</p>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[color:var(--loombus-text-muted)]">
                          <span className="inline-flex items-center gap-1.5"><MapPin size={14} className="text-[color:var(--loombus-gold)]" />{providerServiceLocationLabel(service)}</span>
                          <span className="inline-flex items-center gap-1.5"><BriefcaseBusiness size={14} className="text-[color:var(--loombus-gold)]" />{service.businessName || service.providerName}</span>
                        </div>

                        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-[color:var(--loombus-border)] pt-4">
                          {published ? <Link href={`/services/${service.slug}`} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-[color:var(--loombus-gold)] hover:underline">Open Service <ArrowUpRight size={13} /></Link> : <span className="text-xs text-[color:var(--loombus-text-subtle)]">Detail unavailable</span>}
                          <button type="button" onClick={() => void remove(service.id)} disabled={Boolean(working)} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-red-500 underline decoration-red-500/40 underline-offset-4 transition motion-reduce:transition-none hover:decoration-red-500 disabled:opacity-50" aria-label={`Remove ${service.title} from saved Services`}>
                            {working === service.id ? <Loader2 className="animate-spin motion-reduce:animate-none" size={14} /> : <Trash2 size={14} />} Remove
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}
          </section>

          <aside className="space-y-8 lg:border-l lg:border-[color:var(--loombus-border)] lg:pl-8">
            <section>
              <div className="flex gap-3">
                <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--loombus-gold)]" />
                <div>
                  <h2 className="text-sm font-semibold">Private to your account</h2>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">Providers cannot see who saved a Service. Your shortlist is loaded only for your authenticated account.</p>
                </div>
              </div>
            </section>

            <section>
              <p className="border-b border-[color:var(--loombus-border)] pb-3 text-xs font-semibold uppercase tracking-[0.18em]">Related tools</p>
              <div className="divide-y divide-[color:var(--loombus-border)]">
                {[["Browse Services", "/services"], ["Offer or manage Services", "/services/manage"], ["Saved Requests", "/requests/saved"], ["Everything Search", "/search"]].map(([label, href]) => (
                  <Link key={href} href={href} className="flex min-h-11 items-center justify-between py-3 text-sm font-medium transition motion-reduce:transition-none hover:text-[color:var(--loombus-gold)]">{label}<ChevronRight className="h-4 w-4 text-[color:var(--loombus-gold)]" /></Link>
                ))}
              </div>
            </section>

            <section className="border-t border-[color:var(--loombus-border)] pt-5">
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--loombus-gold)]" />
                <div>
                  <h3 className="text-sm font-semibold">Saving is not verification</h3>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">Confirm licensing, credentials, pricing, availability, and payment terms directly before hiring a provider.</p>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
