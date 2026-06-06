"use client";

import { useState } from "react";
import { isIosNativeApp } from "@/lib/native-app";
import { supabase } from "@/lib/supabase/client";

type CdvPurchaseWindow = Window & {
  CdvPurchase?: {
    store?: {
      manageSubscriptions?: () => Promise<void> | void;
    };
  };
};

async function openAppleSubscriptionManagement() {
  const store = (window as CdvPurchaseWindow).CdvPurchase?.store;

  if (store?.manageSubscriptions) {
    await store.manageSubscriptions();
    return;
  }

  window.location.href = "https://apps.apple.com/account/subscriptions";
}

export function BillingPortalButton({
  children = "Manage billing",
  variant = "primary",
}: {
  children?: React.ReactNode;
  variant?: "primary" | "secondary";
}) {
  const [openingPortal, setOpeningPortal] = useState(false);
  const [message, setMessage] = useState("");

  async function openBillingPortal() {
    if (openingPortal) {
      return;
    }

    setOpeningPortal(true);
    setMessage("");

    if (isIosNativeApp()) {
      try {
        await openAppleSubscriptionManagement();
        setMessage(
          "Apple subscription management opened. You can view renewal status, receipts, or cancel from your Apple ID subscriptions."
        );
      } catch {
        setMessage(
          "Unable to open Apple subscription management. Open Settings, tap your Apple ID, then Subscriptions to manage or cancel."
        );
      } finally {
        setOpeningPortal(false);
      }

      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      window.location.href = "/login";
      return;
    }

    try {
      const response = await fetch("/api/billing/create-portal-session", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.url) {
        setMessage(result.error ?? "Unable to open billing portal.");
        setOpeningPortal(false);
        return;
      }

      window.location.href = result.url;
    } catch {
      setMessage("Unable to open billing portal.");
      setOpeningPortal(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={openBillingPortal}
        disabled={openingPortal}
        className={
          variant === "secondary"
            ? "inline-flex rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
            : "inline-flex rounded-full bg-white px-5 py-3 text-sm text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
        }
      >
        {openingPortal ? "Opening billing..." : children}
      </button>

      {message && (
        <p className="max-w-sm text-xs leading-relaxed text-zinc-500">
          {message}
        </p>
      )}
    </div>
  );
}
