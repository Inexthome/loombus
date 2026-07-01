export type PublicAppearanceMode = "system" | "dark" | "light";

export const PUBLIC_APPEARANCE_STORAGE_KEY = "loombus:appearance";

export function resolvePublicDarkAppearance() {
  if (typeof window === "undefined") {
    return false;
  }

  const stored = window.localStorage.getItem(PUBLIC_APPEARANCE_STORAGE_KEY);
  const datasetMode = document.documentElement.dataset.loombusTheme;
  const mode: PublicAppearanceMode =
    stored === "dark" || stored === "light" || stored === "system"
      ? stored
      : datasetMode === "dark" || datasetMode === "light" || datasetMode === "system"
        ? datasetMode
        : "system";

  if (mode === "dark") {
    return true;
  }

  if (mode === "light") {
    return false;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}
