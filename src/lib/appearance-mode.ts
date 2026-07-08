export const APPEARANCE_STORAGE_KEY = "loombus:appearance";
export const APPEARANCE_THEME_DATASET_KEY = "loombusTheme";
export const APPEARANCE_CHANGED_EVENT = "loombus:appearance-changed";

export const APPEARANCE_MODES = ["system", "dark", "light"] as const;

export type AppearanceMode = (typeof APPEARANCE_MODES)[number];

export type AppearanceChangedEventDetail = {
  mode: AppearanceMode;
};

export const DEFAULT_APPEARANCE_MODE: AppearanceMode = "system";

export function isAppearanceMode(value: string | null | undefined): value is AppearanceMode {
  return APPEARANCE_MODES.some((mode) => mode === value);
}

export function resolveAppearanceMode(
  value: string | null | undefined
): AppearanceMode {
  return isAppearanceMode(value) ? value : DEFAULT_APPEARANCE_MODE;
}

export function getStoredAppearanceMode(
  storage: Pick<Storage, "getItem"> | null | undefined
): AppearanceMode {
  if (!storage) {
    return DEFAULT_APPEARANCE_MODE;
  }

  try {
    return resolveAppearanceMode(storage.getItem(APPEARANCE_STORAGE_KEY));
  } catch {
    return DEFAULT_APPEARANCE_MODE;
  }
}

export function setStoredAppearanceMode(
  mode: AppearanceMode,
  storage: Pick<Storage, "setItem"> | null | undefined
) {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(APPEARANCE_STORAGE_KEY, mode);
  } catch {
    // Ignore storage failures so appearance changes can still apply in memory.
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

export function getAppearanceModeFromStorageEvent(
  event: Pick<StorageEvent, "key" | "newValue">
): AppearanceMode | null {
  if (event.key !== APPEARANCE_STORAGE_KEY) {
    return null;
  }

  return resolveAppearanceMode(event.newValue);
}

export function dispatchAppearanceChangedEvent(mode: AppearanceMode) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<AppearanceChangedEventDetail>(APPEARANCE_CHANGED_EVENT, {
      detail: { mode },
    })
  );
}

export function syncBrowserAppearanceMode(mode: AppearanceMode) {
  if (typeof window !== "undefined") {
    setStoredAppearanceMode(mode, window.localStorage);
  }

  applyAppearanceMode(mode);
  dispatchAppearanceChangedEvent(mode);
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
