"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import {
  APPEARANCE_CHANGED_EVENT,
  APPEARANCE_STORAGE_KEY,
  type AppearanceMode,
  applyAppearanceMode,
  getStoredAppearanceMode,
  isAppearanceMode,
  setStoredAppearanceMode,
  syncBrowserAppearanceMode,
} from "@/lib/appearance-mode";
import { V2AppearanceStyle } from "./v2-appearance-style";
import { V2BadgeStyle } from "./v2-badge-style";
import { V2NavigationConsistencyStyle } from "./v2-navigation-consistency-style";

export type V2AppearanceTheme = AppearanceMode;

/**
 * Legacy V2 key kept only as a read/write bridge while the remaining V2 islands
 * migrate to the canonical Loombus appearance owner in `@/lib/appearance-mode`.
 */
export const V2_APPEARANCE_STORAGE_KEY = "loombus:v2:appearance";
export const V2_DEFAULT_APPEARANCE: V2AppearanceTheme = "system";

export const V2_APPEARANCE_OPTIONS: Array<{
  key: V2AppearanceTheme;
  label: string;
  description: string;
}> = [
  { key: "light", label: "Light", description: "Neutral light background, dark text." },
  { key: "dark", label: "Dark", description: "True dark background, light text." },
  { key: "system", label: "System", description: "Follow your device or browser setting." },
];

export function isV2AppearanceTheme(value: unknown): value is V2AppearanceTheme {
  return typeof value === "string" && isAppearanceMode(value);
}

function getStoredV2AppearanceRaw() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(V2_APPEARANCE_STORAGE_KEY);
}

function getCanonicalAppearanceRaw() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
}

function bridgeLegacyV2Appearance(theme: V2AppearanceTheme) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(V2_APPEARANCE_STORAGE_KEY, theme);
  } catch {
    // Ignore storage failures so the canonical appearance owner can still apply.
  }

  window.dispatchEvent(
    new CustomEvent("loombus:v2-appearance-changed", { detail: { theme } })
  );
}

export function applyV2Appearance(theme: V2AppearanceTheme) {
  applyAppearanceMode(theme);
}

export function getStoredV2Appearance(): V2AppearanceTheme {
  if (typeof window === "undefined") return V2_DEFAULT_APPEARANCE;

  const canonical = getCanonicalAppearanceRaw();
  if (isAppearanceMode(canonical)) return canonical;

  const legacyV2 = getStoredV2AppearanceRaw();
  if (isV2AppearanceTheme(legacyV2)) {
    setStoredAppearanceMode(legacyV2, window.localStorage);
    return legacyV2;
  }

  return getStoredAppearanceMode(window.localStorage);
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
  syncBrowserAppearanceMode(theme);
  bridgeLegacyV2Appearance(theme);
  void persistSignedInV2Appearance(theme);
}

export function V2AppearanceProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    function applyStoredPreference() {
      const theme = getStoredV2Appearance();
      applyV2Appearance(theme);
      bridgeLegacyV2Appearance(theme);
    }

    applyStoredPreference();

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    function handleSystemChange() {
      if (getStoredV2Appearance() === "system") applyV2Appearance("system");
    }

    function handleCanonicalAppearanceEvent(event: Event) {
      const mode = (event as CustomEvent<{ mode?: unknown }>).detail?.mode;
      if (isV2AppearanceTheme(mode)) {
        applyV2Appearance(mode);
        bridgeLegacyV2Appearance(mode);
      }
    }

    function handleLegacyAppearanceEvent(event: Event) {
      const theme = (event as CustomEvent<{ theme?: unknown }>).detail?.theme;
      if (isV2AppearanceTheme(theme)) setV2AppearancePreference(theme);
    }

    function handleStorageEvent(event: StorageEvent) {
      if (
        event.key !== APPEARANCE_STORAGE_KEY &&
        event.key !== V2_APPEARANCE_STORAGE_KEY
      ) {
        return;
      }
      applyStoredPreference();
    }

    mediaQuery.addEventListener("change", handleSystemChange);
    window.addEventListener(APPEARANCE_CHANGED_EVENT, handleCanonicalAppearanceEvent as EventListener);
    window.addEventListener("loombus:v2-appearance-changed", handleLegacyAppearanceEvent as EventListener);
    window.addEventListener("storage", handleStorageEvent);

    async function loadSignedInPreference() {
      // Settings writes the user's choice to localStorage immediately. Do not let a
      // stale /api/v2/shell response on the next route override that same-tab choice.
      if (isAppearanceMode(getCanonicalAppearanceRaw()) || isV2AppearanceTheme(getStoredV2AppearanceRaw())) return;

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
        setV2AppearancePreference(nextTheme);
      }
    }
    void loadSignedInPreference();

    return () => {
      mediaQuery.removeEventListener("change", handleSystemChange);
      window.removeEventListener(APPEARANCE_CHANGED_EVENT, handleCanonicalAppearanceEvent as EventListener);
      window.removeEventListener("loombus:v2-appearance-changed", handleLegacyAppearanceEvent as EventListener);
      window.removeEventListener("storage", handleStorageEvent);
    };
  }, [pathname]);

  return (
    <>
      <V2AppearanceStyle />
      <V2BadgeStyle />
      <V2NavigationConsistencyStyle />
      {children}
    </>
  );
}
