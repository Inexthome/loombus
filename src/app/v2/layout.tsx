import type { ReactNode } from "react";
import { V2ShellLinkRouter } from "./v2-shell-link-router";
import { V2UserAvatarMenu } from "./v2-user-avatar-menu";
import { V2AppearanceProvider } from "./v2-appearance";
import { V2CreateReviewAction } from "./create/v2-create-review-action";
import { V2CreateServerCheck } from "./create/v2-create-server-check";
import { V2CreateFinalLockCheck } from "./create/v2-create-final-lock-check";
import { V2CreateShadowRecordCheck } from "./create/v2-create-shadow-record-check";
import { V2CreateDryRunCheck } from "./create/v2-create-dry-run-check";
import { V2CreatePreflightStatusCheck } from "./create/v2-create-preflight-status-check";

export default function V2Layout({ children }: { children: ReactNode }) {
  return (
    <V2AppearanceProvider>
      <style>{`
        header a[href="/v2"] img[src="/assets/brand/loombus-mark-transparent.png"],
        header a[href="/v2"] span.text-xl {
          visibility: hidden !important;
        }

        header a[href="/v2"] {
          width: 2.75rem !important;
          min-width: 2.75rem !important;
          gap: 0 !important;
        }

        header nav a[href="/settings"] {
          display: none !important;
        }

        header nav {
          gap: clamp(0.45rem, 1vw, 0.9rem) !important;
          margin-left: clamp(1rem, 2vw, 2.5rem) !important;
          margin-right: clamp(1rem, 2vw, 2.5rem) !important;
        }

        header nav a {
          white-space: nowrap !important;
        }

        .v2-avatar-menu {
          left: max(1rem, calc((100vw - 80rem) / 2 + 1rem));
        }

        @media (min-width: 640px) {
          .v2-avatar-menu {
            left: max(1.5rem, calc((100vw - 80rem) / 2 + 1.5rem));
          }
        }

        @media (min-width: 1024px) {
          .v2-avatar-menu {
            left: max(2rem, calc((100vw - 80rem) / 2 + 2rem));
          }
        }

        /* V2 public appearance lock.
           Light/Dark/System must read as neutral Loombus themes, not Facebook-blue
           light mode or navy/gold dark mode. Keep this scoped to /v2 layout only. */
        html[data-loombus-theme] .loombus-v2-page-bg {
          background:
            radial-gradient(circle at 50% -12%, color-mix(in srgb, var(--loombus-text) 4%, transparent), transparent 34rem),
            var(--loombus-page-bg) !important;
          color: var(--loombus-text) !important;
        }

        html[data-loombus-theme] .loombus-v2-top-nav,
        html[data-loombus-theme] .loombus-v2-bottom-nav {
          background:
            linear-gradient(
              180deg,
              color-mix(in srgb, var(--loombus-surface) 94%, white 4%),
              var(--loombus-surface)
            ) !important;
          border-color: var(--loombus-border) !important;
          color: var(--loombus-text) !important;
          box-shadow: 0 18px 48px rgba(0, 0, 0, 0.12) !important;
        }

        html[data-loombus-theme="light"] .loombus-v2-page-bg {
          background:
            radial-gradient(circle at 50% -12%, rgba(24, 24, 27, 0.035), transparent 34rem),
            #f4f4f5 !important;
        }

        html[data-loombus-theme="light"] .loombus-v2-top-nav,
        html[data-loombus-theme="light"] .loombus-v2-bottom-nav {
          background: rgba(255, 255, 255, 0.96) !important;
          border-color: #d4d4d8 !important;
          color: #18181b !important;
          box-shadow: 0 18px 48px rgba(24, 24, 27, 0.08) !important;
        }

        @media (prefers-color-scheme: light) {
          html[data-loombus-theme="system"] .loombus-v2-page-bg {
            background:
              radial-gradient(circle at 50% -12%, rgba(24, 24, 27, 0.035), transparent 34rem),
              #f4f4f5 !important;
          }

          html[data-loombus-theme="system"] .loombus-v2-top-nav,
          html[data-loombus-theme="system"] .loombus-v2-bottom-nav {
            background: rgba(255, 255, 255, 0.96) !important;
            border-color: #d4d4d8 !important;
            color: #18181b !important;
            box-shadow: 0 18px 48px rgba(24, 24, 27, 0.08) !important;
          }
        }

        html[data-loombus-theme="dark"] .loombus-v2-top-nav,
        html[data-loombus-theme="dark"] .loombus-v2-bottom-nav {
          background: rgba(9, 9, 11, 0.96) !important;
          border-color: #27272a !important;
          color: #f4f4f5 !important;
        }

        @media (prefers-color-scheme: dark) {
          html[data-loombus-theme="system"] .loombus-v2-top-nav,
          html[data-loombus-theme="system"] .loombus-v2-bottom-nav {
            background: rgba(9, 9, 11, 0.96) !important;
            border-color: #27272a !important;
            color: #f4f4f5 !important;
          }
        }

        html[data-loombus-theme] main[class*="loombus-v2-page-bg"] [class*="text-blue-"] {
          color: var(--loombus-text-muted) !important;
        }

        html[data-loombus-theme] main[class*="loombus-v2-page-bg"] [class*="hover:text-blue-"]:hover,
        html[data-loombus-theme] main[class*="loombus-v2-page-bg"] a[class*="text-blue-"]:hover,
        html[data-loombus-theme] main[class*="loombus-v2-page-bg"] button[class*="text-blue-"]:hover {
          color: var(--loombus-text) !important;
        }

        html[data-loombus-theme] main[class*="loombus-v2-page-bg"] [class*="bg-blue-"] {
          background-color: var(--loombus-surface-strong) !important;
        }

        html[data-loombus-theme] main[class*="loombus-v2-page-bg"] [class*="bg-blue-600"],
        html[data-loombus-theme] main[class*="loombus-v2-page-bg"] [class*="bg-blue-700"] {
          background-color: var(--loombus-primary-bg) !important;
          color: var(--loombus-primary-text) !important;
        }

        html[data-loombus-theme] main[class*="loombus-v2-page-bg"] [class*="hover:bg-blue-"]:hover {
          background-color: var(--loombus-surface-muted) !important;
        }

        html[data-loombus-theme] main[class*="loombus-v2-page-bg"] [class*="border-blue-"] {
          border-color: var(--loombus-border) !important;
        }

        html[data-loombus-theme] main[class*="loombus-v2-page-bg"] [class*="hover:border-blue-"]:hover {
          border-color: var(--loombus-text-subtle) !important;
        }

        html[data-loombus-theme] main[class*="loombus-v2-page-bg"] [class*="ring-blue-"] {
          --tw-ring-color: color-mix(in srgb, var(--loombus-border) 70%, var(--loombus-text) 14%) !important;
        }

        html[data-loombus-theme] main[class*="loombus-v2-page-bg"] [class*="shadow-blue-"] {
          --tw-shadow-color: rgba(0, 0, 0, 0.16) !important;
        }
      `}</style>
      {children}
      <V2UserAvatarMenu />
      <V2ShellLinkRouter />
      <V2CreateReviewAction />
      <V2CreateServerCheck />
      <V2CreateFinalLockCheck />
      <V2CreateShadowRecordCheck />
      <V2CreateDryRunCheck />
      <V2CreatePreflightStatusCheck />
    </V2AppearanceProvider>
  );
}
