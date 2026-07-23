"use client";

import Link from "next/link";
import {
  HelpCircle,
  MessageCircle,
  Palette,
  Sparkles,
  StickyNote,
  X,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type AppearanceMode = "system" | "dark" | "light";

function composerIsOpen(pathname: string) {
  return (
    pathname === "/create" ||
    Boolean(document.querySelector("[data-discussions-create-modal]")) ||
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

export function AdaptiveFloatingUtilityLauncher() {
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [available, setAvailable] = useState(false);
  const [open, setOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [appearance, setAppearance] = useState<AppearanceMode>("system");
  const [helpHref, setHelpHref] = useState("/support");
  const [unreadCount, setUnreadCount] = useState(0);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [suppressed, setSuppressed] = useState(false);
  const originalMessageButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setAppearance(readStoredAppearance());
  }, []);

  useEffect(() => {
    let cancelled = false;
    let locateTimer = 0;
    let frame = 0;

    function sync() {
      if (cancelled) return;
      const stack = document.querySelector<HTMLElement>(".loombus-floating-utility-stack");
      const messageButton = stack?.nextElementSibling;
      const originalMessageButton =
        messageButton instanceof HTMLButtonElement ? messageButton : null;
      const helpLink = stack?.querySelector<HTMLAnchorElement>(
        'a[aria-label="Open help for this page"]'
      );
      const badge = originalMessageButton?.querySelector<HTMLElement>("span span");
      const parsedUnread = Number.parseInt(badge?.textContent?.replace("+", "") ?? "0", 10);

      originalMessageButtonRef.current = originalMessageButton;
      setAvailable(Boolean(stack && originalMessageButton));
      setHelpHref(helpLink?.getAttribute("href") || "/support");
      setUnreadCount(Number.isFinite(parsedUnread) ? parsedUnread : 0);
      setMessagesOpen(Boolean(document.querySelector('aside[aria-label="Messages preview"]')));
      setSuppressed(composerIsOpen(pathname));

      if (stack && originalMessageButton) {
        document.body.dataset.adaptiveUtilities = "true";
      }
    }

    function scheduleSync() {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(sync);
    }

    function locate() {
      sync();
      if (!originalMessageButtonRef.current && !cancelled) {
        locateTimer = window.setTimeout(locate, 120);
      }
    }

    const observer = new MutationObserver(scheduleSync);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["data-create-focus", "aria-expanded"],
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
    setOpen(false);
    setAppearanceOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    function handlePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setAppearanceOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setAppearanceOpen(false);
      }
    }

    function handleScroll() {
      if (window.matchMedia("(max-width: 767.98px)").matches) {
        setOpen(false);
        setAppearanceOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointer, true);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, { passive: true });

    const timer = window.matchMedia("(max-width: 767.98px)").matches
      ? window.setTimeout(() => {
          setOpen(false);
          setAppearanceOpen(false);
        }, 5600)
      : 0;

    return () => {
      document.removeEventListener("pointerdown", handlePointer, true);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll);
      if (timer) window.clearTimeout(timer);
    };
  }, [open]);

  function closeMenu() {
    setOpen(false);
    setAppearanceOpen(false);
  }

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
    closeMenu();
  }

  function openMessages() {
    originalMessageButtonRef.current?.click();
    closeMenu();
  }

  if (!available || suppressed || messagesOpen) return null;

  return (
    <div
      ref={rootRef}
      className="loombus-adaptive-utility-root"
      data-open={open ? "true" : "false"}
    >
      {open ? (
        <div className="loombus-adaptive-utility-menu" role="menu" aria-label="Loombus quick tools">
          <Link
            href={helpHref}
            role="menuitem"
            onClick={closeMenu}
            className="loombus-adaptive-utility-item"
          >
            <span><HelpCircle size={19} strokeWidth={2.1} aria-hidden="true" /></span>
            <strong>Help</strong>
          </Link>

          <div className="loombus-adaptive-utility-appearance-wrap">
            <button
              type="button"
              role="menuitem"
              className="loombus-adaptive-utility-item"
              onClick={() => setAppearanceOpen((current) => !current)}
              aria-expanded={appearanceOpen}
            >
              <span><Palette size={19} strokeWidth={2.1} aria-hidden="true" /></span>
              <strong>Appearance</strong>
            </button>
            {appearanceOpen ? (
              <div className="loombus-adaptive-appearance-options" aria-label="Choose appearance">
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

          <Link
            href="/stickies"
            role="menuitem"
            onClick={closeMenu}
            className="loombus-adaptive-utility-item"
          >
            <span><StickyNote size={19} strokeWidth={2.1} aria-hidden="true" /></span>
            <strong>Stickies</strong>
          </Link>

          <button
            type="button"
            role="menuitem"
            onClick={openMessages}
            className="loombus-adaptive-utility-item"
          >
            <span className="loombus-adaptive-utility-message-icon">
              <MessageCircle size={19} strokeWidth={2.1} aria-hidden="true" />
              {unreadCount > 0 ? (
                <em>{unreadCount > 9 ? "9+" : unreadCount}</em>
              ) : null}
            </span>
            <strong>Messages</strong>
          </button>
        </div>
      ) : null}

      <button
        type="button"
        className="loombus-adaptive-utility-launcher"
        onClick={() => {
          setOpen((current) => !current);
          if (open) setAppearanceOpen(false);
        }}
        aria-label={open ? "Close Loombus quick tools" : "Open Loombus quick tools"}
        aria-expanded={open}
      >
        {open ? <X size={21} strokeWidth={2.2} aria-hidden="true" /> : <Sparkles size={21} strokeWidth={2.1} aria-hidden="true" />}
        {unreadCount > 0 && !open ? (
          <span className="loombus-adaptive-utility-launcher-badge">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>
    </div>
  );
}
