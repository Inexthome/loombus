export const APPEARANCE_STORAGE_KEY = "loombus:appearance";
export const APPEARANCE_THEME_DATASET_KEY = "loombusTheme";

export const APPEARANCE_MODES = ["system", "dark", "light"] as const;

export type AppearanceMode = (typeof APPEARANCE_MODES)[number];

export const DEFAULT_APPEARANCE_MODE: AppearanceMode = "system";

export function isAppearanceMode(value: string | null): value is AppearanceMode {
  return APPEARANCE_MODES.some((mode) => mode === value);
}

export function getStoredAppearanceMode(
  storage: Pick<Storage, "getItem"> | null | undefined
): AppearanceMode {
  if (!storage) {
    return DEFAULT_APPEARANCE_MODE;
  }

  try {
    const stored = storage.getItem(APPEARANCE_STORAGE_KEY);

    return isAppearanceMode(stored) ? stored : DEFAULT_APPEARANCE_MODE;
  } catch {
    return DEFAULT_APPEARANCE_MODE;
  }
}

export function getBrowserAppearanceMode(): AppearanceMode {
  if (typeof window === "undefined") {
    return DEFAULT_APPEARANCE_MODE;
  }

  return getStoredAppearanceMode(window.localStorage);
}

export function applyAppearanceMode(mode: AppearanceMode) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset[APPEARANCE_THEME_DATASET_KEY] = mode;
}

export function getAppearanceBootstrapScript() {
  return `
    (() => {
      try {
        const stored = window.localStorage.getItem(${JSON.stringify(APPEARANCE_STORAGE_KEY)});
        const allowed = ${JSON.stringify(APPEARANCE_MODES)};
        const mode = allowed.includes(stored || "")
          ? stored
          : ${JSON.stringify(DEFAULT_APPEARANCE_MODE)};
        document.documentElement.dataset[${JSON.stringify(APPEARANCE_THEME_DATASET_KEY)}] =
          mode || ${JSON.stringify(DEFAULT_APPEARANCE_MODE)};
      } catch {
        document.documentElement.dataset[${JSON.stringify(APPEARANCE_THEME_DATASET_KEY)}] =
          ${JSON.stringify(DEFAULT_APPEARANCE_MODE)};
      }
    })();
  `;
}
