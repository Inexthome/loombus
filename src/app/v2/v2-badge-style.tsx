export function V2BadgeStyle() {
  return (
    <style>{`
      html[data-loombus-theme="dark"] .loombus-v2-page-bg,
      html[data-loombus-theme="system"] .loombus-v2-page-bg {
        --v2-dark-chip-bg: #18181b;
        --v2-dark-chip-bg-strong: #27272a;
        --v2-dark-chip-border: #52525b;
        --v2-dark-chip-text: #f4f4f5;
        --v2-dark-chip-muted: #d4d4d8;
      }

      html[data-loombus-theme="dark"] .loombus-v2-page-bg :is([class*="rounded-full"], [class*="rounded-2xl"], [class*="rounded-xl"]):is([class*="bg-white"], [class*="bg-slate-50"], [class*="bg-slate-100"], [class*="bg-slate-200"], [class*="bg-zinc-50"], [class*="bg-zinc-100"], [class*="bg-gray-50"], [class*="bg-gray-100"], [class*="bg-blue-50"], [class*="bg-blue-100"], [class*="bg-sky-50"], [class*="bg-sky-100"], [class*="bg-indigo-50"], [class*="bg-indigo-100"], [class*="bg-violet-50"], [class*="bg-violet-100"], [class*="bg-purple-50"], [class*="bg-purple-100"], [class*="bg-emerald-50"], [class*="bg-emerald-100"], [class*="bg-green-50"], [class*="bg-green-100"], [class*="bg-amber-50"], [class*="bg-amber-100"], [class*="bg-orange-50"], [class*="bg-orange-100"]),
      html[data-loombus-theme="dark"] .loombus-v2-page-bg :is(button, a, span):is([class*="bg-white"], [class*="bg-slate-50"], [class*="bg-slate-100"], [class*="bg-zinc-50"], [class*="bg-zinc-100"], [class*="bg-gray-50"], [class*="bg-gray-100"], [class*="bg-blue-50"], [class*="bg-blue-100"], [class*="bg-sky-50"], [class*="bg-sky-100"], [class*="bg-indigo-50"], [class*="bg-indigo-100"], [class*="bg-violet-50"], [class*="bg-violet-100"], [class*="bg-purple-50"], [class*="bg-purple-100"], [class*="bg-emerald-50"], [class*="bg-emerald-100"], [class*="bg-green-50"], [class*="bg-green-100"], [class*="bg-amber-50"], [class*="bg-amber-100"], [class*="bg-orange-50"], [class*="bg-orange-100"]) {
        background-color: var(--v2-dark-chip-bg) !important;
        border-color: var(--v2-dark-chip-border) !important;
        color: var(--v2-dark-chip-text) !important;
      }

      html[data-loombus-theme="dark"] .loombus-v2-page-bg :is(button, a):is([class*="hover:bg-white"], [class*="hover:bg-slate-50"], [class*="hover:bg-zinc-50"], [class*="hover:bg-blue-50"], [class*="hover:bg-amber-50"]):hover {
        background-color: var(--v2-dark-chip-bg-strong) !important;
        border-color: #71717a !important;
        color: #ffffff !important;
      }

      html[data-loombus-theme="dark"] .loombus-v2-page-bg :is([class*="rounded-full"], [class*="rounded-2xl"], [class*="rounded-xl"], button, a, span):is([class*="bg-white"], [class*="bg-slate-50"], [class*="bg-slate-100"], [class*="bg-zinc-50"], [class*="bg-zinc-100"], [class*="bg-gray-50"], [class*="bg-gray-100"], [class*="bg-blue-50"], [class*="bg-blue-100"], [class*="bg-sky-50"], [class*="bg-sky-100"], [class*="bg-indigo-50"], [class*="bg-indigo-100"], [class*="bg-violet-50"], [class*="bg-violet-100"], [class*="bg-purple-50"], [class*="bg-purple-100"], [class*="bg-emerald-50"], [class*="bg-emerald-100"], [class*="bg-green-50"], [class*="bg-green-100"], [class*="bg-amber-50"], [class*="bg-amber-100"], [class*="bg-orange-50"], [class*="bg-orange-100"]) :is(span, svg, path, p, h1, h2, h3, h4, h5, h6) {
        color: var(--v2-dark-chip-text) !important;
        stroke: currentColor !important;
      }

      html[data-loombus-theme="dark"] .loombus-v2-page-bg :is([class*="text-slate-300"], [class*="text-slate-400"], [class*="text-slate-500"], [class*="text-slate-600"], [class*="text-zinc-400"], [class*="text-zinc-500"], [class*="text-gray-400"], [class*="text-gray-500"]):is([class*="rounded-full"], [class*="rounded-xl"], [class*="rounded-2xl"]) {
        color: var(--v2-dark-chip-muted) !important;
      }

      @media (prefers-color-scheme: dark) {
        html[data-loombus-theme="system"] .loombus-v2-page-bg :is([class*="rounded-full"], [class*="rounded-2xl"], [class*="rounded-xl"]):is([class*="bg-white"], [class*="bg-slate-50"], [class*="bg-slate-100"], [class*="bg-slate-200"], [class*="bg-zinc-50"], [class*="bg-zinc-100"], [class*="bg-gray-50"], [class*="bg-gray-100"], [class*="bg-blue-50"], [class*="bg-blue-100"], [class*="bg-sky-50"], [class*="bg-sky-100"], [class*="bg-indigo-50"], [class*="bg-indigo-100"], [class*="bg-violet-50"], [class*="bg-violet-100"], [class*="bg-purple-50"], [class*="bg-purple-100"], [class*="bg-emerald-50"], [class*="bg-emerald-100"], [class*="bg-green-50"], [class*="bg-green-100"], [class*="bg-amber-50"], [class*="bg-amber-100"], [class*="bg-orange-50"], [class*="bg-orange-100"]),
        html[data-loombus-theme="system"] .loombus-v2-page-bg :is(button, a, span):is([class*="bg-white"], [class*="bg-slate-50"], [class*="bg-slate-100"], [class*="bg-zinc-50"], [class*="bg-zinc-100"], [class*="bg-gray-50"], [class*="bg-gray-100"], [class*="bg-blue-50"], [class*="bg-blue-100"], [class*="bg-sky-50"], [class*="bg-sky-100"], [class*="bg-indigo-50"], [class*="bg-indigo-100"], [class*="bg-violet-50"], [class*="bg-violet-100"], [class*="bg-purple-50"], [class*="bg-purple-100"], [class*="bg-emerald-50"], [class*="bg-emerald-100"], [class*="bg-green-50"], [class*="bg-green-100"], [class*="bg-amber-50"], [class*="bg-amber-100"], [class*="bg-orange-50"], [class*="bg-orange-100"]) {
          background-color: var(--v2-dark-chip-bg) !important;
          border-color: var(--v2-dark-chip-border) !important;
          color: var(--v2-dark-chip-text) !important;
        }

        html[data-loombus-theme="system"] .loombus-v2-page-bg :is(button, a):is([class*="hover:bg-white"], [class*="hover:bg-slate-50"], [class*="hover:bg-zinc-50"], [class*="hover:bg-blue-50"], [class*="hover:bg-amber-50"]):hover {
          background-color: var(--v2-dark-chip-bg-strong) !important;
          border-color: #71717a !important;
          color: #ffffff !important;
        }

        html[data-loombus-theme="system"] .loombus-v2-page-bg :is([class*="rounded-full"], [class*="rounded-2xl"], [class*="rounded-xl"], button, a, span):is([class*="bg-white"], [class*="bg-slate-50"], [class*="bg-slate-100"], [class*="bg-zinc-50"], [class*="bg-zinc-100"], [class*="bg-gray-50"], [class*="bg-gray-100"], [class*="bg-blue-50"], [class*="bg-blue-100"], [class*="bg-sky-50"], [class*="bg-sky-100"], [class*="bg-indigo-50"], [class*="bg-indigo-100"], [class*="bg-violet-50"], [class*="bg-violet-100"], [class*="bg-purple-50"], [class*="bg-purple-100"], [class*="bg-emerald-50"], [class*="bg-emerald-100"], [class*="bg-green-50"], [class*="bg-green-100"], [class*="bg-amber-50"], [class*="bg-amber-100"], [class*="bg-orange-50"], [class*="bg-orange-100"]) :is(span, svg, path, p, h1, h2, h3, h4, h5, h6) {
          color: var(--v2-dark-chip-text) !important;
          stroke: currentColor !important;
        }

        html[data-loombus-theme="system"] .loombus-v2-page-bg :is([class*="text-slate-300"], [class*="text-slate-400"], [class*="text-slate-500"], [class*="text-slate-600"], [class*="text-zinc-400"], [class*="text-zinc-500"], [class*="text-gray-400"], [class*="text-gray-500"]):is([class*="rounded-full"], [class*="rounded-xl"], [class*="rounded-2xl"]) {
          color: var(--v2-dark-chip-muted) !important;
        }
      }
    `}</style>
  );
}
