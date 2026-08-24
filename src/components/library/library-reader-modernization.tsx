"use client";

import { useEffect, useState } from "react";
import { BookOpen, Columns2, PanelRight, SlidersHorizontal, X } from "lucide-react";

type ReaderTheme = "loombus" | "quiet" | "paper";
type ReaderFont = "serif" | "sans";
type ReaderColumns = "one" | "two";

type ReaderPreferences = {
  theme: ReaderTheme;
  font: ReaderFont;
  lineHeight: number;
  width: number;
  columns: ReaderColumns;
};

const STORAGE_KEY = "loombus-library-reader-modernization";
const defaults: ReaderPreferences = {
  theme: "loombus",
  font: "serif",
  lineHeight: 1.9,
  width: 48,
  columns: "one",
};

function readPreferences(): ReaderPreferences {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return defaults;
    const parsed = JSON.parse(saved) as Partial<ReaderPreferences>;
    return {
      theme: parsed.theme === "quiet" || parsed.theme === "paper" ? parsed.theme : "loombus",
      font: parsed.font === "sans" ? "sans" : "serif",
      lineHeight: typeof parsed.lineHeight === "number" ? Math.min(2.2, Math.max(1.5, parsed.lineHeight)) : defaults.lineHeight,
      width: typeof parsed.width === "number" ? Math.min(60, Math.max(38, parsed.width)) : defaults.width,
      columns: parsed.columns === "two" ? "two" : "one",
    };
  } catch {
    return defaults;
  }
}

