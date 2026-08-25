"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Compass,
  Ellipsis,
  Home,
  LibraryBig,
  Monitor,
  Moon,
  Search,
  Sparkles,
  Sun,
  X,
} from "lucide-react";
import type { ReactNode } from "react";

type AppearanceMode = "system" | "light" | "dark";
type LibraryViewTarget =
  | "Home"
  | "Discover"
  | "My Library"
  | "Want to Read"
  | "Continue Reading"
  | "Finished"
  | "Collections"
  | "Highlights"
  | "Authors";

const APPEARANCE_KEY = "loombus:appearance";
const LIBRARY_SEARCH_INPUT = 'input[aria-label="Search the Loombus Library"]';

const MORE_TARGETS: Array<{ label: string; view?: LibraryViewTarget; href?: string }> = [
  { label: "Want to Read", view: "Want to Read" },
  { label: "Continue Reading", view: "Continue Reading" },
  { label: "Finished", view: "Finished" },
  { label: "Collections", view: "Collections" },
  { label: "Highlights & Notes", view: "Highlights" },
  { label: "Authors", view: "Authors" },
  { label: "Research", href: "/library/research" },
  { label: "My Publications", href: "/library/publish" },
];

function getStoredAppearance(): AppearanceMode {
  if (typeof window === "undefined") return "system";
  const value = window.localStorage.getItem(APPEARANCE_KEY);
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

function AppearanceGlyph({ mode }: { mode: AppearanceMode }) {
  if (mode === "light") return <Sun className="h-5 w-5" aria-hidden="true" />;
  if (mode === "dark") return <Moon className="h-5 w-5" aria-hidden="true" />;
  return <Monitor className="h-5 w-5" aria-hidden="true" />;
}

export function LibraryImmersiveSubappShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isReader = pathname.startsWith("/library/read/");
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [appearance, setAppearance] = useState<AppearanceMode>("system");

  useEffect(() => {
    setAppearance(getStoredAppearance());
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setMoreOpen(false);
    setAppearanceOpen(false);
    document.documentElement.removeAttribute("data-library-search-open");

    if (pathname !== "/library") return;
    const params = new URLSearchParams(window.location.search);
    const requestedView = params.get("view");
    const wantsSearch = params.get("search") === "1";

    const timer = window.setTimeout(() => {
      if (requestedView) activateExistingLibraryView(requestedView as LibraryViewTarget);
      if (wantsSearch) openLibrarySearch();
    }, 60);

    return () => window.clearTimeout(timer);
  }, [pathname]);

  function activateExistingLibraryView(view: LibraryViewTarget) {
    const candidates = Array.from(document.querySelectorAll<HTMLButtonElement>('nav[aria-label="Library sections"] button'));
    const target = candidates.find((button) => button.textContent?.trim() === view);
    target?.click();
  }

  function openLibrarySearch() {
    document.documentElement.dataset.librarySearchOpen = "true";
    activateExistingLibraryView("Discover");
    window.setTimeout(() => {
      document.querySelector<HTMLInputElement>(LIBRARY_SEARCH_INPUT)?.focus();
    }, 80);
  }

  function goToView(view: LibraryViewTarget) {
    setMenuOpen(false);
    setMoreOpen(false);
    document.documentElement.removeAttribute("data-library-search-open");
    if (pathname === "/library") {
      activateExistingLibraryView(view);
      return;
    }
    window.location.assign(`/library?view=${encodeURIComponent(view)}`);
  }

  function goToSearch() {
    setMenuOpen(false);
    setMoreOpen(false);
    if (pathname === "/library") {
      openLibrarySearch();
      return;
    }
    window.location.assign("/library?search=1");
  }

  function setAppearanceMode(mode: AppearanceMode) {
    setAppearance(mode);
    setAppearanceOpen(false);
    window.localStorage.setItem(APPEARANCE_KEY, mode);
    document.documentElement.dataset.loombusTheme = mode;
    window.dispatchEvent(new CustomEvent("loombus:appearance-change", { detail: { mode } }));
  }

  if (isReader) return <>{children}</>;

  return (
    <div data-library-subapp className="relative min-h-screen bg-[var(--loombus-page-bg)] text-[var(--loombus-text)]">
      <div data-library-subapp-controls className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex items-start justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
        <Link
          href="/home"
          className="pointer-events-auto inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 text-sm font-semibold shadow-sm backdrop-blur-xl transition hover:border-[var(--loombus-gold)]"
          aria-label="Back to Loombus"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Back to Loombus</span>
        </Link>

        <div className="pointer-events-auto relative">
          <button
            type="button"
            onClick={() => setAppearanceOpen((open) => !open)}
            className="grid h-11 w-11 place-items-center rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] shadow-sm backdrop-blur-xl transition hover:border-[var(--loombus-gold)]"
            aria-label={`Appearance: ${appearance}`}
            aria-expanded={appearanceOpen}
          >
            <AppearanceGlyph mode={appearance} />
          </button>
          {appearanceOpen ? (
            <div className="absolute right-0 mt-2 w-44 overflow-hidden rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-1.5 shadow-2xl">
              {(["system", "light", "dark"] as AppearanceMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setAppearanceMode(mode)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${appearance === mode ? "bg-[var(--loombus-surface-strong)] text-[var(--loombus-gold)]" : "hover:bg-[var(--loombus-surface-muted)]"}`}
                >
                  <AppearanceGlyph mode={mode} />
                  <span className="capitalize">{mode}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div data-library-subapp-content>{children}</div>

      <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 z-[85] sm:left-6 lg:hidden">
        {menuOpen ? (
          <div className="mb-3 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-2 shadow-2xl backdrop-blur-2xl">
            <div className="flex items-center justify-between px-2 pb-2 pt-1">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--loombus-gold)]">Library</span>
              <button type="button" onClick={() => { setMenuOpen(false); setMoreOpen(false); }} className="grid h-9 w-9 place-items-center rounded-full hover:bg-[var(--loombus-surface-muted)]" aria-label="Close Library menu">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <button type="button" onClick={() => goToView("Home")} className="library-subapp-menu-item"><Home className="h-4 w-4" aria-hidden="true" /><span>Home</span></button>
              <button type="button" onClick={() => goToView("My Library")} className="library-subapp-menu-item"><LibraryBig className="h-4 w-4" aria-hidden="true" /><span>Library</span></button>
              <button type="button" onClick={() => goToView("Discover")} className="library-subapp-menu-item"><Compass className="h-4 w-4" aria-hidden="true" /><span>Discover</span></button>
              <button type="button" onClick={goToSearch} className="library-subapp-menu-item"><Search className="h-4 w-4" aria-hidden="true" /><span>Search</span></button>
              <button type="button" onClick={() => setMoreOpen((open) => !open)} className="library-subapp-menu-item col-span-2" aria-expanded={moreOpen}><Ellipsis className="h-4 w-4" aria-hidden="true" /><span>More</span></button>
            </div>

            {moreOpen ? (
              <div className="mt-2 grid gap-1 border-t border-[var(--loombus-border)] pt-2">
                {MORE_TARGETS.map((target) => target.href ? (
                  <Link key={target.label} href={target.href} onClick={() => { setMenuOpen(false); setMoreOpen(false); }} className="rounded-xl px-3 py-2.5 text-sm font-medium transition hover:bg-[var(--loombus-surface-muted)]">{target.label}</Link>
                ) : (
                  <button key={target.label} type="button" onClick={() => goToView(target.view!)} className="rounded-xl px-3 py-2.5 text-left text-sm font-medium transition hover:bg-[var(--loombus-surface-muted)]">{target.label}</button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="grid h-14 w-14 place-items-center rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] text-[var(--loombus-text)] shadow-xl backdrop-blur-xl transition hover:border-[var(--loombus-gold)]"
          aria-label="Library navigation"
          aria-expanded={menuOpen}
        >
          <BookOpen className="h-6 w-6" aria-hidden="true" />
        </button>
      </div>

      <Link
        href="/library/ask-loombus"
        className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-[85] hidden h-14 w-14 place-items-center rounded-full border border-[var(--loombus-gold)] bg-[var(--loombus-surface)] text-[var(--loombus-gold)] shadow-xl backdrop-blur-xl transition hover:bg-[var(--loombus-surface-strong)] max-lg:grid sm:right-6"
        aria-label="Ask Loombus"
        title="Ask Loombus"
      >
        <Sparkles className="h-6 w-6" aria-hidden="true" />
      </Link>
    </div>
  );
}
