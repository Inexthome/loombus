"use client";

export function V2AppearanceStyles() {
  return (
    <style jsx global>{`
      html[data-v2-appearance="light"],
      body[data-v2-appearance="light"] {
        color-scheme: light;
      }

      main article:has(> a[href^="/v2/discussions/"][class~="bg-gradient-to-br"]) {
        grid-template-columns: minmax(0, 1fr) !important;
      }

      main article:has(> a[href^="/v2/discussions/"][class~="bg-gradient-to-br"]) > a[href^="/v2/discussions/"][class~="bg-gradient-to-br"] {
        display: none !important;
      }

      html[data-v2-appearance="dark"],
      body[data-v2-appearance="dark"] {
        color-scheme: dark;
        background: #050710;
      }

      body[data-v2-appearance="dark"] main {
        background: radial-gradient(circle at top left, rgba(212, 175, 55, 0.2), transparent 30rem), radial-gradient(circle at bottom right, rgba(23, 37, 84, 0.34), transparent 34rem), #050710 !important;
        color: #f8eed7 !important;
      }

      body[data-v2-appearance="dark"] header {
        background: linear-gradient(90deg, #050710, #0a1020 55%, #11131f) !important;
        border-color: rgba(212, 175, 55, 0.24) !important;
      }

      body[data-v2-appearance="dark"] [class~="bg-[#f7fbff]"],
      body[data-v2-appearance="dark"] [class~="bg-white/40"],
      body[data-v2-appearance="dark"] [class~="bg-white/60"],
      body[data-v2-appearance="dark"] [class~="bg-white/80"],
      body[data-v2-appearance="dark"] [class~="bg-white/95"],
      body[data-v2-appearance="dark"] [class~="bg-white/[0.04]"],
      body[data-v2-appearance="dark"] .bg-white,
      body[data-v2-appearance="dark"] .bg-slate-950 {
        background-color: rgba(11, 15, 27, 0.94) !important;
      }

      body[data-v2-appearance="dark"] .bg-slate-50,
      body[data-v2-appearance="dark"] .bg-slate-100,
      body[data-v2-appearance="dark"] .bg-slate-200,
      body[data-v2-appearance="dark"] .bg-blue-50,
      body[data-v2-appearance="dark"] .bg-emerald-50,
      body[data-v2-appearance="dark"] .bg-amber-50,
      body[data-v2-appearance="dark"] .bg-orange-50,
      body[data-v2-appearance="dark"] .bg-red-50,
      body[data-v2-appearance="dark"] .bg-violet-50,
      body[data-v2-appearance="dark"] .bg-cyan-50 {
        background-color: rgba(18, 24, 38, 0.92) !important;
      }

      body[data-v2-appearance="dark"] .bg-blue-100,
      body[data-v2-appearance="dark"] .bg-blue-500,
      body[data-v2-appearance="dark"] .bg-blue-600,
      body[data-v2-appearance="dark"] .bg-emerald-500,
      body[data-v2-appearance="dark"] .bg-emerald-600,
      body[data-v2-appearance="dark"] .bg-emerald-700,
      body[data-v2-appearance="dark"] .bg-indigo-700,
      body[data-v2-appearance="dark"] .bg-violet-700,
      body[data-v2-appearance="dark"] .bg-cyan-700,
      body[data-v2-appearance="dark"] .bg-green-700 {
        background: linear-gradient(135deg, #d4af37, #a66d1f) !important;
        color: #080b14 !important;
      }

      body[data-v2-appearance="dark"] .text-slate-950,
      body[data-v2-appearance="dark"] .text-slate-900,
      body[data-v2-appearance="dark"] .text-slate-800,
      body[data-v2-appearance="dark"] .text-slate-700,
      body[data-v2-appearance="dark"] .text-black {
        color: #f8eed7 !important;
      }

      body[data-v2-appearance="dark"] .text-slate-600,
      body[data-v2-appearance="dark"] .text-slate-500,
      body[data-v2-appearance="dark"] .text-slate-400,
      body[data-v2-appearance="dark"] .text-blue-100,
      body[data-v2-appearance="dark"] .text-zinc-400 {
        color: #b8ab8f !important;
      }

      body[data-v2-appearance="dark"] .text-blue-900,
      body[data-v2-appearance="dark"] .text-blue-800,
      body[data-v2-appearance="dark"] .text-blue-700,
      body[data-v2-appearance="dark"] .text-blue-600,
      body[data-v2-appearance="dark"] .text-emerald-700,
      body[data-v2-appearance="dark"] .text-emerald-600,
      body[data-v2-appearance="dark"] .text-orange-800,
      body[data-v2-appearance="dark"] .text-amber-900,
      body[data-v2-appearance="dark"] .text-amber-800,
      body[data-v2-appearance="dark"] .text-amber-700,
      body[data-v2-appearance="dark"] .text-violet-700,
      body[data-v2-appearance="dark"] .text-cyan-700,
      body[data-v2-appearance="dark"] .text-green-700 {
        color: #d4af37 !important;
      }

      body[data-v2-appearance="dark"] .border-slate-100,
      body[data-v2-appearance="dark"] .border-slate-200,
      body[data-v2-appearance="dark"] .border-slate-300,
      body[data-v2-appearance="dark"] .border-blue-200,
      body[data-v2-appearance="dark"] .border-blue-300,
      body[data-v2-appearance="dark"] .border-amber-200,
      body[data-v2-appearance="dark"] .border-orange-200,
      body[data-v2-appearance="dark"] .border-white\/10,
      body[data-v2-appearance="dark"] .border-white\/25,
      body[data-v2-appearance="dark"] .border-white\/40 {
        border-color: rgba(212, 175, 55, 0.22) !important;
      }

      body[data-v2-appearance="dark"] input,
      body[data-v2-appearance="dark"] textarea,
      body[data-v2-appearance="dark"] select {
        background-color: rgba(8, 12, 22, 0.95) !important;
        border-color: rgba(212, 175, 55, 0.26) !important;
        color: #f8eed7 !important;
      }

      body[data-v2-appearance="dark"] input::placeholder,
      body[data-v2-appearance="dark"] textarea::placeholder {
        color: #8e846f !important;
      }

      body[data-v2-appearance="dark"] .ring-blue-100,
      body[data-v2-appearance="dark"] .ring-blue-200,
      body[data-v2-appearance="dark"] .ring-blue-300\/20,
      body[data-v2-appearance="dark"] .ring-white\/20,
      body[data-v2-appearance="dark"] .ring-white\/80,
      body[data-v2-appearance="dark"] .ring-slate-900\/5 {
        --tw-ring-color: rgba(212, 175, 55, 0.28) !important;
      }

      body[data-v2-appearance="dark"] .divide-slate-100 > :not([hidden]) ~ :not([hidden]),
      body[data-v2-appearance="dark"] .divide-slate-200 > :not([hidden]) ~ :not([hidden]) {
        border-color: rgba(212, 175, 55, 0.18) !important;
      }

      body[data-v2-appearance="dark"] .shadow-sm,
      body[data-v2-appearance="dark"] .shadow-md,
      body[data-v2-appearance="dark"] .shadow-lg,
      body[data-v2-appearance="dark"] .shadow-2xl,
      body[data-v2-appearance="dark"] [class*="shadow-"] {
        box-shadow: 0 22px 70px rgba(0, 0, 0, 0.46) !important;
      }

      body[data-v2-appearance="dark"] a:hover,
      body[data-v2-appearance="dark"] button:hover {
        border-color: rgba(212, 175, 55, 0.46) !important;
      }
    `}</style>
  );
}
