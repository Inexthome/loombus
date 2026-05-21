"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

export function PremiumCheckoutButton() {
  const [message, setMessage] = useState("");
  const [startingCheckout, setStartingCheckout] = useState(false);

  async function startCheckout() {
    setMessage("");

    if (startingCheckout) {
      return;
    }

    setStartingCheckout(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        window.location.href = "/login";
        return;
      }

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 20000);

      const response = await fetch("/api/billing/create-checkout-session", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        signal: controller.signal,
      });

      window.clearTimeout(timeoutId);

      const result = await response.json().catch(() => ({
        error: "Checkout returned an unreadable response.",
      }));

      if (!response.ok) {
        setMessage(result.error ?? "Unable to start Premium checkout.");
        return;
      }

      if (!result.url) {
        setMessage("Checkout URL was not returned.");
        return;
      }

      window.location.href = result.url;
    } catch (error) {
      const message =
        error instanceof DOMException && error.name === "AbortError"
          ? "Checkout request timed out. Please try again, and check the Stripe/Vercel configuration if it continues."
          : error instanceof Error
            ? error.message
            : "Unable to start Premium checkout.";

      setMessage(message);
    } finally {
      setStartingCheckout(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={startCheckout}
        disabled={startingCheckout}
        className="rounded-full border border-zinc-600 px-5 py-3 text-sm text-zinc-200 transition hover:border-zinc-400 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
      >
        {startingCheckout ? "Starting checkout..." : "Start Premium checkout"}
      </button>

      {message && (
        <p className="mt-4 max-w-md text-sm text-zinc-500">
          {message}
        </p>
      )}
    </div>
  );
}
