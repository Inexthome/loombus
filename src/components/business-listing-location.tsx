"use client";

import { BUSINESS_SERVICE_AREA_MODES } from "@/lib/business-directory";
import type {
  BusinessDraft,
  UpdateBusinessDraft,
} from "@/components/business-manager-model";

export function BusinessListingLocation({
  draft,
  updateDraft,
}: {
  draft: BusinessDraft;
  updateDraft: UpdateBusinessDraft;
}) {
  return (
    <div className="mt-6 rounded-[1.3rem] bg-[var(--loombus-page-bg)] p-5">
      <h2 className="font-semibold">Location and service area</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-sm font-semibold">Service model</span>
          <select
            value={draft.serviceAreaMode}
            onChange={(event) =>
              updateDraft("serviceAreaMode", event.target.value)
            }
            className="rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 outline-none"
          >
            {BUSINESS_SERVICE_AREA_MODES.map((mode) => (
              <option key={mode.value} value={mode.value}>
                {mode.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-semibold">
            Service radius in miles
          </span>
          <input
            type="number"
            min="0"
            max="1000"
            value={draft.serviceRadiusMiles}
            onChange={(event) =>
              updateDraft("serviceRadiusMiles", event.target.value)
            }
            className="rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 outline-none"
          />
        </label>
        <label className="grid gap-2 md:col-span-2">
          <span className="text-sm font-semibold">
            Service areas, separated by commas
          </span>
          <input
            value={draft.serviceAreas}
            onChange={(event) =>
              updateDraft("serviceAreas", event.target.value)
            }
            placeholder="Jacksonville, Middleburg, Orange Park"
            className="rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 outline-none"
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-semibold">Address line 1</span>
          <input
            value={draft.addressLine1}
            onChange={(event) =>
              updateDraft("addressLine1", event.target.value)
            }
            className="rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 outline-none"
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-semibold">Address line 2</span>
          <input
            value={draft.addressLine2}
            onChange={(event) =>
              updateDraft("addressLine2", event.target.value)
            }
            className="rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 outline-none"
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-semibold">City</span>
          <input
            value={draft.city}
            onChange={(event) => updateDraft("city", event.target.value)}
            className="rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 outline-none"
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-semibold">State or region</span>
          <input
            value={draft.region}
            onChange={(event) =>
              updateDraft("region", event.target.value)
            }
            className="rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 outline-none"
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-semibold">Postal code</span>
          <input
            value={draft.postalCode}
            onChange={(event) =>
              updateDraft("postalCode", event.target.value)
            }
            className="rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 outline-none"
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-semibold">Country code</span>
          <input
            value={draft.countryCode}
            onChange={(event) =>
              updateDraft("countryCode", event.target.value.toUpperCase())
            }
            maxLength={2}
            className="rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 uppercase outline-none"
          />
        </label>
      </div>
      <label className="mt-4 flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={draft.showExactAddress}
          onChange={(event) =>
            updateDraft("showExactAddress", event.target.checked)
          }
          className="mt-1"
        />
        <span>
          Show the exact street address publicly. City, state, and service
          areas remain public even when this is off.
        </span>
      </label>
    </div>
  );
}
