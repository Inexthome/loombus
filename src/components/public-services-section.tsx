"use client";

import Link from "next/link";
import { BriefcaseBusiness, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import {
  formatProviderServicePrice,
  providerServiceLocationLabel,
  type PublicProviderService,
} from "@/lib/provider-services";

export default function PublicServicesSection({
  providerUsername,
  businessSlug,
  heading = "Services",
}: {
  providerUsername?: string;
  businessSlug?: string;
  heading?: string;
}) {
  const [services, setServices] = useState<PublicProviderService[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ pageSize: "6" });
    if (providerUsername) params.set("providerUsername", providerUsername);
    if (businessSlug) params.set("businessSlug", businessSlug);
    void fetch(`/api/services?${params.toString()}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        if (active) {
          setServices(Array.isArray(payload.services) ? payload.services : []);
        }
      })
      .catch(() => null)
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [businessSlug, providerUsername]);

  if (!loaded || services.length === 0) return null;

  return (
    <section className="bg-[var(--loombus-page-bg)] px-4 pb-10 text-[var(--loombus-text)] sm:px-6">
      <div className="mx-auto max-w-6xl rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]">
              Loombus Services
            </p>
            <h2 className="mt-1 text-2xl font-semibold">{heading}</h2>
          </div>
          <Link href="/services" className="text-sm font-semibold">
            Browse all
          </Link>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <Link
              key={service.id}
              href={`/services/${service.slug}`}
              className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4"
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--loombus-text-subtle)]">
                <BriefcaseBusiness size={14} /> {service.category}
              </div>
              <h3 className="mt-2 text-lg font-semibold leading-snug">
                {service.title}
              </h3>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--loombus-text-muted)]">
                {service.description}
              </p>
              <div className="mt-4 space-y-2 text-xs text-[var(--loombus-text-muted)]">
                <span className="flex items-start gap-2">
                  <MapPin size={14} className="mt-0.5 shrink-0" />
                  {providerServiceLocationLabel(service)}
                </span>
                <span>{formatProviderServicePrice(service)}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
