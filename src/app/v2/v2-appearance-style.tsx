export function V2AppearanceStyle() {
  return (
    <style>{`
      html[data-loombus-theme="dark"] .loombus-v2-page-bg {
        background:
          radial-gradient(circle at 50% -16%, rgba(255, 255, 255, 0.055), transparent 34rem),
          #050505 !important;
        color: #f4f4f5 !important;
      }

      html[data-loombus-theme="dark"] .loombus-v2-page-bg :is(h1, h2, h3, h4, h5, h6),
      html[data-loombus-theme="dark"] .loombus-v2-page-bg :is([class~="text-slate-950"], [class~="text-slate-900"], [class~="text-zinc-950"], [class~="text-zinc-900"], [class~="text-blue-950"], [class~="text-blue-900"], [class~="text-blue-800"], [class~="text-blue-700"]) {
        color: #f4f4f5 !important;
      }

      html[data-loombus-theme="dark"] .loombus-v2-page-bg :is(p, li, span, small, dt, dd),
      html[data-loombus-theme="dark"] .loombus-v2-page-bg :is([class~="text-slate-700"], [class~="text-slate-600"], [class~="text-slate-500"], [class~="text-blue-600"], [class~="text-blue-500"], [class~="text-blue-400"]) {
        color: #cbd5e1 !important;
      }

      html[data-loombus-theme="dark"] .loombus-v2-page-bg [class*="text-blue-"],
      html[data-loombus-theme="dark"] .loombus-v2-page-bg [class*="text-slate-"],
      html[data-loombus-theme="dark"] .loombus-v2-page-bg [class*="text-zinc-"] {
        color: #dbe4f0 !important;
      }

      html[data-loombus-theme="dark"] .loombus-v2-page-bg :is(article, main, section, div)[class*="leading-"] {
        color: #dbe4f0 !important;
      }

      html[data-loombus-theme="dark"] .loombus-v2-page-bg :is([class~="bg-white"], [class~="bg-white/95"], [class~="bg-slate-50"], [class~="bg-zinc-50"], [class~="bg-slate-100"], [class~="bg-blue-50"], [class~="bg-blue-50/40"]) {
        background-color: #0f0f10 !important;
        color: #f4f4f5 !important;
      }

      html[data-loombus-theme="dark"] .loombus-v2-page-bg [class*="bg-white"],
      html[data-loombus-theme="dark"] .loombus-v2-page-bg [class*="bg-slate-50"],
      html[data-loombus-theme="dark"] .loombus-v2-page-bg [class*="bg-zinc-50"] {
        background-color: #18181b !important;
        border-color: #52525b !important;
        color: #f4f4f5 !important;
      }

      html[data-loombus-theme="dark"] .loombus-v2-page-bg :is([class~="border-slate-200"], [class~="border-slate-300"], [class~="border-zinc-200"], [class~="border-blue-200"]) {
        border-color: #3f3f46 !important;
      }

      html[data-loombus-theme="dark"] .loombus-v2-page-bg :is(a, button):is([class~="bg-white"], [class~="bg-slate-50"], [class~="bg-zinc-50"], [class~="bg-blue-600"], [class~="bg-blue-700"], [class~="bg-black"], [class~="bg-slate-950"], [class~="bg-zinc-950"], [class~="bg-zinc-900"]) {
        background-color: #18181b !important;
        border: 1px solid #52525b !important;
        color: #f4f4f5 !important;
      }

      html[data-loombus-theme="dark"] .loombus-v2-page-bg :is(a, button)[class*="bg-white"],
      html[data-loombus-theme="dark"] .loombus-v2-page-bg :is(a, button)[class*="bg-slate-50"],
      html[data-loombus-theme="dark"] .loombus-v2-page-bg :is(a, button)[class*="bg-zinc-50"] {
        background-color: #18181b !important;
        border: 1px solid #52525b !important;
        color: #f4f4f5 !important;
      }

      html[data-loombus-theme="dark"] .loombus-v2-page-bg :is(a, button)[class*="bg-white"] *,
      html[data-loombus-theme="dark"] .loombus-v2-page-bg :is(a, button)[class*="bg-slate-50"] *,
      html[data-loombus-theme="dark"] .loombus-v2-page-bg :is(a, button)[class*="bg-zinc-50"] * {
        color: #f4f4f5 !important;
        stroke: currentColor !important;
      }

      html[data-loombus-theme="dark"] .loombus-v2-page-bg :is([class~="bg-orange-50"], [class~="bg-amber-50"], [class~="bg-emerald-50"], [class~="bg-green-50"], [class~="bg-cyan-50"], [class~="bg-blue-50"], [class~="bg-indigo-50"], [class~="bg-purple-50"]) {
        background-color: #18181b !important;
        border-color: #52525b !important;
        color: #f4f4f5 !important;
      }

      html[data-loombus-theme="dark"] .loombus-v2-page-bg :is([class~="text-orange-700"], [class~="text-orange-600"], [class~="text-amber-700"], [class~="text-amber-600"], [class~="text-emerald-700"], [class~="text-emerald-600"], [class~="text-green-700"], [class~="text-green-600"], [class~="text-cyan-700"], [class~="text-cyan-600"], [class~="text-indigo-700"], [class~="text-indigo-600"], [class~="text-purple-700"], [class~="text-purple-600"]) {
        color: #f4f4f5 !important;
      }

      html[data-loombus-theme="dark"] .loombus-v2-page-bg :is([class~="border-orange-200"], [class~="border-amber-200"], [class~="border-emerald-200"], [class~="border-green-200"], [class~="border-cyan-200"], [class~="border-indigo-200"], [class~="border-purple-200"]) {
        border-color: #71717a !important;
      }

      html[data-loombus-theme="dark"] .loombus-v2-top-nav,
      html[data-loombus-theme="dark"] .loombus-v2-bottom-nav {
        background: rgba(5, 5, 5, 0.96) !important;
        border-color: #27272a !important;
      }

      html[data-loombus-theme="dark"] .loombus-v2-top-nav :is(a, button, span, svg),
      html[data-loombus-theme="dark"] .loombus-v2-bottom-nav :is(a, button, span, svg) {
        color: #f4f4f5 !important;
        stroke: currentColor !important;
      }

      html[data-loombus-theme="dark"] .loombus-v2-top-nav :is(.v2-notification-badge, span[class~="right-0"][class~="top-0"][class~="size-5"]) {
        background: #f4f4f5 !important;
        border-color: #a1a1aa !important;
        color: #09090b !important;
      }

      html[data-loombus-theme="dark"] .v2-avatar-menu-inline > div {
        background-color: rgba(15, 15, 16, 0.98) !important;
        border-color: #3f3f46 !important;
        color: #f4f4f5 !important;
      }

      html[data-loombus-theme="dark"] .v2-avatar-menu-inline > div :is(p, span, svg, a) {
        color: #f4f4f5 !important;
        stroke: currentColor !important;
      }

      html[data-loombus-theme="dark"] .v2-avatar-menu-inline a:hover {
        background-color: #27272a !important;
        color: #ffffff !important;
      }

      html[data-loombus-theme="dark"] .v2-avatar-menu-inline a:hover :is(span, svg) {
        color: #ffffff !important;
        stroke: currentColor !important;
      }

      @media (prefers-color-scheme: dark) {
        html[data-loombus-theme="system"] .loombus-v2-page-bg {
          background:
            radial-gradient(circle at 50% -16%, rgba(255, 255, 255, 0.055), transparent 34rem),
            #050505 !important;
          color: #f4f4f5 !important;
        }

        html[data-loombus-theme="system"] .loombus-v2-page-bg :is(h1, h2, h3, h4, h5, h6),
        html[data-loombus-theme="system"] .loombus-v2-page-bg :is([class~="text-slate-950"], [class~="text-slate-900"], [class~="text-zinc-950"], [class~="text-zinc-900"], [class~="text-blue-950"], [class~="text-blue-900"], [class~="text-blue-800"], [class~="text-blue-700"]) {
          color: #f4f4f5 !important;
        }

        html[data-loombus-theme="system"] .loombus-v2-page-bg :is(p, li, span, small, dt, dd),
        html[data-loombus-theme="system"] .loombus-v2-page-bg :is([class~="text-slate-700"], [class~="text-slate-600"], [class~="text-slate-500"], [class~="text-blue-600"], [class~="text-blue-500"], [class~="text-blue-400"]) {
          color: #cbd5e1 !important;
        }

        html[data-loombus-theme="system"] .loombus-v2-page-bg [class*="text-blue-"],
        html[data-loombus-theme="system"] .loombus-v2-page-bg [class*="text-slate-"],
        html[data-loombus-theme="system"] .loombus-v2-page-bg [class*="text-zinc-"] {
          color: #dbe4f0 !important;
        }

        html[data-loombus-theme="system"] .loombus-v2-page-bg :is(article, main, section, div)[class*="leading-"] {
          color: #dbe4f0 !important;
        }

        html[data-loombus-theme="system"] .loombus-v2-page-bg :is([class~="bg-white"], [class~="bg-white/95"], [class~="bg-slate-50"], [class~="bg-zinc-50"], [class~="bg-slate-100"], [class~="bg-blue-50"], [class~="bg-blue-50/40"]) {
          background-color: #0f0f10 !important;
          color: #f4f4f5 !important;
        }

        html[data-loombus-theme="system"] .loombus-v2-page-bg [class*="bg-white"],
        html[data-loombus-theme="system"] .loombus-v2-page-bg [class*="bg-slate-50"],
        html[data-loombus-theme="system"] .loombus-v2-page-bg [class*="bg-zinc-50"] {
          background-color: #18181b !important;
          border-color: #52525b !important;
          color: #f4f4f5 !important;
        }

        html[data-loombus-theme="system"] .loombus-v2-page-bg :is([class~="border-slate-200"], [class~="border-slate-300"], [class~="border-zinc-200"], [class~="border-blue-200"]) {
          border-color: #3f3f46 !important;
        }

        html[data-loombus-theme="system"] .loombus-v2-page-bg :is(a, button):is([class~="bg-white"], [class~="bg-slate-50"], [class~="bg-zinc-50"], [class~="bg-blue-600"], [class~="bg-blue-700"], [class~="bg-black"], [class~="bg-slate-950"], [class~="bg-zinc-950"], [class~="bg-zinc-900"]) {
          background-color: #18181b !important;
          border: 1px solid #52525b !important;
          color: #f4f4f5 !important;
        }

        html[data-loombus-theme="system"] .loombus-v2-page-bg :is(a, button)[class*="bg-white"],
        html[data-loombus-theme="system"] .loombus-v2-page-bg :is(a, button)[class*="bg-slate-50"],
        html[data-loombus-theme="system"] .loombus-v2-page-bg :is(a, button)[class*="bg-zinc-50"] {
          background-color: #18181b !important;
          border: 1px solid #52525b !important;
          color: #f4f4f5 !important;
        }

        html[data-loombus-theme="system"] .loombus-v2-page-bg :is(a, button)[class*="bg-white"] *,
        html[data-loombus-theme="system"] .loombus-v2-page-bg :is(a, button)[class*="bg-slate-50"] *,
        html[data-loombus-theme="system"] .loombus-v2-page-bg :is(a, button)[class*="bg-zinc-50"] * {
          color: #f4f4f5 !important;
          stroke: currentColor !important;
        }

        html[data-loombus-theme="system"] .loombus-v2-page-bg :is([class~="bg-orange-50"], [class~="bg-amber-50"], [class~="bg-emerald-50"], [class~="bg-green-50"], [class~="bg-cyan-50"], [class~="bg-blue-50"], [class~="bg-indigo-50"], [class~="bg-purple-50"]) {
          background-color: #18181b !important;
          border-color: #52525b !important;
          color: #f4f4f5 !important;
        }

        html[data-loombus-theme="system"] .loombus-v2-page-bg :is([class~="text-orange-700"], [class~="text-orange-600"], [class~="text-amber-700"], [class~="text-amber-600"], [class~="text-emerald-700"], [class~="text-emerald-600"], [class~="text-green-700"], [class~="text-green-600"], [class~="text-cyan-700"], [class~="text-cyan-600"], [class~="text-indigo-700"], [class~="text-indigo-600"], [class~="text-purple-700"], [class~="text-purple-600"]) {
          color: #f4f4f5 !important;
        }

        html[data-loombus-theme="system"] .loombus-v2-page-bg :is([class~="border-orange-200"], [class~="border-amber-200"], [class~="border-emerald-200"], [class~="border-green-200"], [class~="border-cyan-200"], [class~="border-indigo-200"], [class~="border-purple-200"]) {
          border-color: #71717a !important;
        }

        html[data-loombus-theme="system"] .loombus-v2-top-nav,
        html[data-loombus-theme="system"] .loombus-v2-bottom-nav {
          background: rgba(5, 5, 5, 0.96) !important;
          border-color: #27272a !important;
        }

        html[data-loombus-theme="system"] .loombus-v2-top-nav :is(a, button, span, svg),
        html[data-loombus-theme="system"] .loombus-v2-bottom-nav :is(a, button, span, svg) {
          color: #f4f4f5 !important;
          stroke: currentColor !important;
        }

        html[data-loombus-theme="system"] .loombus-v2-top-nav :is(.v2-notification-badge, span[class~="right-0"][class~="top-0"][class~="size-5"]) {
          background: #f4f4f5 !important;
          border-color: #a1a1aa !important;
          color: #09090b !important;
        }

        html[data-loombus-theme="system"] .v2-avatar-menu-inline > div {
          background-color: rgba(15, 15, 16, 0.98) !important;
          border-color: #3f3f46 !important;
          color: #f4f4f5 !important;
        }

        html[data-loombus-theme="system"] .v2-avatar-menu-inline > div :is(p, span, svg, a) {
          color: #f4f4f5 !important;
          stroke: currentColor !important;
        }

        html[data-loombus-theme="system"] .v2-avatar-menu-inline a:hover {
          background-color: #27272a !important;
          color: #ffffff !important;
        }

        html[data-loombus-theme="system"] .v2-avatar-menu-inline a:hover :is(span, svg) {
          color: #ffffff !important;
          stroke: currentColor !important;
        }
      }
    `}</style>
  );
}
