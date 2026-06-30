export function V2AppearanceStyle() {
  return (
    <style>{`
      html[data-loombus-theme] .loombus-v2-page-bg {
        --v2-light-page: #f4f4f5;
        --v2-light-surface: #ffffff;
        --v2-light-surface-muted: #f8fafc;
        --v2-light-border: #d4d4d8;
        --v2-light-text: #18181b;
        --v2-light-muted: #52525b;
        --v2-dark-page: #050505;
        --v2-dark-surface: #0f0f10;
        --v2-dark-surface-muted: #18181b;
        --v2-dark-surface-strong: #27272a;
        --v2-dark-border: #3f3f46;
        --v2-dark-border-strong: #52525b;
        --v2-dark-text: #f4f4f5;
        --v2-dark-muted: #cbd5e1;
        --v2-gold: #fbbf24;
        --v2-gold-soft: #fef3c7;
      }

      html[data-loombus-theme="light"] .loombus-v2-page-bg {
        background:
          radial-gradient(circle at 50% -16%, rgba(24, 24, 27, 0.035), transparent 34rem),
          var(--v2-light-page) !important;
        color: var(--v2-light-text) !important;
      }

      html[data-loombus-theme="light"] .loombus-v2-page-bg :is([class*="bg-white"], [class*="bg-slate-50"], [class*="bg-zinc-50"], [class*="bg-gray-50"]) {
        color: var(--v2-light-text) !important;
      }

      html[data-loombus-theme="light"] .loombus-v2-page-bg :is([class*="text-white"], [class*="text-slate-50"], [class*="text-zinc-50"]):not([class*="bg-slate-9"]):not([class*="bg-zinc-9"]):not([class*="bg-black"]) {
        color: var(--v2-light-text) !important;
      }

      html[data-loombus-theme="light"] .loombus-v2-page-bg :is([class*="bg-amber-50"], [class*="bg-amber-100"], [class*="bg-orange-50"], [class*="bg-orange-100"], [class*="bg-yellow-50"], [class*="bg-yellow-100"], [class*="bg-emerald-50"], [class*="bg-emerald-100"], [class*="bg-green-50"], [class*="bg-green-100"], [class*="bg-blue-50"], [class*="bg-blue-100"], [class*="bg-sky-50"], [class*="bg-sky-100"], [class*="bg-indigo-50"], [class*="bg-indigo-100"], [class*="bg-violet-50"], [class*="bg-violet-100"], [class*="bg-purple-50"], [class*="bg-purple-100"], [class*="bg-pink-50"], [class*="bg-pink-100"]) {
        color: var(--v2-light-text) !important;
      }

      html[data-loombus-theme="light"] .loombus-v2-page-bg :is([class*="bg-amber-50"], [class*="bg-amber-100"], [class*="bg-orange-50"], [class*="bg-orange-100"], [class*="bg-yellow-50"], [class*="bg-yellow-100"], [class*="bg-emerald-50"], [class*="bg-emerald-100"], [class*="bg-green-50"], [class*="bg-green-100"], [class*="bg-blue-50"], [class*="bg-blue-100"], [class*="bg-sky-50"], [class*="bg-sky-100"], [class*="bg-indigo-50"], [class*="bg-indigo-100"], [class*="bg-violet-50"], [class*="bg-violet-100"], [class*="bg-purple-50"], [class*="bg-purple-100"], [class*="bg-pink-50"], [class*="bg-pink-100"]) :is(span, p, small, strong, h1, h2, h3, h4, h5, h6, svg, path) {
        color: inherit !important;
        stroke: currentColor !important;
      }

      html[data-loombus-theme="dark"] .loombus-v2-page-bg {
        background:
          radial-gradient(circle at 50% -16%, rgba(255, 255, 255, 0.055), transparent 34rem),
          var(--v2-dark-page) !important;
        color: var(--v2-dark-text) !important;
      }

      html[data-loombus-theme="dark"] .loombus-v2-page-bg :is(h1, h2, h3, h4, h5, h6),
      html[data-loombus-theme="dark"] .loombus-v2-page-bg :is([class*="text-slate-950"], [class*="text-slate-900"], [class*="text-zinc-950"], [class*="text-zinc-900"], [class*="text-gray-950"], [class*="text-gray-900"], [class*="text-blue-950"], [class*="text-blue-900"], [class*="text-blue-800"], [class*="text-amber-950"], [class*="text-amber-900"]) {
        color: var(--v2-dark-text) !important;
      }

      html[data-loombus-theme="dark"] .loombus-v2-page-bg :is(p, li, span, small, dt, dd),
      html[data-loombus-theme="dark"] .loombus-v2-page-bg :is([class*="text-slate-700"], [class*="text-slate-600"], [class*="text-slate-500"], [class*="text-zinc-700"], [class*="text-zinc-600"], [class*="text-zinc-500"], [class*="text-gray-700"], [class*="text-gray-600"], [class*="text-gray-500"]) {
        color: var(--v2-dark-muted) !important;
      }

      html[data-loombus-theme="dark"] .loombus-v2-page-bg :is(article, section, aside, div, form, nav):is([class*="bg-white"], [class*="bg-slate-50"], [class*="bg-slate-100"], [class*="bg-zinc-50"], [class*="bg-zinc-100"], [class*="bg-gray-50"], [class*="bg-gray-100"]) {
        background-color: var(--v2-dark-surface-muted) !important;
        border-color: var(--v2-dark-border-strong) !important;
        color: var(--v2-dark-text) !important;
      }

      html[data-loombus-theme="dark"] .loombus-v2-page-bg :is([class*="border-slate-200"], [class*="border-slate-300"], [class*="border-zinc-200"], [class*="border-zinc-300"], [class*="border-gray-200"], [class*="border-gray-300"], [class*="border-blue-200"], [class*="border-amber-200"]) {
        border-color: var(--v2-dark-border) !important;
      }

      html[data-loombus-theme="dark"] .loombus-v2-page-bg :is(button, a, span, label):is([class*="rounded"], [class*="bg-white"], [class*="bg-slate-50"], [class*="bg-slate-100"], [class*="bg-zinc-50"], [class*="bg-zinc-100"], [class*="bg-gray-50"], [class*="bg-gray-100"], [class*="bg-amber-50"], [class*="bg-amber-100"], [class*="bg-orange-50"], [class*="bg-orange-100"], [class*="bg-yellow-50"], [class*="bg-yellow-100"], [class*="bg-emerald-50"], [class*="bg-emerald-100"], [class*="bg-green-50"], [class*="bg-green-100"], [class*="bg-blue-50"], [class*="bg-blue-100"], [class*="bg-sky-50"], [class*="bg-sky-100"], [class*="bg-indigo-50"], [class*="bg-indigo-100"], [class*="bg-violet-50"], [class*="bg-violet-100"], [class*="bg-purple-50"], [class*="bg-purple-100"], [class*="bg-pink-50"], [class*="bg-pink-100"]) {
        background-color: var(--v2-dark-surface-muted) !important;
        border-color: var(--v2-dark-border-strong) !important;
        color: var(--v2-dark-text) !important;
      }

      html[data-loombus-theme="dark"] .loombus-v2-page-bg :is(button, a, span, label):is([class*="rounded"], [class*="bg-white"], [class*="bg-slate-50"], [class*="bg-slate-100"], [class*="bg-zinc-50"], [class*="bg-zinc-100"], [class*="bg-gray-50"], [class*="bg-gray-100"], [class*="bg-amber-50"], [class*="bg-amber-100"], [class*="bg-orange-50"], [class*="bg-orange-100"], [class*="bg-yellow-50"], [class*="bg-yellow-100"], [class*="bg-emerald-50"], [class*="bg-emerald-100"], [class*="bg-green-50"], [class*="bg-green-100"], [class*="bg-blue-50"], [class*="bg-blue-100"], [class*="bg-sky-50"], [class*="bg-sky-100"], [class*="bg-indigo-50"], [class*="bg-indigo-100"], [class*="bg-violet-50"], [class*="bg-violet-100"], [class*="bg-purple-50"], [class*="bg-purple-100"], [class*="bg-pink-50"], [class*="bg-pink-100"]) :is(span, p, small, strong, h1, h2, h3, h4, h5, h6, svg, path) {
        color: inherit !important;
        stroke: currentColor !important;
      }

      html[data-loombus-theme="dark"] .loombus-v2-page-bg :is(button, a):hover {
        color: #ffffff !important;
      }

      html[data-loombus-theme="dark"] .loombus-v2-page-bg :is(input, textarea, select) {
        background-color: #09090b !important;
        border-color: var(--v2-dark-border-strong) !important;
        color: var(--v2-dark-text) !important;
      }

      html[data-loombus-theme="dark"] .loombus-v2-page-bg ::placeholder {
        color: #a1a1aa !important;
      }

      html[data-loombus-theme="dark"] .loombus-v2-top-nav,
      html[data-loombus-theme="dark"] .loombus-v2-bottom-nav {
        background: rgba(5, 5, 5, 0.96) !important;
        border-color: #27272a !important;
        color: var(--v2-dark-text) !important;
      }

      html[data-loombus-theme="dark"] .loombus-v2-top-nav :is(a, button, span, svg),
      html[data-loombus-theme="dark"] .loombus-v2-bottom-nav :is(a, button, span, svg) {
        color: var(--v2-dark-text) !important;
        stroke: currentColor !important;
      }

      html[data-loombus-theme="dark"] .v2-avatar-menu-inline > div {
        background-color: rgba(15, 15, 16, 0.98) !important;
        border-color: var(--v2-dark-border) !important;
        color: var(--v2-dark-text) !important;
      }

      @media (prefers-color-scheme: dark) {
        html[data-loombus-theme="system"] .loombus-v2-page-bg {
          background:
            radial-gradient(circle at 50% -16%, rgba(255, 255, 255, 0.055), transparent 34rem),
            var(--v2-dark-page) !important;
          color: var(--v2-dark-text) !important;
        }

        html[data-loombus-theme="system"] .loombus-v2-page-bg :is(h1, h2, h3, h4, h5, h6),
        html[data-loombus-theme="system"] .loombus-v2-page-bg :is([class*="text-slate-950"], [class*="text-slate-900"], [class*="text-zinc-950"], [class*="text-zinc-900"], [class*="text-gray-950"], [class*="text-gray-900"], [class*="text-blue-950"], [class*="text-blue-900"], [class*="text-blue-800"], [class*="text-amber-950"], [class*="text-amber-900"]) {
          color: var(--v2-dark-text) !important;
        }

        html[data-loombus-theme="system"] .loombus-v2-page-bg :is(p, li, span, small, dt, dd),
        html[data-loombus-theme="system"] .loombus-v2-page-bg :is([class*="text-slate-700"], [class*="text-slate-600"], [class*="text-slate-500"], [class*="text-zinc-700"], [class*="text-zinc-600"], [class*="text-zinc-500"], [class*="text-gray-700"], [class*="text-gray-600"], [class*="text-gray-500"]) {
          color: var(--v2-dark-muted) !important;
        }

        html[data-loombus-theme="system"] .loombus-v2-page-bg :is(article, section, aside, div, form, nav):is([class*="bg-white"], [class*="bg-slate-50"], [class*="bg-slate-100"], [class*="bg-zinc-50"], [class*="bg-zinc-100"], [class*="bg-gray-50"], [class*="bg-gray-100"]) {
          background-color: var(--v2-dark-surface-muted) !important;
          border-color: var(--v2-dark-border-strong) !important;
          color: var(--v2-dark-text) !important;
        }

        html[data-loombus-theme="system"] .loombus-v2-page-bg :is([class*="border-slate-200"], [class*="border-slate-300"], [class*="border-zinc-200"], [class*="border-zinc-300"], [class*="border-gray-200"], [class*="border-gray-300"], [class*="border-blue-200"], [class*="border-amber-200"]) {
          border-color: var(--v2-dark-border) !important;
        }

        html[data-loombus-theme="system"] .loombus-v2-page-bg :is(button, a, span, label):is([class*="rounded"], [class*="bg-white"], [class*="bg-slate-50"], [class*="bg-slate-100"], [class*="bg-zinc-50"], [class*="bg-zinc-100"], [class*="bg-gray-50"], [class*="bg-gray-100"], [class*="bg-amber-50"], [class*="bg-amber-100"], [class*="bg-orange-50"], [class*="bg-orange-100"], [class*="bg-yellow-50"], [class*="bg-yellow-100"], [class*="bg-emerald-50"], [class*="bg-emerald-100"], [class*="bg-green-50"], [class*="bg-green-100"], [class*="bg-blue-50"], [class*="bg-blue-100"], [class*="bg-sky-50"], [class*="bg-sky-100"], [class*="bg-indigo-50"], [class*="bg-indigo-100"], [class*="bg-violet-50"], [class*="bg-violet-100"], [class*="bg-purple-50"], [class*="bg-purple-100"], [class*="bg-pink-50"], [class*="bg-pink-100"]) {
          background-color: var(--v2-dark-surface-muted) !important;
          border-color: var(--v2-dark-border-strong) !important;
          color: var(--v2-dark-text) !important;
        }

        html[data-loombus-theme="system"] .loombus-v2-page-bg :is(button, a, span, label):is([class*="rounded"], [class*="bg-white"], [class*="bg-slate-50"], [class*="bg-slate-100"], [class*="bg-zinc-50"], [class*="bg-zinc-100"], [class*="bg-gray-50"], [class*="bg-gray-100"], [class*="bg-amber-50"], [class*="bg-amber-100"], [class*="bg-orange-50"], [class*="bg-orange-100"], [class*="bg-yellow-50"], [class*="bg-yellow-100"], [class*="bg-emerald-50"], [class*="bg-emerald-100"], [class*="bg-green-50"], [class*="bg-green-100"], [class*="bg-blue-50"], [class*="bg-blue-100"], [class*="bg-sky-50"], [class*="bg-sky-100"], [class*="bg-indigo-50"], [class*="bg-indigo-100"], [class*="bg-violet-50"], [class*="bg-violet-100"], [class*="bg-purple-50"], [class*="bg-purple-100"], [class*="bg-pink-50"], [class*="bg-pink-100"]) :is(span, p, small, strong, h1, h2, h3, h4, h5, h6, svg, path) {
          color: inherit !important;
          stroke: currentColor !important;
        }

        html[data-loombus-theme="system"] .loombus-v2-page-bg :is(button, a):hover {
          color: #ffffff !important;
        }

        html[data-loombus-theme="system"] .loombus-v2-page-bg :is(input, textarea, select) {
          background-color: #09090b !important;
          border-color: var(--v2-dark-border-strong) !important;
          color: var(--v2-dark-text) !important;
        }

        html[data-loombus-theme="system"] .loombus-v2-page-bg ::placeholder {
          color: #a1a1aa !important;
        }

        html[data-loombus-theme="system"] .loombus-v2-top-nav,
        html[data-loombus-theme="system"] .loombus-v2-bottom-nav {
          background: rgba(5, 5, 5, 0.96) !important;
          border-color: #27272a !important;
          color: var(--v2-dark-text) !important;
        }

        html[data-loombus-theme="system"] .loombus-v2-top-nav :is(a, button, span, svg),
        html[data-loombus-theme="system"] .loombus-v2-bottom-nav :is(a, button, span, svg) {
          color: var(--v2-dark-text) !important;
          stroke: currentColor !important;
        }

        html[data-loombus-theme="system"] .v2-avatar-menu-inline > div {
          background-color: rgba(15, 15, 16, 0.98) !important;
          border-color: var(--v2-dark-border) !important;
          color: var(--v2-dark-text) !important;
        }
      }
    `}</style>
  );
}
