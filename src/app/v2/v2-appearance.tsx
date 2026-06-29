"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { V2AppearanceStyles } from "./v2-appearance-styles";

export type V2AppearanceTheme = "light" | "dark" | "system";

export const V2_APPEARANCE_STORAGE_KEY = "loombus:v2:appearance";
export const V2_DEFAULT_APPEARANCE: V2AppearanceTheme = "light";

export const V2_APPEARANCE_OPTIONS: Array<{
  key: V2AppearanceTheme;
  label: string;
  description: string;
}> = [
  { key: "light", label: "Light", description: "Clean light appearance." },
  { key: "dark", label: "Dark", description: "Dark appearance with gold accents." },
  { key: "system", label: "System", description: "Follow your device or browser setting." },
];

export function isV2AppearanceTheme(value: unknown): value is V2AppearanceTheme {
  return value === "light" || value === "dark" || value === "system";
}

function getSystemResolvedAppearance(theme: V2AppearanceTheme) {
  if (theme !== "system") return theme;
  if (typeof window === "undefined") return V2_DEFAULT_APPEARANCE;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyV2Appearance(theme: V2AppearanceTheme) {
  if (typeof document === "undefined") return;
  const resolvedTheme = getSystemResolvedAppearance(theme);
  document.documentElement.dataset.v2AppearanceChoice = theme;
  document.documentElement.dataset.v2Appearance = resolvedTheme;
  document.body.dataset.v2AppearanceChoice = theme;
  document.body.dataset.v2Appearance = resolvedTheme;
}

export function getStoredV2Appearance() {
  if (typeof window === "undefined") return V2_DEFAULT_APPEARANCE;
  const storedTheme = window.localStorage.getItem(V2_APPEARANCE_STORAGE_KEY);
  return isV2AppearanceTheme(storedTheme) ? storedTheme : V2_DEFAULT_APPEARANCE;
}

async function persistSignedInV2Appearance(theme: V2AppearanceTheme) {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) return;
  await fetch("/api/v2/appearance", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ appearance_theme: theme }),
  });
}

export function setV2AppearancePreference(theme: V2AppearanceTheme) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(V2_APPEARANCE_STORAGE_KEY, theme);
  }
  applyV2Appearance(theme);
  window.dispatchEvent(new CustomEvent("loombus:v2-appearance-changed", { detail: { theme } }));
  void persistSignedInV2Appearance(theme);
}

export function V2AppearanceProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    applyV2Appearance(getStoredV2Appearance());

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    function handleSystemChange() {
      if (getStoredV2Appearance() === "system") applyV2Appearance("system");
    }
    mediaQuery.addEventListener("change", handleSystemChange);

    async function loadSignedInPreference() {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) return;
      const response = await fetch("/api/v2/shell", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);
      const nextTheme = payload?.preferences?.appearance_theme;
      if (isV2AppearanceTheme(nextTheme)) {
        window.localStorage.setItem(V2_APPEARANCE_STORAGE_KEY, nextTheme);
        applyV2Appearance(nextTheme);
        window.dispatchEvent(new CustomEvent("loombus:v2-appearance-changed", { detail: { theme: nextTheme } }));
      }
    }
    void loadSignedInPreference();

    return () => mediaQuery.removeEventListener("change", handleSystemChange);
  }, [pathname]);

  return (
    <>
      <V2AppearanceStyles />
      {children}
    </>
  );
}
