"use client";

export function V2AppearanceStyles() {
  return (
    <style jsx global>{`
      /* V2 appearance is handled by globals.css via html[data-loombus-theme].
         V2AppearanceProvider writes data-loombus-theme to <html>, which
         activates the same CSS variable system V1 uses. No custom overrides
         are needed here. */

      /* Article grid fix — hides decorative gradient media on discussion cards */
      main article:has(> a[href^="/v2/discussions/"][class~="bg-gradient-to-br"]) {
        grid-template-columns: minmax(0, 1fr) !important;
      }
      main article:has(> a[href^="/v2/discussions/"][class~="bg-gradient-to-br"]) > a[href^="/v2/discussions/"][class~="bg-gradient-to-br"] {
        display: none !important;
      }
    `}</style>
  );
}
