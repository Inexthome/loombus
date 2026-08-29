"use client";

import { Plus, Trash2 } from "lucide-react";
import type { ServiceDraft } from "@/components/business-manager-model";

type Props = { services: ServiceDraft[]; updateService: (index: number, key: keyof ServiceDraft, value: string) => void; addService: () => void; removeService: (index: number) => void; };
const fieldClass = "border-0 border-b border-[var(--loombus-border)] bg-transparent px-0 py-3 outline-none transition focus:border-[var(--loombus-gold)] focus:ring-0";

export function BusinessListingServices({ services, updateService, addService, removeService }: Props) {
  return (
    <section className="border-b border-[var(--loombus-border)] py-7">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]">Services</p><h2 className="mt-1 text-lg font-semibold">Published offerings</h2><p className="mt-1 text-sm text-[var(--loombus-text-muted)]">Add legitimate offerings. Each service is independently searchable.</p></div><button type="button" onClick={addService} className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--loombus-gold)] hover:underline"><Plus size={14} /> Add service</button></div>
      <div className="mt-5 divide-y divide-[var(--loombus-border)] border-t border-[var(--loombus-border)]">
        {services.map((service, index) => (
          <article key={index} className="py-5">
            <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Service {index + 1}</h3><button type="button" onClick={() => removeService(index)} aria-label={`Remove service ${index + 1}`} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--loombus-text-muted)] hover:text-red-500"><Trash2 size={14} /> Remove</button></div>
            <div className="mt-4 grid gap-5 md:grid-cols-2">
              <input value={service.name} onChange={(event) => updateService(index, "name", event.target.value)} placeholder="Service name" className={fieldClass} />
              <input value={service.category} onChange={(event) => updateService(index, "category", event.target.value)} placeholder="Service category" className={fieldClass} />
              <textarea value={service.description} onChange={(event) => updateService(index, "description", event.target.value)} placeholder="Describe this service" rows={3} className={`${fieldClass} md:col-span-2`} />
              <input value={service.priceText} onChange={(event) => updateService(index, "priceText", event.target.value)} placeholder="Price, estimate, or consultation note" className={fieldClass} />
              <input value={service.serviceArea} onChange={(event) => updateService(index, "serviceArea", event.target.value)} placeholder="Service area" className={fieldClass} />
              <input type="url" value={service.bookingUrl} onChange={(event) => updateService(index, "bookingUrl", event.target.value)} placeholder="Service-specific request URL" className={`${fieldClass} md:col-span-2`} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
