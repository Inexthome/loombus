"use client";

import Link from "next/link";
import { Bookmark, MapPin, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  formatProviderServicePrice,
  providerServiceLocationLabel,
  type PublicProviderService,
} from "@/lib/provider-services";
import { providerServicesAuthorizedFetch } from "@/lib/provider-services-client";

export default function ServicesSavedPage() {
  const [services, setServices] = useState<PublicProviderService[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setNotice("");
    try {
      const response = await providerServicesAuthorizedFetch(
        "/api/services?saved=1",
        { cache: "no-store" },
        "/services/saved",
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load saved Services.");
      }
      setServices(Array.isArray(payload.services) ? payload.services : []);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to load saved Services.",
      );
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
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "unsave", serviceId }),
        },
        "/services/saved",
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to remove the saved Service.");
      }
      setServices((current) =>
        current.filter((service) => service.id !== serviceId),
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to remove the saved Service.",
      );
    } finally {
      setWorking("");
    }
  }

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 py-8 text-[var(--loombus-text)] sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--loombus-text-subtle)]">
                Saved Services
              </p>
              <h1 className="mt-2 text-4xl font-semibold">
                Return to providers worth considering.
              </h1>
              <p className="mt-3 max-w-2xl text-[var(--loombus-text-muted)]">
                Saved Services remain private to your account. Paused, archived,
                rejected, or removed Services stay visible here until you remove
                them.
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/services"
                className="rounded-full border border-[var(--loombus-border)] px-5 py-3 text-sm font-semibold"
              >
                Browse Services
              </Link>
              <button
                type="button"
                onClick={() => void load()}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] px-5 py-3 text-sm font-semibold"
              >
                <RefreshCw
                  size={16}
                  className={loading ? "animate-spin" : ""}
                />
                Refresh
              </button>
            </div>
          </div>
        </header>

        {notice ? (
          <div
            className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 text-sm"
            role="alert"
          >
            {notice}
          </div>
        ) : null}

        {loading ? (
          <section className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-10 text-center text-[var(--loombus-text-muted)]">
            Loading saved Services…
          </section>
        ) : services.length === 0 ? (
          <section className="rounded-[1.6rem] border border-dashed border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-10 text-center">
            <Bookmark
              className="mx-auto text-[var(--loombus-text-subtle)]"
              size={42}
            />
            <h2 className="mt-4 text-2xl font-semibold">
              No saved Services yet.
            </h2>
            <Link
              href="/services"
              className="mt-5 inline-flex rounded-full border border-[var(--loombus-border)] px-5 py-3 text-sm font-semibold"
            >
              Browse Services
            </Link>
          </section>
        ) : (
          <section className="grid gap-4 md:grid-cols-2">
            {services.map((service) => (
              <article
                key={service.id}
                className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
                      <span className="rounded-full border border-[var(--loombus-border)] px-3 py-1">
                        {service.category}
                      </span>
                      <span className="rounded-full border border-[var(--loombus-border)] px-3 py-1 capitalize">
                        {service.status.replaceAll("_", " ")}
                      </span>
                    </div>
                    <Link
                      href={
                        service.status === "published"
                          ? `/services/${service.slug}`
                          : "/services/saved"
                      }
                      className="mt-3 block text-xl font-semibold hover:underline"
                    >
                      {service.title}
                    </Link>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--loombus-text-muted)]">
                      {service.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void remove(service.id)}
                    disabled={working === service.id}
                    className="text-red-500"
                    aria-label={`Remove ${service.title} from saved Services`}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-[var(--loombus-border)] pt-4 text-xs text-[var(--loombus-text-muted)]">
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={13} /> {providerServiceLocationLabel(service)}
                  </span>
                  <span>{formatProviderServicePrice(service)}</span>
                  <span>{service.businessName || service.providerName}</span>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
