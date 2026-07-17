"use client";

import { supabase } from "@/lib/supabase/client";

export async function getMarketplaceAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error("Unable to verify your Loombus session.");
  }
  return data.session?.access_token ?? "";
}

export async function marketplaceAuthorizedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: { redirectTo?: string } = {}
) {
  const accessToken = await getMarketplaceAccessToken();
  if (!accessToken) {
    if (options.redirectTo && typeof window !== "undefined") {
      window.location.href = `/login?next=${encodeURIComponent(options.redirectTo)}`;
    }
    throw new Error("Sign in to use Loombus Marketplace.");
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);

  return fetch(input, {
    ...init,
    headers,
  });
}
