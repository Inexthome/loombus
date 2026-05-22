"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

type PremiumPlanCheckoutButtonProps = {
  planKey: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
};

export function PremiumPlanCheckoutButton({
  planKey,
  children,
  variant = "primary",
}: PremiumPlanCheckoutButtonProps) {
  const [message, setMessage] = useState("");
  const [startingCheckout, setStartingCheckout] = useState(false);

  async function startCheckout() {
    setMessage("");

    if (startingCheckout) return;

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
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ planKey }),
        signal: controller.signal,
      });

      window.clearTimeout(timeoutId);

      const result = await response.json().catch(() => ({
        error: "Checkout returned an unreadable response.",
      }));

      if (!response.ok) {
        setMessage(
          result.detail
            ? `${result.error ?? "Unable to start Premium checkout."} ${result.detail}`
            : result.error ?? "Unable to start Premium checkout."
        );
        return;
      }

      if (!result.url) {
        setMessage("Checkout URL was not returned.");
        return;
      }

      window.location.href = result.url;
    } catch (error) {
      const errorMessage =
        error instanceof DOMException && error.name === "AbortError"
          ? "Checkout request timed out. Please try again, and check the Stripe/Vercel configuration if it continues."
          : error instanceof Error
            ? error.message
            : "Unable to start Premium checkout.";

      setMessage(errorMessage);
    } finally {
      setStartingCheckout(false);
    }
  }

  const buttonClass =
    variant === "primary"
      ? "inline-flex rounded-full bg-white px-5 py-3 text-sm text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
      : "inline-flex rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700";

  return (
    <div>
      <button
        type="button"
        onClick={startCheckout}
        disabled={startingCheckout}
        className={buttonClass}
      >
        {startingCheckout ? "Starting checkout..." : children}
      </button>

      {message && (
        <p className="mt-4 max-w-md text-sm text-zinc-500">
          {message}
        </p>
      )}
    </div>
  );
}
