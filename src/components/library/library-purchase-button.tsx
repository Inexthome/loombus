"use client";

import { Capacitor } from "@capacitor/core";
import { Loader2, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export function LibraryPurchaseButton({
  publicationId,
  priceCents,
  currency,
  checkoutSessionId,
  onPurchased,
}: {
  publicationId: string;
  priceCents: number;
  currency: string;
  checkoutSessionId?: string | null;
  onPurchased: () => void | Promise<void>;
}) {
  const [busyMode, setBusyMode] = useState<"checkout" | "verify" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    if (!checkoutSessionId) return;
    let cancelled = false;

    async function finalize() {
      setBusyMode("verify");
      setError(null);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        if (!cancelled) {
          setError("Sign in again to verify this purchase.");
          setBusyMode(null);
        }
        return;
      }

      const response = await fetch("/api/library/checkout/finalize", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: checkoutSessionId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (cancelled) return;
      if (!response.ok) {
        setError(payload.error ?? "Unable to verify this purchase.");
        setBusyMode(null);
        return;
      }
      await onPurchased();
      setBusyMode(null);
    }

    void finalize();
    return () => { cancelled = true; };
  }, [checkoutSessionId, onPurchased]);

  async function beginCheckout() {
    if (isNative) {
      setError("Library book purchases are currently available on Loombus.com. Purchases made on the web will appear here after you sign in with the same Loombus account.");
      return;
    }

    setBusyMode("checkout");
    setError(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      window.location.assign(`/login?next=/library/publication/${encodeURIComponent(publicationId)}`);
      return;
    }

    const response = await fetch("/api/library/checkout", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ publicationId }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.url) {
      setError(payload.error ?? "Unable to start Library checkout.");
      setBusyMode(null);
      return;
    }
    window.location.assign(payload.url);
  }

  const formatted = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "USD",
  }).format(priceCents / 100);

  const busy = busyMode !== null;
  const label = busyMode === "verify"
    ? "Verifying purchase…"
    : busyMode === "checkout"
      ? "Preparing checkout…"
      : isNative
        ? `Buy ${formatted} on Loombus.com`
        : `Buy ${formatted}`;

  return (
    <div>
      <button
        type="button"
        disabled={busy}
        onClick={() => void beginCheckout()}
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--loombus-gold)] px-5 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ShoppingBag className="h-4 w-4" aria-hidden="true" />}
        {label}
      </button>
      {error ? <p role="alert" className="mt-2 max-w-md text-xs leading-5 text-[var(--loombus-text-muted)]">{error}</p> : null}
    </div>
  );
}
