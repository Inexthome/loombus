"use client";

import { ArrowUpRight, MapPin, Wrench } from "lucide-react";
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
    <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-xl shadow-black/10 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">
            Current offerings
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">Services</h2>
          <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
            Review the scope, price context, service area, and original booking destination for each offering.
          </p>
        </div>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[color:var(--loombus-cream)] text-[color:var(--loombus-gold)] dark:bg-[color:var(--loombus-gold-soft)]">
          <Wrench size={20} />
        </span>
      </div>

      {business.services.length === 0 ? (
        <p className="mt-5 rounded-2xl bg-[color:var(--loombus-page-bg)] p-5 text-sm text-[color:var(--loombus-text-muted)]">
          This business has not published individual service entries yet.
        </p>
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {business.services.map((service) => {
            const serviceBooking = safeExternalHref(
              service.bookingUrl || business.bookingUrl,
            );
            return (
              <article
                key={service.id}
                className="flex min-h-[250px] flex-col rounded-[1.4rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] p-5 transition hover:border-[color:var(--loombus-gold)]"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[color:var(--loombus-text-subtle)]">
                  {service.category ? (
                    <span className="rounded-full border border-[color:var(--loombus-border)] px-3 py-1">
                      {service.category}
                    </span>
                  ) : null}
                  {service.priceText ? (
                    <span className="rounded-full bg-[color:var(--loombus-cream)] px-3 py-1 text-[color:var(--loombus-cream-contrast)] dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-gold)]">
                      {service.priceText}
                    </span>
                  ) : null}
                </div>

                <h3 className="mt-4 text-xl font-semibold tracking-[-0.025em]">
                  {service.name}
                </h3>
                {service.description ? (
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                    {service.description}
                  </p>
                ) : null}

                <div className="mt-auto pt-5">
                  {service.serviceArea ? (
                    <p className="flex items-start gap-2 text-sm text-[color:var(--loombus-text-muted)]">
                      <MapPin className="mt-0.5 shrink-0 text-[color:var(--loombus-gold)]" size={15} />
                      {service.serviceArea}
                    </p>
                  ) : null}
                  {serviceBooking ? (
                    <a
                      href={serviceBooking}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--loombus-gold)] hover:underline"
                    >
                      Request this service <ArrowUpRight size={14} />
                    </a>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
