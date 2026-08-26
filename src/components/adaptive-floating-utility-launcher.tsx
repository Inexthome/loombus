"use client";

import Link from "next/link";
import {
  Bookmark,
  Bot,
  Palette,
  Sparkles,
  StickyNote,
  X,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type AppearanceMode = "system" | "dark" | "light";

const QUICK_RAIL_STORAGE_KEY = "loombus:quick-rail-open";

function composerIsOpen(pathname: string) {
  return (
    pathname === "/create" ||
    Boolean(document.querySelector("[data-discussions-create-modal]")) ||
    document.body.dataset.discussionsCreateOpen === "true" ||
    document.body.dataset.createFocus === "true"
  );
}

function readStoredAppearance(): AppearanceMode {
  try {
    const stored = window.localStorage.getItem("loombus:appearance");
    return stored === "light" || stored === "dark" || stored === "system"
      ? stored
      : "system";
  } catch {
    return "system";
  }
}

function readStoredQuickRailState() {
  try {
    return window.sessionStorage.getItem(QUICK_RAIL_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function AdaptiveFloatingUtilityLauncher() {
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [available, setAvailable] = useState(false);
  const [open, setOpen] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [appearance, setAppearance] = useState<AppearanceMode>("system");
  const [suppressed, setSuppressed] = useState(false);

  useEffect(() => {
    setAppearance(readStoredAppearance());
    setOpen(readStoredQuickRailState());
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady) return;

    try {
      window.sessionStorage.setItem(QUICK_RAIL_STORAGE_KEY, String(open));
    } catch {
      // The rail still remains open for the current rendered page.
    }
  }, [open, storageReady]);

  useEffect(() => {
    let cancelled = false;
    let locateTimer = 0;
    let frame = 0;

    function sync() {
      if (cancelled) return;

      const legacyStack = document.querySelector<HTMLElement>(
        ".loombus-floating-utility-stack"
      );

      setAvailable(Boolean(legacyStack));
      setSuppressed(composerIsOpen(pathname));

      if (legacyStack) {
        document.body.dataset.adaptiveUtilities = "true";
      } else {
        delete document.body.dataset.adaptiveUtilities;
      }
    }

    function scheduleSync() {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(sync);
    }

    function locate() {
      sync();
      if (!document.querySelector(".loombus-floating-utility-stack") && !cancelled) {
        locateTimer = window.setTimeout(locate, 120);
      }
    }

    const observer = new MutationObserver(scheduleSync);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        "data-create-focus",
        "data-discussions-create-open",
      ],
    });

    locate();

    return () => {
      cancelled = true;
      window.clearTimeout(locateTimer);
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      delete document.body.dataset.adaptiveUtilities;
    };
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setAppearanceOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  function applyAppearance(mode: AppearanceMode) {
    setAppearance(mode);

    try {
      window.localStorage.setItem("loombus:appearance", mode);
    } catch {
      // The selected appearance still applies for this session.
    }

    document.documentElement.dataset.loombusTheme = mode;
    window.dispatchEvent(
      new CustomEvent("loombus:appearance-changed", { detail: { mode } })
    );
  }

  function openAskLoombus() {
    window.dispatchEvent(
      new CustomEvent("loombus:open-global-search", {
        detail: { mode: "ask" },
      })
    );
  }

  if (
    !available ||
    suppressed ||
    pathname === "/notifications" ||
    pathname.startsWith("/notifications/")
  ) {
    return null;
  }

  return (
    <div
      ref={rootRef}
      className="loombus-persistent-quick-rail"
      data-open={open ? "true" : "false"}
    >
      {open ? (
        <div
          className="loombus-persistent-quick-rail-menu"
          role="menu"
          aria-label="Loombus quick tools"
        >
          <button
            type="button"
            role="menuitem"
            className="loombus-persistent-quick-rail-item"
            onClick={openAskLoombus}
          >
            <span>
              <Bot size={19} strokeWidth={2.1} aria-hidden="true" />
            </span>
            <strong>Ask Loombus</strong>
          </button>

          <Link
            href="/saved"
            role="menuitem"
            className="loombus-persistent-quick-rail-item"
          >
            <span>
              <Bookmark size={19} strokeWidth={2.1} aria-hidden="true" />
            </span>
            <strong>Saved</strong>
          </Link>

          <Link
            href="/stickies"
            role="menuitem"
            className="loombus-persistent-quick-rail-item"
          >
            <span>
              <StickyNote size={19} strokeWidth={2.1} aria-hidden="true" />
            </span>
            <strong>Stickies</strong>
          </Link>

          <div className="loombus-persistent-quick-rail-appearance">
            <button
              type="button"
              role="menuitem"
              className="loombus-persistent-quick-rail-item"
              onClick={() => setAppearanceOpen((current) => !current)}
              aria-expanded={appearanceOpen}
            >
              <span>
                <Palette size={19} strokeWidth={2.1} aria-hidden="true" />
              </span>
              <strong>Appearance</strong>
            </button>

            {appearanceOpen ? (
              <div
                className="loombus-persistent-quick-rail-appearance-options"
                aria-label="Choose appearance"
              >
                {(["light", "system", "dark"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => applyAppearance(mode)}
                    aria-pressed={appearance === mode}
                    data-active={appearance === mode ? "true" : "false"}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className="loombus-persistent-quick-rail-launcher"
        onClick={() => {
          setOpen((current) => !current);
          if (open) setAppearanceOpen(false);
        }}
        aria-label={open ? "Close Loombus quick tools" : "Open Loombus quick tools"}
        aria-expanded={open}
      >
        {open ? (
          <X size={21} strokeWidth={2.2} aria-hidden="true" />
        ) : (
          <Sparkles size={21} strokeWidth={2.1} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
