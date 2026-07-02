import type { ReactNode } from "react";
import { V2ShellLinkRouter } from "./v2-shell-link-router";
import { V2AppearanceProvider } from "./v2-appearance";

export default function V2Layout({ children }: { children: ReactNode }) {
  return (
    <V2AppearanceProvider>
      <style>{`
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

        html[data-loombus-theme] main[class*="loombus-v2-page-bg"] [class~="text-blue-500"],
        html[data-loombus-theme] main[class*="loombus-v2-page-bg"] [class~="text-blue-600"],
        html[data-loombus-theme] main[class*="loombus-v2-page-bg"] [class~="text-blue-700"],
        html[data-loombus-theme] main[class*="loombus-v2-page-bg"] [class~="text-blue-800"] {
          color: var(--loombus-text-muted) !important;
        }

        html[data-loombus-theme] main[class*="loombus-v2-page-bg"] [class~="hover:text-blue-600"]:hover,
        html[data-loombus-theme] main[class*="loombus-v2-page-bg"] [class~="hover:text-blue-700"]:hover,
        html[data-loombus-theme] main[class*="loombus-v2-page-bg"] [class~="hover:text-blue-800"]:hover {
          color: var(--loombus-text) !important;
        }

        html[data-loombus-theme] main[class*="loombus-v2-page-bg"] [class~="bg-blue-50"],
        html[data-loombus-theme] main[class*="loombus-v2-page-bg"] [class~="bg-blue-50/40"],
        html[data-loombus-theme] main[class*="loombus-v2-page-bg"] [class~="bg-blue-100"] {
          background-color: var(--loombus-surface-strong) !important;
        }

        html[data-loombus-theme] main[class*="loombus-v2-page-bg"] [class~="bg-blue-600"],
        html[data-loombus-theme] main[class*="loombus-v2-page-bg"] [class~="bg-blue-700"] {
          background-color: var(--loombus-primary-bg) !important;
          color: var(--loombus-primary-text) !important;
        }

        html[data-loombus-theme] main[class*="loombus-v2-page-bg"] [class~="hover:bg-blue-50"]:hover,
        html[data-loombus-theme] main[class*="loombus-v2-page-bg"] [class~="hover:bg-blue-50/40"]:hover,
        html[data-loombus-theme] main[class*="loombus-v2-page-bg"] [class~="hover:bg-blue-100"]:hover {
          background-color: var(--loombus-surface-muted) !important;
        }

        html[data-loombus-theme] main[class*="loombus-v2-page-bg"] [class~="border-blue-200"],
        html[data-loombus-theme] main[class*="loombus-v2-page-bg"] [class~="border-blue-300"],
        html[data-loombus-theme] main[class*="loombus-v2-page-bg"] [class~="border-blue-600"],
        html[data-loombus-theme] main[class*="loombus-v2-page-bg"] [class~="border-blue-700"] {
          border-color: var(--loombus-border) !important;
        }

        html[data-loombus-theme] main[class*="loombus-v2-page-bg"] [class~="hover:border-blue-200"]:hover,
        html[data-loombus-theme] main[class*="loombus-v2-page-bg"] [class~="hover:border-blue-300"]:hover,
        html[data-loombus-theme] main[class*="loombus-v2-page-bg"] [class~="hover:border-blue-600"]:hover {
          border-color: var(--loombus-text-subtle) !important;
        }

        html[data-loombus-theme] main[class*="loombus-v2-page-bg"] [class~="ring-blue-200"],
        html[data-loombus-theme] main[class*="loombus-v2-page-bg"] [class~="ring-blue-300"],
        html[data-loombus-theme] main[class*="loombus-v2-page-bg"] [class~="ring-blue-600"] {
          --tw-ring-color: color-mix(in srgb, var(--loombus-border) 70%, var(--loombus-text) 14%) !important;
        }

        /* Stage 1: Light-only contrast repair. Do not change Dark yet. */
        html[data-loombus-theme="light"] .loombus-v2-top-nav :is(a, button, svg, [class~="text-blue-100"], [class~="text-blue-200"], [class~="text-blue-300"], [class~="text-blue-400"], [class~="text-blue-500"], [class~="text-blue-600"], [class~="text-blue-700"], [class~="text-white"]) {
          color: #52525b !important;
          stroke: currentColor !important;
        }

        html[data-loombus-theme="light"] .loombus-v2-top-nav :is(a, button):hover,
        html[data-loombus-theme="light"] .loombus-v2-top-nav :is([class~="hover:text-white"], [class~="hover:text-blue-700"]):hover {
          color: #18181b !important;
          background-color: #f4f4f5 !important;
          border-color: #d4d4d8 !important;
        }

        html[data-loombus-theme="light"] .loombus-v2-top-nav :is(a[class~="border"], a[aria-current="page"], a[data-active="true"]) {
          color: #18181b !important;
          background-color: #ffffff !important;
          border-color: #d4d4d8 !important;
          box-shadow: 0 10px 24px rgba(24, 24, 27, 0.08) !important;
        }

        html[data-loombus-theme="light"] .loombus-v2-top-nav :is([class~="bg-blue-500"], [class~="bg-blue-600"], [class~="bg-blue-700"]) {
          background-color: #18181b !important;
          color: #ffffff !important;
        }

        html[data-loombus-theme="light"] main[class*="loombus-v2-page-bg"] :is(a, button):is([class~="bg-blue-600"], [class~="bg-blue-700"], [class~="bg-black"], [class~="bg-slate-950"], [class~="bg-zinc-950"], [class~="bg-zinc-900"]) {
          background-color: #ffffff !important;
          color: #18181b !important;
          border: 1px solid #d4d4d8 !important;
          box-shadow: 0 12px 28px rgba(24, 24, 27, 0.08) !important;
        }

        html[data-loombus-theme="light"] main[class*="loombus-v2-page-bg"] :is(a, button):is([class~="bg-blue-600"], [class~="bg-blue-700"], [class~="bg-black"], [class~="bg-slate-950"], [class~="bg-zinc-950"], [class~="bg-zinc-900"]):hover {
          background-color: #f4f4f5 !important;
          border-color: #a1a1aa !important;
          color: #09090b !important;
        }

        html[data-loombus-theme="light"] main[class*="loombus-v2-page-bg"] :is(a, button):is([class~="bg-blue-600"], [class~="bg-blue-700"], [class~="bg-black"], [class~="bg-slate-950"], [class~="bg-zinc-950"], [class~="bg-zinc-900"]) * {
          color: inherit !important;
          stroke: currentColor !important;
        }

        @media (prefers-color-scheme: light) {
          html[data-loombus-theme="system"] .loombus-v2-top-nav :is(a, button, svg, [class~="text-blue-100"], [class~="text-blue-200"], [class~="text-blue-300"], [class~="text-blue-400"], [class~="text-blue-500"], [class~="text-blue-600"], [class~="text-blue-700"], [class~="text-white"]) {
            color: #52525b !important;
            stroke: currentColor !important;
          }

          html[data-loombus-theme="system"] .loombus-v2-top-nav :is(a, button):hover,
          html[data-loombus-theme="system"] .loombus-v2-top-nav :is([class~="hover:text-white"], [class~="hover:text-blue-700"]):hover {
            color: #18181b !important;
            background-color: #f4f4f5 !important;
            border-color: #d4d4d8 !important;
          }

          html[data-loombus-theme="system"] .loombus-v2-top-nav :is(a[class~="border"], a[aria-current="page"], a[data-active="true"]) {
            color: #18181b !important;
            background-color: #ffffff !important;
            border-color: #d4d4d8 !important;
            box-shadow: 0 10px 24px rgba(24, 24, 27, 0.08) !important;
          }

          html[data-loombus-theme="system"] .loombus-v2-top-nav :is([class~="bg-blue-500"], [class~="bg-blue-600"], [class~="bg-blue-700"]) {
            background-color: #18181b !important;
            color: #ffffff !important;
          }

          html[data-loombus-theme="system"] main[class*="loombus-v2-page-bg"] :is(a, button):is([class~="bg-blue-600"], [class~="bg-blue-700"], [class~="bg-black"], [class~="bg-slate-950"], [class~="bg-zinc-950"], [class~="bg-zinc-900"]) {
            background-color: #ffffff !important;
            color: #18181b !important;
            border: 1px solid #d4d4d8 !important;
            box-shadow: 0 12px 28px rgba(24, 24, 27, 0.08) !important;
          }

          html[data-loombus-theme="system"] main[class*="loombus-v2-page-bg"] :is(a, button):is([class~="bg-blue-600"], [class~="bg-blue-700"], [class~="bg-black"], [class~="bg-slate-950"], [class~="bg-zinc-950"], [class~="bg-zinc-900"]):hover {
            background-color: #f4f4f5 !important;
            border-color: #a1a1aa !important;
            color: #09090b !important;
          }

          html[data-loombus-theme="system"] main[class*="loombus-v2-page-bg"] :is(a, button):is([class~="bg-blue-600"], [class~="bg-blue-700"], [class~="bg-black"], [class~="bg-slate-950"], [class~="bg-zinc-950"], [class~="bg-zinc-900"]) * {
            color: inherit !important;
            stroke: currentColor !important;
          }
        }
      `}</style>
      {children}
      <V2ShellLinkRouter />
    </V2AppearanceProvider>
  );
}
