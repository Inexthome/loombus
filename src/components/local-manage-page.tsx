"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
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

type CurrentArea = { latitude: number; longitude: number };

const inputClass =
  "h-12 w-full rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] px-4 text-sm text-[color:var(--loombus-text)] outline-none transition placeholder:text-[color:var(--loombus-text-subtle)] focus:border-[color:var(--loombus-gold)] focus:ring-4 focus:ring-[color:var(--loombus-gold-soft)]";

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

  function acquireCurrentArea() {
    if (!navigator.geolocation) {
      setNotice("This browser does not provide current-location access.");
      return;
    }
    setLocating(true);
    setNotice("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentArea({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocating(false);
        setNotice(
          "Current area captured. Loombus will store a rounded approximate point, not the browser's exact coordinate.",
        );
      },
      () => {
        setLocating(false);
        setNotice(
          "Current location was not shared. Browser location permission is required to create a distance-search anchor.",
        );
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
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
        throw new Error(
          payload.error ?? "Unable to save the Local Discovery area.",
        );
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
        throw new Error(
          payload.error ?? "Unable to clear the Local Discovery area.",
        );
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
    <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[88rem]">
        <header className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">
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
              className="inline-flex h-12 items-center gap-2 rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-4 text-sm font-semibold shadow-sm transition hover:border-[color:var(--loombus-gold)] disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
            <Link
              href="/local"
              className="inline-flex h-12 items-center gap-2 rounded-2xl bg-[color:var(--loombus-gold)] px-4 text-sm font-semibold text-[color:var(--loombus-gold-contrast)] transition hover:opacity-90"
            >
              Open Local <ArrowUpRight size={16} />
            </Link>
          </div>
        </header>

        <section className="mb-6 grid gap-3 sm:grid-cols-4">
          <article className="rounded-[1.4rem] border border-[color:var(--loombus-gold)] bg-[color:var(--loombus-cream)] p-4 text-[color:var(--loombus-cream-contrast)] shadow-sm dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-text)]">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-gold)]">Public sources</span>
            <strong className="mt-2 block text-3xl tracking-[-0.04em]">{items.length}</strong>
          </article>
          <article className="rounded-[1.4rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">Direct areas</span>
            <strong className="mt-2 block text-3xl tracking-[-0.04em]">{directCount}</strong>
          </article>
          <article className="rounded-[1.4rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">Inherited areas</span>
            <strong className="mt-2 block text-3xl tracking-[-0.04em]">{inheritedCount}</strong>
          </article>
          <article className="rounded-[1.4rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">Direct-capable</span>
            <strong className="mt-2 block text-3xl tracking-[-0.04em]">{configurableCount}</strong>
          </article>
        </section>

        {notice ? (
          <div className="mb-6 rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 text-sm shadow-sm" role="status">
            {notice}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
          <section className="min-w-0 rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-xl shadow-black/10 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Attributable sources</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">Choose a source</h2>
                <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                  Select a source to review its current discovery area or capture a new approximate anchor.
                </p>
              </div>
              <span className="rounded-full border border-[color:var(--loombus-border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--loombus-text-muted)]">
                {items.length} source{items.length === 1 ? "" : "s"}
              </span>
            </div>

            {loading ? (
              <div className="grid min-h-64 place-items-center text-[color:var(--loombus-text-muted)]">
                <span className="inline-flex items-center gap-2 text-sm font-semibold"><Loader2 className="animate-spin text-[color:var(--loombus-gold)]" size={20} /> Loading sources</span>
              </div>
            ) : items.length === 0 ? (
              <div className="mt-6 rounded-[1.5rem] border border-dashed border-[color:var(--loombus-border)] p-10 text-center">
                <MapPin className="mx-auto text-[color:var(--loombus-gold)]" size={40} />
                <h3 className="mt-4 text-xl font-semibold">No public real-world sources yet</h3>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                  Publish a Business, Service, Event, Job, Marketplace listing, or Request first.
                </p>
              </div>
            ) : (
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {items.map((item) => {
                  const key = `${item.sourceTable}:${item.id}`;
                  const active = key === selectedId;
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={!item.canSetDirect}
                      onClick={() => setSelectedId(key)}
                      className={`group min-h-[190px] rounded-[1.4rem] border p-5 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        active
                          ? "border-[color:var(--loombus-gold)] bg-[color:var(--loombus-cream)] text-[color:var(--loombus-cream-contrast)] shadow-lg dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-text)]"
                          : "border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] hover:border-[color:var(--loombus-gold)]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                          <span className="rounded-full border border-current/20 px-2.5 py-1">{localDiscoveryTypeLabel(item.entityType)}</span>
                          {item.directLocation ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-current/20 px-2.5 py-1"><CheckCircle2 size={12} /> Direct area</span>
                          ) : item.inheritedLocation ? (
                            <span className="rounded-full border border-current/20 px-2.5 py-1">Inherited</span>
                          ) : (
                            <span className="rounded-full border border-current/20 px-2.5 py-1">Area needed</span>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-[color:var(--loombus-gold)] transition group-hover:translate-x-0.5" />
                      </div>
                      <strong className="mt-4 block text-lg tracking-[-0.02em]">{item.title}</strong>
                      <span className="mt-2 block text-sm leading-6 opacity-75">{item.locationLabel}</span>
                      {!item.canSetDirect ? (
                        <span className="mt-3 block text-xs opacity-65">This source follows its Business location.</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="space-y-5 xl:sticky xl:top-28 xl:self-start">
            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <p className="text-xs font-bold uppercase tracking-[0.3em]">Approximate area</p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.025em]">{selected?.title ?? "Select a source"}</h2>
              {selected ? (
                <>
                  <div className="mt-4 grid gap-3">
                    <label><span className="mb-2 block text-sm font-semibold">City</span><input value={city} onChange={(event) => setCity(event.target.value)} className={inputClass} /></label>
                    <label><span className="mb-2 block text-sm font-semibold">State or region</span><input value={region} onChange={(event) => setRegion(event.target.value)} className={inputClass} /></label>
                    <label><span className="mb-2 block text-sm font-semibold">ZIP or postal code</span><input value={postalCode} onChange={(event) => setPostalCode(event.target.value)} className={inputClass} /></label>
                    <label><span className="mb-2 block text-sm font-semibold">Country code</span><input maxLength={2} value={countryCode} onChange={(event) => setCountryCode(event.target.value.toUpperCase())} className={inputClass} /></label>
                  </div>
                  <button type="button" onClick={acquireCurrentArea} disabled={locating || working} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[color:var(--loombus-border)] px-4 py-3 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] disabled:opacity-50">
                    {locating ? <Loader2 className="animate-spin" size={16} /> : <Crosshair size={16} />}
                    {locating ? "Capturing current area" : currentArea ? "Refresh current area" : "Use current area"}
                  </button>
                  {currentArea ? <p className="mt-3 text-xs leading-5 text-[color:var(--loombus-text-subtle)]">The server will round this captured point before storage.</p> : null}
                  <button type="button" onClick={() => void save()} disabled={!currentArea || working} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[color:var(--loombus-gold)] px-4 py-3 text-sm font-semibold text-[color:var(--loombus-gold-contrast)] transition hover:opacity-90 disabled:opacity-50">
                    {working ? <Loader2 className="animate-spin" size={16} /> : <MapPin size={16} />} Save approximate area
                  </button>
                  {selected.directLocation ? (
                    <button type="button" onClick={() => void clear()} disabled={working} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/30 px-4 py-3 text-sm font-semibold text-red-600 disabled:opacity-50 dark:text-red-300"><Trash2 size={16} /> Clear direct area</button>
                  ) : null}
                  <Link href={selected.href} className="mt-3 flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]">Open original source <ArrowUpRight size={14} className="text-[color:var(--loombus-gold)]" /></Link>
                </>
              ) : (
                <p className="mt-3 text-sm leading-6 text-[color:var(--loombus-text-muted)]">Select an attributable source that supports a direct location.</p>
              )}
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <div className="flex gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[color:var(--loombus-cream)] text-[color:var(--loombus-gold)] dark:bg-[color:var(--loombus-gold-soft)]"><ShieldCheck size={18} /></span>
                <div>
                  <h3 className="font-semibold">Privacy boundary</h3>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">Local Discovery stores a rounded approximate point. Public search returns distance and area labels, never latitude or longitude. Personal Marketplace and Request locations cannot be promoted to an exact public point.</p>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
