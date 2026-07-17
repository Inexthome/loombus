"use client";

import { ExternalLink, MapPin, Wrench } from "lucide-react";
import type { BusinessProfile } from "@/lib/business-directory";

function safeExternalHref(value: string) {
  if (!value) return "";
  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol)
      ? parsed.toString()
      : "";
  } catch {
    return "";
  }
}

export function BusinessProfileServices({
  business,
}: {
  business: BusinessProfile;
}) {
  return (
    <section className="mt-5 rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <Wrench size={22} />
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--loombus-text-subtle)]">
            Current offerings
          </p>
          <h2 className="mt-1 text-2xl font-semibold">Services</h2>
        </div>
      </div>

      {business.services.length === 0 ? (
        <p className="mt-5 rounded-2xl bg-[var(--loombus-page-bg)] p-5 text-sm text-[var(--loombus-text-muted)]">
          This business has not published individual service entries yet.
        </p>
      ) : (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {business.services.map((service) => {
            const serviceBooking = safeExternalHref(
              service.bookingUrl || business.bookingUrl
            );
            return (
              <article
                key={service.id}
                className="rounded-[1.3rem] border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-5"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--loombus-text-subtle)]">
                  {service.category ? <span>{service.category}</span> : null}
                  {service.priceText ? (
                    <span>· {service.priceText}</span>
                  ) : null}
                </div>
                <h3 className="mt-2 text-lg font-semibold">{service.name}</h3>
                {service.description ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--loombus-text-muted)]">
                    {service.description}
                  </p>
                ) : null}
                {service.serviceArea ? (
                  <p className="mt-3 flex items-center gap-2 text-xs text-[var(--loombus-text-subtle)]">
                    <MapPin size={13} /> {service.serviceArea}
                  </p>
                ) : null}
                {serviceBooking ? (
                  <a
                    href={serviceBooking}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center gap-2 text-sm font-semibold hover:underline"
                  >
                    Request this service <ExternalLink size={14} />
                  </a>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
