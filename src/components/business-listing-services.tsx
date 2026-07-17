"use client";

import { Plus, Trash2 } from "lucide-react";
import type { ServiceDraft } from "@/components/business-manager-model";

type Props = {
  services: ServiceDraft[];
  updateService: (
    index: number,
    key: keyof ServiceDraft,
    value: string
  ) => void;
  addService: () => void;
  removeService: (index: number) => void;
};

export function BusinessListingServices({
  services,
  updateService,
  addService,
  removeService,
}: Props) {
  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Services</h2>
          <p className="mt-1 text-sm text-[var(--loombus-text-muted)]">
            Add up to 20 independently searchable offerings.
          </p>
        </div>
        <button
          type="button"
          onClick={addService}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--loombus-border)] px-4 py-2 text-sm font-semibold"
        >
          <Plus size={15} /> Add service
        </button>
      </div>

      <div className="mt-4 grid gap-4">
        {services.map((service, index) => (
          <article
            key={index}
            className="rounded-[1.3rem] border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold">Service {index + 1}</h3>
              <button
                type="button"
                onClick={() => removeService(index)}
                aria-label={`Remove service ${index + 1}`}
                className="rounded-full p-2"
              >
                <Trash2 size={16} />
              </button>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <input
                value={service.name}
                onChange={(event) =>
                  updateService(index, "name", event.target.value)
                }
                placeholder="Service name"
                className="rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 outline-none"
              />
              <input
                value={service.category}
                onChange={(event) =>
                  updateService(index, "category", event.target.value)
                }
                placeholder="Service category"
                className="rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 outline-none"
              />
              <textarea
                value={service.description}
                onChange={(event) =>
                  updateService(index, "description", event.target.value)
                }
                placeholder="Describe this service"
                rows={3}
                className="rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 outline-none md:col-span-2"
              />
              <input
                value={service.priceText}
                onChange={(event) =>
                  updateService(index, "priceText", event.target.value)
                }
                placeholder="Price, estimate, or consultation note"
                className="rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 outline-none"
              />
              <input
                value={service.serviceArea}
                onChange={(event) =>
                  updateService(index, "serviceArea", event.target.value)
                }
                placeholder="Service area"
                className="rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 outline-none"
              />
              <input
                type="url"
                value={service.bookingUrl}
                onChange={(event) =>
                  updateService(index, "bookingUrl", event.target.value)
                }
                placeholder="Service-specific request URL"
                className="rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 outline-none md:col-span-2"
              />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
