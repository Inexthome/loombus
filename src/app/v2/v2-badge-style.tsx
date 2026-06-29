export function V2BadgeStyle() {
  return (
    <style>{`
      html[data-loombus-theme="dark"] .loombus-v2-page-bg :is([class*="rounded-full"], [class*="rounded-2xl"], [class*="rounded-xl"]):is([class*="bg-white"], [class*="bg-slate-100"], [class*="bg-slate-200"], [class*="bg-zinc-100"], [class*="bg-gray-100"], [class*="bg-blue-100"], [class*="bg-sky-100"], [class*="bg-indigo-100"], [class*="bg-emerald-100"], [class*="bg-green-100"], [class*="bg-amber-100"], [class*="bg-orange-100"]),
      html[data-loombus-theme="dark"] .loombus-v2-page-bg :is(button, a):is([class*="bg-white"], [class*="bg-slate-50"], [class*="bg-zinc-50"], [class*="bg-gray-50"], [class*="bg-blue-50"], [class*="bg-sky-50"]) {
        background-color: #18181b !important;
        border-color: #52525b !important;
        color: #f4f4f5 !important;
      }

      html[data-loombus-theme="dark"] .loombus-v2-page-bg :is([class*="rounded-full"], [class*="rounded-2xl"], [class*="rounded-xl"], button, a):is([class*="bg-white"], [class*="bg-slate-50"], [class*="bg-slate-100"], [class*="bg-zinc-50"], [class*="bg-zinc-100"], [class*="bg-gray-50"], [class*="bg-gray-100"], [class*="bg-blue-50"], [class*="bg-blue-100"], [class*="bg-sky-50"], [class*="bg-sky-100"]) :is(span, svg, path) {
        color: #f4f4f5 !important;
        stroke: currentColor !important;
      }

      @media (prefers-color-scheme: dark) {
        html[data-loombus-theme="system"] .loombus-v2-page-bg :is([class*="rounded-full"], [class*="rounded-2xl"], [class*="rounded-xl"]):is([class*="bg-white"], [class*="bg-slate-100"], [class*="bg-slate-200"], [class*="bg-zinc-100"], [class*="bg-gray-100"], [class*="bg-blue-100"], [class*="bg-sky-100"], [class*="bg-indigo-100"], [class*="bg-emerald-100"], [class*="bg-green-100"], [class*="bg-amber-100"], [class*="bg-orange-100"]),
        html[data-loombus-theme="system"] .loombus-v2-page-bg :is(button, a):is([class*="bg-white"], [class*="bg-slate-50"], [class*="bg-zinc-50"], [class*="bg-gray-50"], [class*="bg-blue-50"], [class*="bg-sky-50"]) {
          background-color: #18181b !important;
          border-color: #52525b !important;
          color: #f4f4f5 !important;
        }

        html[data-loombus-theme="system"] .loombus-v2-page-bg :is([class*="rounded-full"], [class*="rounded-2xl"], [class*="rounded-xl"], button, a):is([class*="bg-white"], [class*="bg-slate-50"], [class*="bg-slate-100"], [class*="bg-zinc-50"], [class*="bg-zinc-100"], [class*="bg-gray-50"], [class*="bg-gray-100"], [class*="bg-blue-50"], [class*="bg-blue-100"], [class*="bg-sky-50"], [class*="bg-sky-100"]) :is(span, svg, path) {
          color: #f4f4f5 !important;
          stroke: currentColor !important;
        }
      }
    `}</style>
  );
}
