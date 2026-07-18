"use client";

import Link from "next/link";
import {
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

type CurrentArea = { latitude: number; longitude: number };

const inputClass =
  "w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3";

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
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 py-8 text-[var(--loombus-text)] sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--loombus-text-subtle)]">
                Local location control
              </p>
              <h1 className="mt-2 text-4xl font-semibold">
                Make attributable sources discoverable by distance.
              </h1>
              <p className="mt-3 leading-7 text-[var(--loombus-text-muted)]">
                Choose one of your public sources and attach a privacy-safe
                approximate area. A Business location is inherited by connected
                Jobs, Services, Events, Requests, and Marketplace listings unless
                a source has its own direct area.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/local"
                className="rounded-full border border-[var(--loombus-border)] px-5 py-3 text-sm font-semibold"
              >
                Open Loombus Local
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
            role="status"
          >
            {notice}
          </div>
        ) : null}

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]">
                  Your public sources
                </p>
                <h2 className="mt-1 text-2xl font-semibold">Choose a source</h2>
              </div>
              <span className="rounded-full border border-[var(--loombus-border)] px-3 py-1 text-xs font-semibold">
                {items.length} sources
              </span>
            </div>

            {loading ? (
              <div className="py-12 text-center text-[var(--loombus-text-muted)]">
                <Loader2 className="mx-auto animate-spin" size={28} />
                <p className="mt-3">Loading sources…</p>
              </div>
            ) : items.length === 0 ? (
              <div className="py-12 text-center">
                <MapPin
                  className="mx-auto text-[var(--loombus-text-subtle)]"
                  size={40}
                />
                <h3 className="mt-4 text-xl font-semibold">
                  No public real-world sources yet.
                </h3>
                <p className="mt-2 text-sm text-[var(--loombus-text-muted)]">
                  Publish a Business, Service, Event, Job, Marketplace listing,
                  or Request first.
                </p>
              </div>
            ) : (
              <div className="mt-5 grid gap-3">
                {items.map((item) => {
                  const key = `${item.sourceTable}:${item.id}`;
                  const active = key === selectedId;
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={!item.canSetDirect}
                      onClick={() => setSelectedId(key)}
                      className={`rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        active
                          ? "border-[var(--loombus-text)] bg-[var(--loombus-surface-muted)]"
                          : "border-[var(--loombus-border)] bg-[var(--loombus-page-bg)]"
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                        <span className="rounded-full border border-[var(--loombus-border)] px-2.5 py-1">
                          {localDiscoveryTypeLabel(item.entityType)}
                        </span>
                        {item.directLocation ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--loombus-border)] px-2.5 py-1">
                            <CheckCircle2 size={12} /> Direct area
                          </span>
                        ) : item.inheritedLocation ? (
                          <span className="rounded-full border border-[var(--loombus-border)] px-2.5 py-1">
                            Inherited from Business
                          </span>
                        ) : null}
                      </div>
                      <strong className="mt-3 block text-lg">{item.title}</strong>
                      <span className="mt-2 block text-sm text-[var(--loombus-text-muted)]">
                        {item.locationLabel}
                      </span>
                      {!item.canSetDirect ? (
                        <span className="mt-2 block text-xs text-[var(--loombus-text-subtle)]">
                          This source follows its Business location.
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <aside className="space-y-5">
            <section className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]">
                Approximate area
              </p>
              <h2 className="mt-1 text-xl font-semibold">
                {selected?.title ?? "Select a source"}
              </h2>
              {selected ? (
                <>
                  <div className="mt-4 grid gap-3">
                    <label>
                      <span className="mb-2 block text-sm font-semibold">City</span>
                      <input
                        value={city}
                        onChange={(event) => setCity(event.target.value)}
                        className={inputClass}
                      />
                    </label>
                    <label>
                      <span className="mb-2 block text-sm font-semibold">
                        State or region
                      </span>
                      <input
                        value={region}
                        onChange={(event) => setRegion(event.target.value)}
                        className={inputClass}
                      />
                    </label>
                    <label>
                      <span className="mb-2 block text-sm font-semibold">
                        ZIP or postal code
                      </span>
                      <input
                        value={postalCode}
                        onChange={(event) => setPostalCode(event.target.value)}
                        className={inputClass}
                      />
                    </label>
                    <label>
                      <span className="mb-2 block text-sm font-semibold">
                        Country code
                      </span>
                      <input
                        maxLength={2}
                        value={countryCode}
                        onChange={(event) =>
                          setCountryCode(event.target.value.toUpperCase())
                        }
                        className={inputClass}
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={acquireCurrentArea}
                    disabled={locating || working}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border border-[var(--loombus-border)] px-5 py-3 text-sm font-semibold disabled:opacity-50"
                  >
                    {locating ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <Crosshair size={16} />
                    )}
                    {locating
                      ? "Capturing current area…"
                      : currentArea
                        ? "Refresh current area"
                        : "Use current area"}
                  </button>
                  {currentArea ? (
                    <p className="mt-3 text-xs leading-5 text-[var(--loombus-text-subtle)]">
                      Current area captured for this save. The server will round
                      it before storage.
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void save()}
                    disabled={!currentArea || working}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--loombus-primary-bg)] px-5 py-3 text-sm font-semibold text-[var(--loombus-primary-text)] disabled:opacity-50"
                  >
                    {working ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <MapPin size={16} />
                    )}
                    Save approximate area
                  </button>
                  {selected.directLocation ? (
                    <button
                      type="button"
                      onClick={() => void clear()}
                      disabled={working}
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-[var(--loombus-border)] px-5 py-3 text-sm font-semibold disabled:opacity-50"
                    >
                      <Trash2 size={16} /> Clear direct area
                    </button>
                  ) : null}
                  <Link
                    href={selected.href}
                    className="mt-3 block text-center text-sm font-semibold underline"
                  >
                    Open original source
                  </Link>
                </>
              ) : (
                <p className="mt-3 text-sm text-[var(--loombus-text-muted)]">
                  Select an attributable source that supports a direct location.
                </p>
              )}
            </section>

            <section className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} />
                <strong>Privacy boundary</strong>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--loombus-text-muted)]">
                Local Discovery stores a rounded approximate point. Public search
                responses return only distance and area labels, never latitude or
                longitude. Personal Marketplace and Request locations cannot be
                promoted to an exact public point.
              </p>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
