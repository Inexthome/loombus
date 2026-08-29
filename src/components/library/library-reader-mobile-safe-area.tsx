"use client";

export function LibraryReaderMobileSafeArea() {
  return (
    <style jsx global>{`
      @media (max-width: 767px) {
        [data-library-reader-root="true"] {
          --library-reader-safe-top: max(0px, env(safe-area-inset-top, 0px));
          --library-reader-safe-bottom: max(0px, env(safe-area-inset-bottom, 0px));
          --library-reader-safe-left: max(0px, env(safe-area-inset-left, 0px));
          --library-reader-safe-right: max(0px, env(safe-area-inset-right, 0px));
        }

        [data-library-reader-root="true"] > header {
          height: calc(4rem + var(--library-reader-safe-top)) !important;
          padding-top: var(--library-reader-safe-top) !important;
          padding-left: max(1rem, calc(var(--library-reader-safe-left) + 0.75rem)) !important;
          padding-right: max(1rem, calc(var(--library-reader-safe-right) + 0.75rem)) !important;
        }

        [data-library-reader-root="true"] > header a,
        [data-library-reader-root="true"] > header button {
          min-width: 44px;
          min-height: 44px;
        }

        [data-library-reader-root="true"] [aria-label="Reader controls"] {
          position: fixed !important;
          right: max(1rem, calc(var(--library-reader-safe-right) + 0.75rem)) !important;
          bottom: max(1.25rem, calc(var(--library-reader-safe-bottom) + 1.25rem)) !important;
          min-width: 56px;
          min-height: 56px;
        }

        [data-library-reader-root="true"] [data-library-reader-mobile-sheet="true"] {
          left: max(0.75rem, calc(var(--library-reader-safe-left) + 0.5rem)) !important;
          right: max(0.75rem, calc(var(--library-reader-safe-right) + 0.5rem)) !important;
          bottom: max(5.75rem, calc(var(--library-reader-safe-bottom) + 5.75rem)) !important;
          max-height: calc(100dvh - var(--library-reader-safe-top) - var(--library-reader-safe-bottom) - 7.5rem) !important;
        }

        [data-library-reader-root="true"] [data-library-reader-selection-toolbar="true"] {
          bottom: max(6.5rem, calc(var(--library-reader-safe-bottom) + 6.5rem)) !important;
          max-height: calc(100dvh - var(--library-reader-safe-top) - var(--library-reader-safe-bottom) - 8rem) !important;
        }

        [data-library-reader-root="true"] > aside {
          padding-top: calc(1.25rem + var(--library-reader-safe-top)) !important;
          padding-bottom: calc(1.25rem + var(--library-reader-safe-bottom)) !important;
          padding-left: max(1.25rem, calc(var(--library-reader-safe-left) + 1rem)) !important;
          padding-right: max(1.25rem, calc(var(--library-reader-safe-right) + 1rem)) !important;
        }

        [data-library-reader-root="true"] > div.absolute.inset-x-0.bottom-5 {
          bottom: max(1rem, calc(var(--library-reader-safe-bottom) + 1rem)) !important;
        }
      }
    `}</style>
  );
}
