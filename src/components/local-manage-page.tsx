"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  Crosshair,
  Loader2,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  localDiscoveryTypeLabel,
  type LocalManageItem,
  type LocalManageResponse,
} from "@/lib/local-discovery";
import { localDiscoveryAuthorizedFetch } from "@/lib/local-discovery-client";
import { getCurrentApproximateLocation } from "@/lib/native-location";

type CurrentArea = { latitude: number; longitude: number };

const inputClass =
  "local-manage-field h-12 w-full border-0 border-b border-[color:var(--loombus-border)] bg-transparent px-0 text-sm text-[color:var(--loombus-text)] outline-none transition motion-reduce:transition-none placeholder:text-[color:var(--loombus-text-subtle)] focus:border-[color:var(--loombus-gold)] focus-visible:ring-0";

export default function LocalManagePage() {
  const [items, setItems] = useState<LocalManageItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [currentArea, setCurrentArea] = useState<CurrentArea | null>(null);
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [countryCode, setCountryCode] = useState("US");
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");

  const selected = useMemo(
    () => items.find((item) => `${item.sourceTable}:${item.id}` === selectedId) ?? null,
    [items, selectedId],
  );

  const directCount = useMemo(
    () => items.filter((item) => Boolean(item.directLocation)).length,
    [items],
  );
  const inheritedCount = useMemo(
    () => items.filter((item) => Boolean(item.inheritedLocation)).length,
    [items],
  );
  const configurableCount = useMemo(
    () => items.filter((item) => item.canSetDirect).length,
    [items],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setNotice("");
    try {
      const response = await localDiscoveryAuthorizedFetch(
        "/api/local?manage=1",
        { cache: "no-store" },
        "/local/manage",
      );
      const payload = (await response.json().catch(() => ({}))) as
        | LocalManageResponse
        | { error?: string };
      if (!response.ok) {
        throw new Error(
          "error" in payload && payload.error
            ? payload.error
            : "Unable to load Local Discovery locations.",
        );
      }
      const nextItems = Array.isArray((payload as LocalManageResponse).items)
        ? (payload as LocalManageResponse).items
        : [];
      setItems(nextItems);
      setSelectedId((current) => {
        if (nextItems.some((item) => `${item.sourceTable}:${item.id}` === current)) {
          return current;
        }
        const first = nextItems.find((item) => item.canSetDirect);
        return first ? `${first.sourceTable}:${first.id}` : "";
      });
    } catch (error) {
      setItems([]);
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to load Local Discovery locations.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selected) return;
    setCity(selected.city ?? "");
    setRegion(selected.region ?? "");
    setPostalCode(selected.postalCode ?? "");
    setCountryCode(selected.countryCode ?? "US");
    setCurrentArea(null);
  }, [selected]);

  async function acquireCurrentArea() {
    setLocating(true);
    setNotice("");

    try {
      setCurrentArea(await getCurrentApproximateLocation());
      setNotice(
        "Current area captured. Loombus will store a rounded approximate point, not the device's exact coordinate.",
      );
    } catch {
      setNotice(
        "Current location was not shared. Location permission is required to create a distance-search anchor.",
      );
    } finally {
      setLocating(false);
    }
  }

  async function save() {
    if (!selected || !currentArea || working) return;
    setWorking(true);
    setNotice("");
    try {
      const response = await localDiscoveryAuthorizedFetch(
        "/api/local",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "set_location",
            sourceTable: selected.sourceTable,
            entityId: selected.id,
            latitude: currentArea.latitude,
            longitude: currentArea.longitude,
            city,
            region,
            postalCode,
            countryCode,
          }),
        },
        "/local/manage",
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to save the Local Discovery area.");
      }
      setCurrentArea(null);
      setNotice(
        "Approximate Local Discovery area saved. Distance searches can now include this source.",
      );
      await load();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to save the Local Discovery area.",
      );
    } finally {
      setWorking(false);
    }
  }

  async function clear() {
    if (!selected || !selected.directLocation || working) return;
    setWorking(true);
    setNotice("");
    try {
      const response = await localDiscoveryAuthorizedFetch(
        "/api/local",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "clear_location",
            sourceTable: selected.sourceTable,
            entityId: selected.id,
          }),
        },
        "/local/manage",
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to clear the Local Discovery area.");
      }
      setNotice("Direct Local Discovery area cleared.");
      await load();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to clear the Local Discovery area.",
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <main
      data-loombus-local-manage-editorial
      className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-6 text-[color:var(--loombus-text)] sm:px-6 lg:px-8"
    >
      <div className="mx-auto w-full max-w-6xl">
        <header className="border-b border-[color:var(--loombus-border)] pb-6">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[color:var(--loombus-gold)]">
            Local Discovery
          </p>
          <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <h1 className="text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
                Manage Local Areas
              </h1>
              <p className="mt-3 text-base leading-7 text-[color:var(--loombus-text-muted)]">
                Attach a privacy-safe approximate area to attributable public sources you control. Connected records can inherit a Business area unless they support a direct location.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading || working}
                className="inline-flex min-h-11 items-center gap-2 border border-[color:var(--loombus-border)] px-4 py-2 text-sm font-semibold transition motion-reduce:transition-none hover:border-[color:var(--loombus-gold)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--loombus-gold)] disabled:opacity-50"
              >
                <RefreshCw size={16} className={loading ? "animate-spin motion-reduce:animate-none" : ""} />
                Refresh
              </button>
              <Link
                href="/local"
                className="inline-flex min-h-11 items-center gap-2 bg-[color:var(--loombus-gold)] px-4 py-2 text-sm font-semibold text-[color:var(--loombus-gold-contrast)] transition motion-reduce:transition-none hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--loombus-gold)]"
              >
                Open Local <ArrowUpRight size={16} />
              </Link>
            </div>
          </div>
        </header>

        <section
          aria-label="Local source summary"
          className="grid border-b border-[color:var(--loombus-border)] sm:grid-cols-4"
        >
          {[
            ["Public sources", items.length],
            ["Direct areas", directCount],
            ["Inherited areas", inheritedCount],
            ["Direct-capable", configurableCount],
          ].map(([label, value], index) => (
            <div
              key={String(label)}
              className={`py-4 sm:px-4 ${index === 0 ? "sm:pl-0" : "border-t border-[color:var(--loombus-border-muted)] sm:border-l sm:border-t-0"}`}
            >
              <span className="text-xs font-semibold text-[color:var(--loombus-text-muted)]">
                {label}
              </span>
              <strong className="mt-1 block text-2xl font-semibold">{value}</strong>
            </div>
          ))}
        </section>

        {notice ? (
          <div
            className="border-b border-[color:var(--loombus-border)] py-4 text-sm leading-6"
            role="status"
          >
            {notice}
          </div>
        ) : null}

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="min-w-0 py-7">
            <div className="border-b border-[color:var(--loombus-border)] pb-4">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[color:var(--loombus-gold)]">
                Attributable sources
              </p>
              <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold tracking-[-0.03em]">Choose a source</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                    Select a source to review its current discovery area or capture a new approximate anchor.
                  </p>
                </div>
                <span className="text-xs font-semibold text-[color:var(--loombus-text-muted)]">
                  {items.length} source{items.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>

            {loading ? (
              <div className="grid min-h-56 place-items-center border-b border-[color:var(--loombus-border)] text-[color:var(--loombus-text-muted)]">
                <span className="inline-flex items-center gap-2 text-sm font-semibold">
                  <Loader2 className="animate-spin motion-reduce:animate-none text-[color:var(--loombus-gold)]" size={20} />
                  Loading sources
                </span>
              </div>
            ) : items.length === 0 ? (
              <div className="border-b border-[color:var(--loombus-border)] py-12 text-center">
                <MapPin className="mx-auto text-[color:var(--loombus-gold)]" size={36} />
                <h3 className="mt-4 text-xl font-semibold">No public real-world sources yet</h3>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                  Publish a Business, Service, Event, Job, Marketplace listing, or Request first.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[color:var(--loombus-border)]">
                {items.map((item) => {
                  const key = `${item.sourceTable}:${item.id}`;
                  const active = key === selectedId;
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={!item.canSetDirect}
                      onClick={() => setSelectedId(key)}
                      aria-pressed={active}
                      className={`group flex w-full items-start gap-4 py-5 text-left transition motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--loombus-gold)] disabled:cursor-not-allowed disabled:opacity-55 ${active ? "text-[color:var(--loombus-text)]" : "hover:text-[color:var(--loombus-text)]"}`}
                    >
                      <span
                        aria-hidden="true"
                        className={`mt-1 h-2.5 w-2.5 shrink-0 border ${active ? "border-[color:var(--loombus-gold)] bg-[color:var(--loombus-gold)]" : "border-[color:var(--loombus-border)]"}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-[color:var(--loombus-text-muted)]">
                          <span>{localDiscoveryTypeLabel(item.entityType)}</span>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1">
                            {item.directLocation ? <CheckCircle2 size={12} /> : null}
                            {item.directLocation ? "Direct area" : item.inheritedLocation ? "Inherited" : "Area needed"}
                          </span>
                        </span>
                        <strong className="mt-1 block text-lg font-semibold tracking-[-0.02em]">
                          {item.title}
                        </strong>
                        <span className="mt-1 block text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                          {item.locationLabel}
                        </span>
                        {!item.canSetDirect ? (
                          <span className="mt-1 block text-xs text-[color:var(--loombus-text-subtle)]">
                            This source follows its Business location.
                          </span>
                        ) : null}
                      </span>
                      {active ? (
                        <span className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--loombus-gold)]">
                          Editing
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="border-t border-[color:var(--loombus-border)] py-7 xl:border-l xl:border-t-0 xl:pl-7">
            <section className="border-b border-[color:var(--loombus-border)] pb-7">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[color:var(--loombus-gold)]">
                Approximate area
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.025em]">
                {selected?.title ?? "Select a source"}
              </h2>

              {selected ? (
                <>
                  <div className="mt-5 grid gap-4">
                    <label>
                      <span className="block text-xs font-semibold text-[color:var(--loombus-text-muted)]">City</span>
                      <input value={city} onChange={(event) => setCity(event.target.value)} className={inputClass} />
                    </label>
                    <label>
                      <span className="block text-xs font-semibold text-[color:var(--loombus-text-muted)]">State or region</span>
                      <input value={region} onChange={(event) => setRegion(event.target.value)} className={inputClass} />
                    </label>
                    <label>
                      <span className="block text-xs font-semibold text-[color:var(--loombus-text-muted)]">ZIP or postal code</span>
                      <input value={postalCode} onChange={(event) => setPostalCode(event.target.value)} className={inputClass} />
                    </label>
                    <label>
                      <span className="block text-xs font-semibold text-[color:var(--loombus-text-muted)]">Country code</span>
                      <input maxLength={2} value={countryCode} onChange={(event) => setCountryCode(event.target.value.toUpperCase())} className={inputClass} />
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={acquireCurrentArea}
                    disabled={locating || working}
                    className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 border border-[color:var(--loombus-border)] px-4 py-2.5 text-sm font-semibold transition motion-reduce:transition-none hover:border-[color:var(--loombus-gold)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--loombus-gold)] disabled:opacity-50"
                  >
                    {locating ? <Loader2 className="animate-spin motion-reduce:animate-none" size={16} /> : <Crosshair size={16} />}
                    {locating ? "Capturing current area" : currentArea ? "Refresh current area" : "Use current area"}
                  </button>

                  {currentArea ? (
                    <p className="mt-3 text-xs leading-5 text-[color:var(--loombus-text-subtle)]">
                      The server will round this captured point before storage.
                    </p>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => void save()}
                    disabled={!currentArea || working}
                    className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 bg-[color:var(--loombus-gold)] px-4 py-2.5 text-sm font-semibold text-[color:var(--loombus-gold-contrast)] transition motion-reduce:transition-none hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--loombus-gold)] disabled:opacity-50"
                  >
                    {working ? <Loader2 className="animate-spin motion-reduce:animate-none" size={16} /> : <MapPin size={16} />}
                    Save approximate area
                  </button>

                  {selected.directLocation ? (
                    <button
                      type="button"
                      onClick={() => void clear()}
                      disabled={working}
                      className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 border border-red-500/30 px-4 py-2.5 text-sm font-semibold text-red-600 transition motion-reduce:transition-none hover:bg-red-500/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:opacity-50 dark:text-red-300"
                    >
                      <Trash2 size={16} /> Clear direct area
                    </button>
                  ) : null}

                  <Link
                    href={selected.href}
                    className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--loombus-gold)] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--loombus-gold)]"
                  >
                    Open original source <ArrowUpRight size={14} />
                  </Link>
                </>
              ) : (
                <p className="mt-3 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                  Select an attributable source that supports a direct location.
                </p>
              )}
            </section>

            <section className="pt-7">
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--loombus-gold)]" />
                <div>
                  <h3 className="font-semibold">Privacy boundary</h3>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                    Local Discovery stores a rounded approximate point. Public search returns distance and area labels, never latitude or longitude. Personal Marketplace and Request locations cannot be promoted to an exact public point.
                  </p>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
