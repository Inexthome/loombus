"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Compass,
  FlaskConical,
  Home,
  Monitor,
  Moon,
  Search,
  Sun,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

type AppearanceMode = "system" | "light" | "dark";
type DockItem = "Home" | "My Library" | "Discover" | "Research" | "Search";

const APPEARANCE_KEY = "loombus:appearance";

function readAppearance(): AppearanceMode {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(APPEARANCE_KEY);
  return stored === "light" || stored === "dark" ? stored : "system";
}

function setAppearance(mode: AppearanceMode) {
  window.localStorage.setItem(APPEARANCE_KEY, mode);
  document.documentElement.dataset.loombusTheme = mode;
  window.dispatchEvent(new CustomEvent("loombus:appearance-change", { detail: { mode } }));
}

function markNativeMobileControls(root: HTMLElement) {
  const search = root.querySelector<HTMLInputElement>('input[aria-label="Search the Loombus Library"]');
  const mobileBlock = search?.closest<HTMLElement>(".mb-5");
  if (mobileBlock) {
    mobileBlock.dataset.libraryNativeMobileControls = "true";
    const nav = mobileBlock.querySelector<HTMLElement>('nav[aria-label="Library sections"]');
    if (nav) nav.dataset.libraryNativeMobileNav = "true";
  }

  const eyebrow = Array.from(root.querySelectorAll<HTMLElement>("p")).find(
    (node) => node.textContent?.trim() === "Loombus Library",
  );
  if (eyebrow) eyebrow.dataset.libraryHomeEyebrow = "true";
}

function clickLibraryView(root: HTMLElement, label: string) {
  const button = Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find(
    (node) => node.textContent?.trim() === label,
  );
  button?.click();
}

