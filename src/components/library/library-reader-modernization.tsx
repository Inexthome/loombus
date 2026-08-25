"use client";

import { useEffect } from "react";

export const LIBRARY_READER_PREFERENCES_KEY = "loombus-library-reader-modernization";

export type LibraryReaderTheme = "loombus" | "quiet" | "paper" | "night";
export type LibraryReaderFont = "serif" | "sans";
export type LibraryReaderSpread = "auto" | "one" | "two";
export type LibraryReaderPreferences = {
  theme: LibraryReaderTheme;
  font: LibraryReaderFont;
  fontSize: number;
  lineHeight: number;
  width: number;
  spread: LibraryReaderSpread;
};

export const LIBRARY_READER_DEFAULTS: LibraryReaderPreferences = {
  theme: "paper",
  font: "serif",
  fontSize: 18,
  lineHeight: 1.7,
  width: 46,
  spread: "auto",
};

export function readLibraryReaderPreferences(): LibraryReaderPreferences {
  if (typeof window === "undefined") return LIBRARY_READER_DEFAULTS;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LIBRARY_READER_PREFERENCES_KEY) ?? "{}") as Partial<LibraryReaderPreferences>;
    return {
      theme: parsed.theme === "loombus" || parsed.theme === "quiet" || parsed.theme === "paper" || parsed.theme === "night" ? parsed.theme : LIBRARY_READER_DEFAULTS.theme,
      font: parsed.font === "sans" ? "sans" : "serif",
      fontSize: typeof parsed.fontSize === "number" ? Math.min(30, Math.max(14, parsed.fontSize)) : LIBRARY_READER_DEFAULTS.fontSize,
      lineHeight: typeof parsed.lineHeight === "number" ? Math.min(2.2, Math.max(1.35, parsed.lineHeight)) : LIBRARY_READER_DEFAULTS.lineHeight,
      width: typeof parsed.width === "number" ? Math.min(58, Math.max(34, parsed.width)) : LIBRARY_READER_DEFAULTS.width,
      spread: parsed.spread === "one" || parsed.spread === "two" ? parsed.spread : "auto",
    };
  } catch {
    return LIBRARY_READER_DEFAULTS;
  }
}

export function LibraryReaderModernization() {
  useEffect(() => {
    document.body.classList.add("loombus-reader-paginated");
    return () => document.body.classList.remove("loombus-reader-paginated");
  }, []);

  return (
    <style jsx global>{`
      body.loombus-reader-paginated { overflow: hidden; }
      body.loombus-reader-paginated [data-loombus-shell-bottom-nav] { display: none !important; }
      @media (max-width: 767px) {
        body.loombus-reader-paginated { overscroll-behavior-x: none; }
      }
    `}</style>
  );
}
