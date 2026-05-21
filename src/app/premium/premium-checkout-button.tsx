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

      const response = await fetch("/api/billing/create-checkout-session", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error ?? "Unable to start Premium checkout.");
        return;
      }

      if (!result.url) {
        setMessage("Checkout URL was not returned.");
        return;
      }

      window.location.href = result.url;
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
