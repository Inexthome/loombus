"use client";

import { supabase } from "@/lib/supabase/client";

export async function scheduleAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error("Unable to verify your Loombus session.");
  return data.session?.access_token ?? "";
}

function navigateFromAuthorizedResponse(response: Response) {
  if (typeof window === "undefined") return;
  const rawTarget = response.headers.get("X-Loombus-Navigate-To");
  if (!rawTarget) return;

  try {
    const target = new URL(rawTarget, window.location.origin);
    const sameOrigin = target.origin === window.location.origin;
    const stripeCheckout =
      target.protocol === "https:" && target.hostname === "checkout.stripe.com";
    if (sameOrigin || stripeCheckout) {
      window.location.assign(target.toString());
    }
  } catch {
    // Ignore malformed or unapproved navigation targets.
  }
}

export async function scheduleAuthorizedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  redirectTo?: string
) {
  const token = await scheduleAccessToken();
  if (!token) {
    if (redirectTo && typeof window !== "undefined") {
      window.location.href = `/login?next=${encodeURIComponent(redirectTo)}`;
    }
    throw new Error("Sign in to continue.");
  }
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(input, { ...init, headers });
  navigateFromAuthorizedResponse(response);
  return response;
}
