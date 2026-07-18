"use client";

import { supabase } from "@/lib/supabase/client";

export async function providerServicesAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error("Unable to verify your Loombus session.");
  return data.session?.access_token ?? "";
}

export async function providerServicesAuthorizedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  redirectTo?: string,
) {
  const token = await providerServicesAccessToken();
  if (!token) {
    if (redirectTo && typeof window !== "undefined") {
      window.location.href = `/login?next=${encodeURIComponent(redirectTo)}`;
    }
    throw new Error("Sign in to continue.");
  }
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
