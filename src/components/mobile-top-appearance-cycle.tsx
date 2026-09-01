"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type AppearanceMode = "light" | "system" | "dark";

const APPEARANCE_STORAGE_KEY = "loombus:appearance";
const APPEARANCE_ORDER: readonly AppearanceMode[] = ["light", "system", "dark"];

function readAppearance(): AppearanceMode {
  try {
    const stored = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
    if (stored === "light" || stored === "system" || stored === "dark") return stored;
  } catch {
    // Fall through to the document theme.
  }

  const current = document.documentElement.dataset.loombusTheme;
  return current === "light" || current === "dark" || current === "system"
    ? current
    : "dark";
}

function nextAppearance(current: AppearanceMode): AppearanceMode {
  const index = APPEARANCE_ORDER.indexOf(current);
  return APPEARANCE_ORDER[(index + 1) % APPEARANCE_ORDER.length];
}

function labelFor(mode: AppearanceMode) {
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

export function MobileTopAppearanceCycle() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [mode, setMode] = useState<AppearanceMode>("dark");

  useEffect(() => {
    setMode(readAppearance());

    let frame = 0;

    function connect() {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const actions = document.querySelector<HTMLElement>(".loombus-mobile-v2-top-actions");
        const searchButton = actions?.querySelector<HTMLButtonElement>('button[aria-label="Search Loombus"]');

        if (!actions || !searchButton) {
          setHost(null);
          return;
        }

        let nextHost = actions.querySelector<HTMLElement>("[data-mobile-appearance-cycle-host]");
        if (!nextHost) {
          nextHost = document.createElement("span");
          nextHost.dataset.mobileAppearanceCycleHost = "true";
          nextHost.className = "loombus-mobile-appearance-cycle-host";
          actions.insertBefore(nextHost, searchButton);
        }

        setHost(nextHost);
      });
    }

    connect();
    const observer = new MutationObserver(connect);
    observer.observe(document.body, { childList: true, subtree: true });

    function syncFromEvent() {
      setMode(readAppearance());
    }

    window.addEventListener("storage", syncFromEvent);
    window.addEventListener("loombus:appearance-changed", syncFromEvent as EventListener);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("storage", syncFromEvent);
      window.removeEventListener("loombus:appearance-changed", syncFromEvent as EventListener);
      document.querySelector("[data-mobile-appearance-cycle-host]")?.remove();
    };
  }, []);

  function cycleAppearance() {
    const next = nextAppearance(mode);
    setMode(next);

    try {
      window.localStorage.setItem(APPEARANCE_STORAGE_KEY, next);
    } catch {
      // The selected appearance still applies to the current page.
    }

    document.documentElement.dataset.loombusTheme = next;
    window.dispatchEvent(
      new CustomEvent("loombus:appearance-changed", { detail: { mode: next } })
    );
  }

  if (!host) return null;

  const NextIcon = mode === "light" ? Sun : mode === "dark" ? Moon : Monitor;
  const next = nextAppearance(mode);

  return createPortal(
    <button
      type="button"
      className="loombus-mobile-appearance-cycle"
      onClick={cycleAppearance}
      aria-label={`Appearance: ${labelFor(mode)}. Tap for ${labelFor(next)}.`}
      title={`${labelFor(mode)} appearance`}
      data-mode={mode}
    >
      <NextIcon aria-hidden="true" size={20} strokeWidth={2.05} />
    </button>,
    host
  );
}
