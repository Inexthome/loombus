"use client";

import { useLayoutEffect } from "react";

const MOBILE_COMPOSER_QUERY = "(max-width:767px)";

function isMobileComposerQuery(query: string) {
  return query.replace(/\s+/g, "") === MOBILE_COMPOSER_QUERY;
}

function unwrapMobileMediaRule(css: string) {
  const trimmed = css.trim();
  const opening = `@media ${MOBILE_COMPOSER_QUERY}{`;

  if (!trimmed.startsWith(opening) || !trimmed.endsWith("}")) {
    return css;
  }

  return trimmed.slice(opening.length, -1);
}

function createForcedMobileQueryList(query: string): MediaQueryList {
  return {
    matches: true,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => true,
  } as MediaQueryList;
}

export function ForceMobileComposerMode() {
  useLayoutEffect(() => {
    const originalMatchMedia = window.matchMedia.bind(window);
    const forcedMatchMedia = ((query: string) =>
      isMobileComposerQuery(query)
        ? createForcedMobileQueryList(query)
        : originalMatchMedia(query)) as typeof window.matchMedia;

    window.matchMedia = forcedMatchMedia;

    const adjustedStyles = new Map<HTMLStyleElement, string>();
    const adjustComposerStyles = () => {
      const styles = document.querySelectorAll<HTMLStyleElement>(
        'style[data-mc-ui="true"], style[data-mc-correction="true"]'
      );

      for (const style of styles) {
        if (adjustedStyles.has(style)) continue;
        const originalCss = style.textContent ?? "";
        adjustedStyles.set(style, originalCss);
        style.textContent = unwrapMobileMediaRule(originalCss);
      }
    };

    adjustComposerStyles();
    const timer = window.setInterval(adjustComposerStyles, 40);

    return () => {
      window.clearInterval(timer);
      window.matchMedia = originalMatchMedia;

      for (const [style, originalCss] of adjustedStyles) {
        if (style.isConnected) style.textContent = originalCss;
      }
    };
  }, []);

  return null;
}