export function LibraryMobileImmersiveShell({ children }: { children: ReactNode }) {
  const [appearance, setAppearanceState] = useState<AppearanceMode>("system");
  const [activeDock, setActiveDock] = useState<DockItem>("Home");
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    setAppearanceState(readAppearance());
    document.body.classList.add("loombus-library-mobile-immersive");
    return () => document.body.classList.remove("loombus-library-mobile-immersive");
  }, []);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-library-mobile-immersive-root]");
    if (!root) return;

    const sync = () => markNativeMobileControls(root);
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-library-mobile-immersive-root]");
    if (!root) return;
    root.dataset.librarySearchOpen = searchOpen ? "true" : "false";
    if (searchOpen) {
      window.setTimeout(() => root.querySelector<HTMLInputElement>('input[aria-label="Search the Loombus Library"]')?.focus(), 0);
    }
  }, [searchOpen]);

  function cycleAppearance() {
    const next: AppearanceMode = appearance === "system" ? "light" : appearance === "light" ? "dark" : "system";
    setAppearance(next);
    setAppearanceState(next);
  }

  function activate(item: DockItem) {
    const root = document.querySelector<HTMLElement>("[data-library-mobile-immersive-root]");
    if (!root) return;

    if (item === "Research") {
      window.location.href = "/library/research";
      return;
    }
    if (item === "Search") {
      setSearchOpen((value) => !value);
      setActiveDock("Search");
      return;
    }

    setSearchOpen(false);
    clickLibraryView(root, item);
    setActiveDock(item);
  }

  const AppearanceIcon = appearance === "light" ? Sun : appearance === "dark" ? Moon : Monitor;

  return (
    <div data-library-mobile-immersive-root="true" data-library-search-open="false">
      <header className="library-mobile-immersive-header md:hidden">
        <Link href="/home" className="library-mobile-back" aria-label="Back to Loombus">
          <ArrowLeft className="size-5" aria-hidden="true" />
          <span>Back to Loombus</span>
        </Link>
        <button type="button" onClick={cycleAppearance} className="library-mobile-theme" aria-label={`Appearance: ${appearance}. Change appearance.`} title={`Appearance: ${appearance}`}>
          <AppearanceIcon className="size-5" aria-hidden="true" />
        </button>
      </header>

      {children}

      <nav className="library-mobile-dock md:hidden" aria-label="Library navigation">
        <button type="button" onClick={() => activate("Home")} aria-current={activeDock === "Home" ? "page" : undefined}>
          <Home aria-hidden="true" /><span>Home</span>
        </button>
        <button type="button" onClick={() => activate("My Library")} aria-current={activeDock === "My Library" ? "page" : undefined}>
          <BookOpen aria-hidden="true" /><span>Library</span>
        </button>
        <button type="button" onClick={() => activate("Discover")} aria-current={activeDock === "Discover" ? "page" : undefined}>
          <Compass aria-hidden="true" /><span>Discover</span>
        </button>
        <button type="button" onClick={() => activate("Research")}>
          <FlaskConical aria-hidden="true" /><span>Research</span>
        </button>
        <button type="button" onClick={() => activate("Search")} aria-current={activeDock === "Search" ? "page" : undefined}>
          <Search aria-hidden="true" /><span>Search</span>
        </button>
      </nav>

      <style jsx global>{`
        @media (max-width: 767px) {
          body.loombus-library-mobile-immersive {
            background: var(--loombus-page-bg) !important;
            overscroll-behavior-y: none;
          }

          [data-library-mobile-immersive-root="true"] {
            min-height: 100dvh;
            background: var(--loombus-page-bg);
            color: var(--loombus-text);
          }

          [data-library-mobile-immersive-root="true"] > main {
            min-height: 100dvh !important;
            padding-top: calc(env(safe-area-inset-top, 0px) + 4.5rem) !important;
            padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 7.75rem) !important;
            background: var(--loombus-page-bg) !important;
          }

          [data-library-mobile-immersive-root="true"] > main > div > div:last-child {
            padding: 1.1rem 1.25rem 2rem !important;
          }

          .library-mobile-immersive-header {
            position: fixed;
            z-index: 90;
            inset: 0 0 auto;
            min-height: calc(env(safe-area-inset-top, 0px) + 4.5rem);
            padding: calc(env(safe-area-inset-top, 0px) + 0.6rem) 1rem 0.65rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1rem;
            background: color-mix(in srgb, var(--loombus-page-bg) 88%, transparent);
            border-bottom: 1px solid color-mix(in srgb, var(--loombus-border) 72%, transparent);
            backdrop-filter: blur(22px) saturate(145%);
            -webkit-backdrop-filter: blur(22px) saturate(145%);
          }

          .library-mobile-back {
            display: inline-flex;
            min-height: 2.65rem;
            align-items: center;
            gap: 0.45rem;
            border-radius: 999px;
            padding: 0 0.7rem 0 0.4rem;
            color: var(--loombus-text);
            font-size: 0.9rem;
            font-weight: 700;
            text-decoration: none;
          }

          .library-mobile-theme {
            display: grid;
            width: 2.65rem;
            height: 2.65rem;
            place-items: center;
            border: 1px solid var(--loombus-border);
            border-radius: 999px;
            background: var(--loombus-surface-strong);
            color: var(--loombus-text);
            box-shadow: 0 8px 28px rgb(0 0 0 / 0.08);
          }

          [data-library-native-mobile-controls="true"] {
            margin: 0 0 1.4rem !important;
          }

          [data-library-native-mobile-controls="true"] > label {
            display: none !important;
            min-height: 3.15rem !important;
            border-radius: 1.05rem !important;
            background: var(--loombus-surface-strong) !important;
            box-shadow: inset 0 0 0 1px var(--loombus-border);
          }

          [data-library-search-open="true"] [data-library-native-mobile-controls="true"] > label {
            display: flex !important;
          }

          [data-library-native-mobile-nav="true"] {
            display: none !important;
          }

          [data-library-home-eyebrow="true"] {
            display: none !important;
          }

          [data-library-mobile-immersive-root="true"] main h1 {
            margin-top: 0 !important;
            font-family: ui-serif, Georgia, Cambria, "Times New Roman", serif;
            font-size: clamp(2.5rem, 11vw, 3.45rem) !important;
            font-weight: 700 !important;
            line-height: 0.98 !important;
            letter-spacing: -0.035em !important;
          }

          [data-library-mobile-immersive-root="true"] main h2 {
            font-family: ui-serif, Georgia, Cambria, "Times New Roman", serif;
            font-size: 1.75rem !important;
            line-height: 1.05 !important;
            letter-spacing: -0.025em !important;
          }

          [data-library-mobile-immersive-root="true"] main section {
            scroll-margin-top: 6rem;
          }

          [data-library-mobile-immersive-root="true"] main section + section {
            margin-top: 2.25rem !important;
            padding-top: 2rem !important;
          }

          [data-library-mobile-immersive-root="true"] main section > div:first-child p {
            font-size: 0.95rem !important;
          }

          [data-library-mobile-immersive-root="true"] main a,
          [data-library-mobile-immersive-root="true"] main button {
            -webkit-tap-highlight-color: transparent;
          }

          [data-library-mobile-immersive-root="true"] main .overflow-x-auto {
            scrollbar-width: none;
            scroll-snap-type: x proximity;
          }

          [data-library-mobile-immersive-root="true"] main .overflow-x-auto::-webkit-scrollbar {
            display: none;
          }

          [data-library-mobile-immersive-root="true"] main .overflow-x-auto > * {
            scroll-snap-align: start;
          }

          [data-library-mobile-immersive-root="true"] main section a[class*="w-72"] {
            width: min(82vw, 22rem) !important;
            border-radius: 1.15rem !important;
            padding: 0.9rem !important;
            box-shadow: 0 10px 34px rgb(0 0 0 / 0.08);
          }

          [data-library-mobile-immersive-root="true"] main section a[class*="w-72"] > span:first-child {
            width: 3.4rem !important;
            border-radius: 0.55rem !important;
          }

          .library-mobile-dock {
            position: fixed;
            z-index: 95;
            left: 0.75rem;
            right: 0.75rem;
            bottom: calc(env(safe-area-inset-bottom, 0px) + 0.65rem);
            min-height: 4.85rem;
            display: grid;
            grid-template-columns: repeat(5, minmax(0, 1fr));
            align-items: stretch;
            gap: 0.15rem;
            padding: 0.42rem;
            border: 1px solid color-mix(in srgb, var(--loombus-border) 82%, transparent);
            border-radius: 1.65rem;
            background: color-mix(in srgb, var(--loombus-surface) 88%, transparent);
            box-shadow: 0 18px 50px rgb(0 0 0 / 0.2);
            backdrop-filter: blur(28px) saturate(155%);
            -webkit-backdrop-filter: blur(28px) saturate(155%);
          }

          .library-mobile-dock button {
            min-width: 0;
            min-height: 3.85rem;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 0.22rem;
            border: 0;
            border-radius: 1.25rem;
            background: transparent;
            color: var(--loombus-text-muted);
            font-size: 0.68rem;
            font-weight: 650;
            line-height: 1;
          }

          .library-mobile-dock button svg {
            width: 1.35rem;
            height: 1.35rem;
            stroke-width: 2;
          }

          .library-mobile-dock button[aria-current="page"] {
            background: var(--loombus-surface-strong);
            color: var(--loombus-text);
          }

          .library-mobile-dock button[aria-current="page"] svg {
            color: var(--loombus-gold);
          }
        }
      `}</style>
    </div>
  );
}
