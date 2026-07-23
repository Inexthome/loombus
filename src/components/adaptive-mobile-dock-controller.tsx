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

type DockMode = "collapsed" | "expanded";

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
    document.body.dataset.discussionsCreateOpen === "true" ||
    Boolean(document.querySelector("[data-discussions-create-modal]")) ||
    document.body.dataset.createFocus === "true"
  );
}

export function AdaptiveMobileDockController() {
  const pathname = usePathname();
  const [mode, setMode] = useState<DockMode>("collapsed");
  const [suppressed, setSuppressed] = useState(false);
  const [ready, setReady] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);
  const launcherRef = useRef<HTMLButtonElement | null>(null);
  const modeRef = useRef<DockMode>("collapsed");

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
    let pageObserver: MutationObserver | null = null;

    function syncSuppression() {
      setSuppressed(composerIsOpen(pathname));
    }

    function attach(nav: HTMLElement) {
      navRef.current = nav;
      nav.id = "loombus-adaptive-primary-navigation";
      nav.dataset.adaptiveDock = "true";
      document.body.dataset.adaptiveMobileDock = "true";
      setMode("collapsed");
      setReady(true);
      syncSuppression();
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
      if (modeRef.current === "expanded") {
        setMode("collapsed");
      }
    }

    pageObserver = new MutationObserver(syncSuppression);
    pageObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-create-focus", "data-discussions-create-open"],
    });

    document.addEventListener("pointerdown", handleDocumentPointer, true);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, { passive: true });
    locate();

    return () => {
      cancelled = true;
      window.clearTimeout(locateTimer);
      pageObserver?.disconnect();
      navRef.current?.removeEventListener("click", handleNavClick, true);
      if (navRef.current) {
        delete navRef.current.dataset.adaptiveDock;
        delete navRef.current.dataset.adaptiveDockState;
        if (navRef.current.id === "loombus-adaptive-primary-navigation") {
          navRef.current.removeAttribute("id");
        }
      }
      delete document.body.dataset.adaptiveMobileDock;
      document.removeEventListener("pointerdown", handleDocumentPointer, true);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [pathname]);

  useEffect(() => {
    if (mode !== "expanded") return;
    const timer = window.setTimeout(() => setMode("collapsed"), 5200);
    return () => window.clearTimeout(timer);
  }, [mode]);

  useEffect(() => {
    setMode("collapsed");
  }, [pathname]);

  if (!ready || suppressed) return null;

  return (
    <button
      ref={launcherRef}
      type="button"
      className="loombus-adaptive-dock-launcher"
      data-expanded={mode === "expanded" ? "true" : "false"}
      onClick={() => setMode((current) => (current === "expanded" ? "collapsed" : "expanded"))}
      aria-label={
        mode === "expanded"
          ? "Collapse Loombus navigation"
          : `Open Loombus navigation. Current page: ${activeDestination.label}`
      }
      aria-expanded={mode === "expanded"}
      aria-controls="loombus-adaptive-primary-navigation"
    >
      <span className="loombus-adaptive-dock-mark" aria-hidden="true">
        <img src="/assets/brand/loombus-mark-transparent.png" alt="" />
      </span>
      <span className="loombus-adaptive-dock-current" aria-hidden="true">
        <ActiveIcon size={18} strokeWidth={2.1} />
      </span>
      <Menu
        className="loombus-adaptive-dock-menu-icon"
        size={19}
        strokeWidth={2.15}
        aria-hidden="true"
      />
    </button>
  );
}
