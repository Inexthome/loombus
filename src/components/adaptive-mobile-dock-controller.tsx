"use client";

import {
  Bell,
  DoorOpen,
  Edit3,
  Menu,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type DockMode = "full" | "collapsed" | "expanded";

type DockDestination = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const DESTINATIONS: DockDestination[] = [
  { href: "/discussions", label: "Discussions", icon: MessageCircle },
  { href: "/create", label: "Create", icon: Edit3 },
  { href: "/rooms", label: "Rooms", icon: DoorOpen },
  { href: "/notifications", label: "Notifications", icon: Bell },
];

function isPathActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function composerIsOpen(pathname: string) {
  return (
    pathname === "/create" ||
    Boolean(document.querySelector("[data-discussions-create-modal]")) ||
    document.body.dataset.createFocus === "true"
  );
}

export function AdaptiveMobileDockController() {
  const pathname = usePathname();
  const [mode, setMode] = useState<DockMode>("full");
  const [suppressed, setSuppressed] = useState(false);
  const [ready, setReady] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);
  const launcherRef = useRef<HTMLButtonElement | null>(null);
  const modeRef = useRef<DockMode>("full");

  const activeDestination = useMemo(
    () => DESTINATIONS.find((item) => isPathActive(pathname, item.href)) ?? DESTINATIONS[0],
    [pathname]
  );
  const ActiveIcon = activeDestination.icon;

  useEffect(() => {
    modeRef.current = mode;
    const nav = navRef.current;
    if (!nav) return;
    nav.dataset.adaptiveDockState = suppressed ? "suppressed" : mode;
  }, [mode, suppressed]);

  useEffect(() => {
    let cancelled = false;
    let locateTimer = 0;
    let classObserver: MutationObserver | null = null;
    let pageObserver: MutationObserver | null = null;
    let previousScrollY = window.scrollY;

    const mobile = window.matchMedia("(max-width: 767.98px)");

    function syncSuppression() {
      setSuppressed(composerIsOpen(pathname));
    }

    function syncFromShell(nav: HTMLElement) {
      if (!mobile.matches || modeRef.current === "expanded") return;
      setMode(nav.classList.contains("is-hidden") ? "collapsed" : "full");
    }

    function attach(nav: HTMLElement) {
      navRef.current = nav;
      nav.id = "loombus-adaptive-primary-navigation";
      nav.dataset.adaptiveDock = "true";
      document.body.dataset.adaptiveMobileDock = "true";
      setReady(true);
      syncFromShell(nav);
      syncSuppression();

      classObserver = new MutationObserver(() => syncFromShell(nav));
      classObserver.observe(nav, { attributes: true, attributeFilter: ["class"] });

      nav.addEventListener("click", handleNavClick, true);
    }

    function locate() {
      if (cancelled) return;
      const nav = document.querySelector<HTMLElement>(".loombus-mobile-v2-bottom-nav");
      if (!nav) {
        locateTimer = window.setTimeout(locate, 120);
        return;
      }
      attach(nav);
    }

    function handleNavClick(event: Event) {
      if ((event.target as Element | null)?.closest("a")) {
        setMode("collapsed");
      }
    }

    function handleDocumentPointer(event: PointerEvent) {
      if (modeRef.current !== "expanded") return;
      const target = event.target as Node | null;
      if (navRef.current?.contains(target) || launcherRef.current?.contains(target)) return;
      setMode("collapsed");
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && modeRef.current === "expanded") {
        setMode("collapsed");
        launcherRef.current?.focus();
      }
    }

    function handleScroll() {
      const nextScrollY = window.scrollY;
      const delta = nextScrollY - previousScrollY;
      previousScrollY = nextScrollY;
      if (modeRef.current === "expanded" && Math.abs(delta) > 6) {
        setMode("collapsed");
      }
    }

    function handleMediaChange() {
      if (!mobile.matches) {
        setMode("full");
      } else if (navRef.current) {
        syncFromShell(navRef.current);
      }
    }

    pageObserver = new MutationObserver(syncSuppression);
    pageObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-create-focus"],
    });

    document.addEventListener("pointerdown", handleDocumentPointer, true);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, { passive: true });
    mobile.addEventListener("change", handleMediaChange);
    locate();

    return () => {
      cancelled = true;
      window.clearTimeout(locateTimer);
      classObserver?.disconnect();
      pageObserver?.disconnect();
      navRef.current?.removeEventListener("click", handleNavClick, true);
      if (navRef.current) {
        delete navRef.current.dataset.adaptiveDock;
        delete navRef.current.dataset.adaptiveDockState;
      }
      delete document.body.dataset.adaptiveMobileDock;
      document.removeEventListener("pointerdown", handleDocumentPointer, true);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll);
      mobile.removeEventListener("change", handleMediaChange);
    };
  }, [pathname]);

  useEffect(() => {
    if (mode !== "expanded") return;
    const timer = window.setTimeout(() => setMode("collapsed"), 5200);
    return () => window.clearTimeout(timer);
  }, [mode]);

  useEffect(() => {
    setMode((current) => (current === "expanded" ? "collapsed" : current));
  }, [pathname]);

  if (!ready || suppressed || mode === "full") return null;

  return (
    <button
      ref={launcherRef}
      type="button"
      className="loombus-adaptive-dock-launcher"
      data-expanded={mode === "expanded" ? "true" : "false"}
      onClick={() => setMode((current) => (current === "expanded" ? "collapsed" : "expanded"))}
      aria-label={mode === "expanded" ? "Collapse Loombus navigation" : `Open Loombus navigation. Current page: ${activeDestination.label}`}
      aria-expanded={mode === "expanded"}
      aria-controls="loombus-adaptive-primary-navigation"
    >
      <span className="loombus-adaptive-dock-mark" aria-hidden="true">
        <img src="/assets/brand/loombus-mark-transparent.png" alt="" />
      </span>
      <span className="loombus-adaptive-dock-current" aria-hidden="true">
        <ActiveIcon size={18} strokeWidth={2.1} />
      </span>
      <Menu className="loombus-adaptive-dock-menu-icon" size={19} strokeWidth={2.15} aria-hidden="true" />
    </button>
  );
}
