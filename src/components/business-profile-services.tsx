"use client";

import { ArrowUpRight, MapPin } from "lucide-react";
import type { BusinessProfile } from "@/lib/business-directory";

function safeExternalHref(value: string) {
  if (!value) return "";
  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : "";
  } catch {
    return "";
  }
}

export function BusinessProfileServices({ business }: { business: BusinessProfile }) {
  return (
    <section className="border-b border-[color:var(--loombus-border)] py-7">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--loombus-gold)]">Current offerings</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-2xl font-semibold">Services</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">Scope, price context, service area, and booking destination for each offering.</p></div>
        <span className="text-sm text-[color:var(--loombus-text-subtle)]">{business.services.length} listed</span>
      </div>

      {business.services.length === 0 ? (
        <p className="mt-6 border-t border-[color:var(--loombus-border-muted)] py-6 text-sm text-[color:var(--loombus-text-muted)]">This business has not published individual service entries yet.</p>
      ) : (
        <div className="mt-5 divide-y divide-[color:var(--loombus-border)] border-t border-[color:var(--loombus-border)]">
          {business.services.map((service) => {
            const serviceBooking = safeExternalHref(service.bookingUrl || business.bookingUrl);
            return (
              <article key={service.id} className="grid gap-4 py-5 md:grid-cols-[minmax(0,1fr)_minmax(13rem,.45fr)]">
                <div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--loombus-text-subtle)]">{service.category ? <span>{service.category}</span> : null}{service.priceText ? <span className="text-[color:var(--loombus-gold)]">{service.priceText}</span> : null}</div>
                  <h3 className="mt-2 text-xl font-semibold">{service.name}</h3>
                  {service.description ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[color:var(--loombus-text-muted)]">{service.description}</p> : null}
                </div>
                <div className="text-sm text-[color:var(--loombus-text-muted)] md:border-l md:border-[color:var(--loombus-border-muted)] md:pl-5">
                  {service.serviceArea ? <p className="flex items-start gap-2"><MapPin className="mt-0.5 shrink-0 text-[color:var(--loombus-gold)]" size={14} />{service.serviceArea}</p> : null}
                  {serviceBooking ? <a href={serviceBooking} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 font-semibold text-[color:var(--loombus-gold)] hover:underline">Request this service <ArrowUpRight size={14} /></a> : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