export function LibraryReaderModernization() {
  const [preferences, setPreferences] = useState<ReaderPreferences>(defaults);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);

  useEffect(() => {
    setPreferences(readPreferences());
    document.body.classList.add("loombus-reader-modernized");
    return () => {
      document.body.classList.remove("loombus-reader-modernized");
      document.body.removeAttribute("data-library-reader-tools");
    };
  }, []);

  useEffect(() => {
    document.body.dataset.libraryReaderTools = toolsOpen ? "open" : "closed";
  }, [toolsOpen]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    document.body.dataset.libraryReaderTheme = preferences.theme;
    document.body.dataset.libraryReaderFont = preferences.font;
    document.body.dataset.libraryReaderColumns = preferences.columns;
    document.body.style.setProperty("--library-reader-line-height", String(preferences.lineHeight));
    document.body.style.setProperty("--library-reader-width", `${preferences.width}rem`);
  }, [preferences]);

  return (
    <>
      <div className="fixed right-4 top-[4.5rem] z-50 flex items-center gap-2 sm:right-6 md:top-5">
        <button
          type="button"
          onClick={() => setToolsOpen((value) => !value)}
          aria-pressed={toolsOpen}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--loombus-border)] bg-[color:color-mix(in_srgb,var(--loombus-surface)_92%,transparent)] px-3 text-xs font-semibold text-[var(--loombus-text)] shadow-sm backdrop-blur-xl"
        >
          <PanelRight className="h-4 w-4 text-[var(--loombus-gold)]" aria-hidden="true" />
          Tools
        </button>
        <button
          type="button"
          onClick={() => setAppearanceOpen((value) => !value)}
          aria-expanded={appearanceOpen}
          className="grid h-10 w-10 place-items-center rounded-full border border-[var(--loombus-border)] bg-[color:color-mix(in_srgb,var(--loombus-surface)_92%,transparent)] text-[var(--loombus-text)] shadow-sm backdrop-blur-xl"
          aria-label="Reader appearance"
        >
          <SlidersHorizontal className="h-4 w-4 text-[var(--loombus-gold)]" aria-hidden="true" />
        </button>
      </div>

      {appearanceOpen ? (
        <section className="fixed right-4 top-[7.5rem] z-50 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-[var(--loombus-border)] bg-[color:color-mix(in_srgb,var(--loombus-surface)_96%,transparent)] p-4 text-[var(--loombus-text)] shadow-2xl backdrop-blur-2xl sm:right-6 md:top-[4.25rem]" aria-label="Reader appearance settings">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-[var(--loombus-gold)]" aria-hidden="true" /><h2 className="text-sm font-semibold">Appearance</h2></div>
            <button type="button" onClick={() => setAppearanceOpen(false)} aria-label="Close Reader appearance"><X className="h-4 w-4" /></button>
          </div>

          <div className="mt-4 grid gap-4">
            <fieldset>
              <legend className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--loombus-text-subtle)]">Page theme</legend>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(["loombus", "quiet", "paper"] as ReaderTheme[]).map((theme) => <button key={theme} type="button" onClick={() => setPreferences((current) => ({ ...current, theme }))} aria-pressed={preferences.theme === theme} className={`rounded-xl border px-2 py-2 text-xs font-semibold capitalize ${preferences.theme === theme ? "border-[var(--loombus-gold)] bg-[var(--loombus-gold-surface)]" : "border-[var(--loombus-border)]"}`}>{theme}</button>)}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--loombus-text-subtle)]">Typeface</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setPreferences((current) => ({ ...current, font: "serif" }))} aria-pressed={preferences.font === "serif"} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${preferences.font === "serif" ? "border-[var(--loombus-gold)] bg-[var(--loombus-gold-surface)]" : "border-[var(--loombus-border)]"}`} style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>Serif</button>
                <button type="button" onClick={() => setPreferences((current) => ({ ...current, font: "sans" }))} aria-pressed={preferences.font === "sans"} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${preferences.font === "sans" ? "border-[var(--loombus-gold)] bg-[var(--loombus-gold-surface)]" : "border-[var(--loombus-border)]"}`}>Sans</button>
              </div>
            </fieldset>

            <label className="grid gap-2 text-xs font-semibold">Line spacing
              <input type="range" min="1.5" max="2.2" step="0.1" value={preferences.lineHeight} onChange={(event) => setPreferences((current) => ({ ...current, lineHeight: Number(event.target.value) }))} />
            </label>

            <label className="grid gap-2 text-xs font-semibold">Reading width
              <input type="range" min="38" max="60" step="2" value={preferences.width} onChange={(event) => setPreferences((current) => ({ ...current, width: Number(event.target.value) }))} />
            </label>

            <fieldset>
              <legend className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--loombus-text-subtle)]">Desktop layout</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setPreferences((current) => ({ ...current, columns: "one" }))} aria-pressed={preferences.columns === "one"} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${preferences.columns === "one" ? "border-[var(--loombus-gold)] bg-[var(--loombus-gold-surface)]" : "border-[var(--loombus-border)]"}`}>One column</button>
                <button type="button" onClick={() => setPreferences((current) => ({ ...current, columns: "two" }))} aria-pressed={preferences.columns === "two"} className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${preferences.columns === "two" ? "border-[var(--loombus-gold)] bg-[var(--loombus-gold-surface)]" : "border-[var(--loombus-border)]"}`}><Columns2 className="h-3.5 w-3.5" aria-hidden="true" />Two columns</button>
              </div>
            </fieldset>
          </div>
        </section>
      ) : null}

      <style jsx global>{`
        .loombus-reader-modernized main > div.mx-auto.max-w-6xl { max-width: 96rem; }
        .loombus-reader-modernized main > div > header {
          position: sticky;
          top: 0;
          z-index: 30;
          margin-inline: -0.5rem;
          padding: 0.65rem 0.5rem;
          border-bottom-color: transparent;
          background: color-mix(in srgb, var(--loombus-page-bg) 88%, transparent);
          backdrop-filter: blur(18px);
        }
        .loombus-reader-modernized main > div > div.mt-6 { grid-template-columns: minmax(0, 1fr); }
        .loombus-reader-modernized main article {
          margin-inline: auto;
          width: 100%;
          max-width: calc(var(--library-reader-width, 48rem) + 8rem);
          border-color: color-mix(in srgb, var(--loombus-border) 70%, transparent);
          box-shadow: 0 24px 70px rgb(0 0 0 / 0.07);
        }
        .loombus-reader-modernized main article > div { max-width: var(--library-reader-width, 48rem); }
        .loombus-reader-modernized main article [ref] { line-height: var(--library-reader-line-height, 1.9); }
        .loombus-reader-modernized main article div.whitespace-pre-line { line-height: var(--library-reader-line-height, 1.9); }
        .loombus-reader-modernized[data-library-reader-font="serif"] main article div.whitespace-pre-line { font-family: Georgia, "Times New Roman", serif; }
        .loombus-reader-modernized[data-library-reader-font="sans"] main article div.whitespace-pre-line { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        .loombus-reader-modernized main aside { display: none; }
        .loombus-reader-modernized[data-library-reader-tools="open"] main > div > div.mt-6 { grid-template-columns: minmax(0, 1fr) 20rem; }
        .loombus-reader-modernized[data-library-reader-tools="open"] main aside { display: block; }
        .loombus-reader-modernized[data-library-reader-tools="open"] main article { max-width: calc(var(--library-reader-width, 48rem) + 6rem); }
        .loombus-reader-modernized[data-library-reader-theme="quiet"] main article { --loombus-reader-paper: #f3f0e8; color: #25231f; }
        .loombus-reader-modernized[data-library-reader-theme="paper"] main article { --loombus-reader-paper: #fffdf7; color: #27231c; }
        .loombus-reader-modernized[data-library-reader-theme="quiet"] main article .text-\[var\(--loombus-text-muted\)\],
        .loombus-reader-modernized[data-library-reader-theme="paper"] main article .text-\[var\(--loombus-text-muted\)\] { color: #6c665c; }
        @media (min-width: 1280px) {
          .loombus-reader-modernized[data-library-reader-columns="two"]:not([data-library-reader-tools="open"]) main article { max-width: min(86rem, calc(100vw - 8rem)); }
          .loombus-reader-modernized[data-library-reader-columns="two"]:not([data-library-reader-tools="open"]) main article > div { max-width: none; }
          .loombus-reader-modernized[data-library-reader-columns="two"] main article div.whitespace-pre-line {
            column-count: 2;
            column-gap: 4rem;
            column-rule: 1px solid color-mix(in srgb, var(--loombus-border) 55%, transparent);
          }
        }
        @media (max-width: 1023px) {
          .loombus-reader-modernized main aside,
          .loombus-reader-modernized[data-library-reader-tools="open"] main aside { display: block; }
          .loombus-reader-modernized[data-library-reader-tools="open"] main > div > div.mt-6 { grid-template-columns: minmax(0, 1fr); }
        }
      `}</style>
    </>
  );
}
