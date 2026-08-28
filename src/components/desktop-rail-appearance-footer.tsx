"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type AppearanceMode = "light" | "system" | "dark";

const APPEARANCE_KEY = "loombus:appearance";
const MODES: AppearanceMode[] = ["light", "system", "dark"];

function isAppearanceMode(value: string | undefined | null): value is AppearanceMode {
  return value === "light" || value === "system" || value === "dark";
}

function readAppearance(): AppearanceMode {
  if (typeof window === "undefined") return "system";
  try {
    const stored = window.localStorage.getItem(APPEARANCE_KEY);
    if (isAppearanceMode(stored)) return stored;
  } catch {}

  const documentMode = document.documentElement.dataset.loombusTheme;
  return isAppearanceMode(documentMode) ? documentMode : "system";
}

function AppearanceGlyph({ mode, size = 18 }: { mode: AppearanceMode; size?: number }) {
  if (mode === "light") return <Sun aria-hidden="true" size={size} strokeWidth={2} />;
  if (mode === "dark") return <Moon aria-hidden="true" size={size} strokeWidth={2} />;
  return <Monitor aria-hidden="true" size={size} strokeWidth={2} />;
}

export function DesktopRailAppearanceFooter() {
  const [appearance, setAppearance] = useState<AppearanceMode>("system");
  const [railAvailable, setRailAvailable] = useState(false);
  const [railOpen, setRailOpen] = useState(true);

  useEffect(() => {
    const sync = () => {
      setRailAvailable(Boolean(document.querySelector(".loombus-desktop-left-rail")));
      setRailOpen(document.body.dataset.loombusDesktopRail !== "closed");
      setAppearance(readAppearance());
    };

    sync();

    const observer = new MutationObserver(sync);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-loombus-desktop-rail"],
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-loombus-theme"],
    });

    window.addEventListener("storage", sync);
    window.addEventListener("loombus:appearance-change", sync);
    return () => {
      observer.disconnect();
      window.removeEventListener("storage", sync);
      window.removeEventListener("loombus:appearance-change", sync);
    };
  }, []);

  const nextAppearance = useMemo(() => {
    const index = MODES.indexOf(appearance);
    return MODES[(index + 1) % MODES.length];
  }, [appearance]);

  function applyAppearance(mode: AppearanceMode) {
    setAppearance(mode);
    document.documentElement.dataset.loombusTheme = mode;
    try {
      window.localStorage.setItem(APPEARANCE_KEY, mode);
    } catch {}
    window.dispatchEvent(new CustomEvent("loombus:appearance-change", { detail: { mode } }));
  }

  if (!railAvailable) return null;

  return (
    <div
      className="loombus-desktop-rail-footer"
      data-open={railOpen ? "true" : "false"}
      onMouseDown={(event) => event.stopPropagation()}
      aria-label="Loombus rail footer"
    >
      {railOpen ? (
        <>
          <div className="loombus-desktop-rail-appearance" role="group" aria-label="Appearance">
            {MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                data-active={appearance === mode ? "true" : "false"}
                onClick={() => applyAppearance(mode)}
                aria-label={`Use ${mode} appearance`}
                aria-pressed={appearance === mode}
                title={mode.charAt(0).toUpperCase() + mode.slice(1)}
              >
                <AppearanceGlyph mode={mode} />
              </button>
            ))}
          </div>
          <p className="loombus-desktop-rail-copyright">© {new Date().getFullYear()} Loombus. All rights reserved.</p>
        </>
      ) : (
        <button
          type="button"
          className="loombus-desktop-rail-collapsed-appearance"
          onClick={() => applyAppearance(nextAppearance)}
          aria-label={`Appearance: ${appearance}. Switch to ${nextAppearance}.`}
          title={`Appearance: ${appearance}`}
        >
          <AppearanceGlyph mode={appearance} size={19} />
        </button>
      )}
    </div>
  );
}
