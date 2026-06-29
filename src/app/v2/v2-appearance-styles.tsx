"use client";

export function V2AppearanceStyles() {
  return (
    <style jsx global>{`
      /* ─── Article grid fix ─────────────────────────────────────────── */
      main article:has(> a[href^="/v2/discussions/"][class~="bg-gradient-to-br"]) {
        grid-template-columns: minmax(0, 1fr) !important;
      }
      main article:has(> a[href^="/v2/discussions/"][class~="bg-gradient-to-br"]) > a[href^="/v2/discussions/"][class~="bg-gradient-to-br"] {
        display: none !important;
      }

      /* ─── LIGHT ────────────────────────────────────────────────────── */
      html[data-v2-appearance="light"],
      body[data-v2-appearance="light"] {
        color-scheme: light;
        background: #faf6ef;
      }

      body[data-v2-appearance="light"] main {
        background: radial-gradient(circle at top left, rgba(212, 175, 55, 0.10), transparent 28rem),
                    radial-gradient(circle at bottom right, rgba(180, 140, 30, 0.07), transparent 30rem),
                    #faf6ef !important;
        color: #1a1208 !important;
      }

      body[data-v2-appearance="light"] header {
        background: linear-gradient(90deg, #faf6ef, #f5efe0 55%, #faf6ef) !important;
        border-color: rgba(212, 175, 55, 0.28) !important;
      }

      /* Surfaces */
      body[data-v2-appearance="light"] [class~="bg-[#f7fbff]"],
      body[data-v2-appearance="light"] .bg-white,
      body[data-v2-appearance="light"] [class~="bg-white/40"],
      body[data-v2-appearance="light"] [class~="bg-white/60"],
      body[data-v2-appearance="light"] [class~="bg-white/80"],
      body[data-v2-appearance="light"] [class~="bg-white/95"],
      body[data-v2-appearance="light"] [class~="bg-white/[0.04]"] {
        background-color: #fffdf7 !important;
      }

      body[data-v2-appearance="light"] .bg-slate-50,
      body[data-v2-appearance="light"] .bg-slate-100,
      body[data-v2-appearance="light"] .bg-slate-200,
      body[data-v2-appearance="light"] .bg-blue-50,
      body[data-v2-appearance="light"] .bg-emerald-50,
      body[data-v2-appearance="light"] .bg-amber-50,
      body[data-v2-appearance="light"] .bg-orange-50,
      body[data-v2-appearance="light"] .bg-red-50,
      body[data-v2-appearance="light"] .bg-violet-50,
      body[data-v2-appearance="light"] .bg-cyan-50 {
        background-color: #f5ede0 !important;
      }

      /* Gold accent buttons/badges */
      body[data-v2-appearance="light"] .bg-blue-100,
      body[data-v2-appearance="light"] .bg-blue-500,
      body[data-v2-appearance="light"] .bg-blue-600,
      body[data-v2-appearance="light"] .bg-emerald-500,
      body[data-v2-appearance="light"] .bg-emerald-600,
      body[data-v2-appearance="light"] .bg-emerald-700,
      body[data-v2-appearance="light"] .bg-indigo-700,
      body[data-v2-appearance="light"] .bg-violet-700,
      body[data-v2-appearance="light"] .bg-cyan-700,
      body[data-v2-appearance="light"] .bg-green-700 {
        background: linear-gradient(135deg, #c9a227, #a67c1a) !important;
        color: #fffdf7 !important;
      }

      /* Text */
      body[data-v2-appearance="light"] .text-slate-950,
      body[data-v2-appearance="light"] .text-slate-900,
      body[data-v2-appearance="light"] .text-slate-800,
      body[data-v2-appearance="light"] .text-slate-700,
      body[data-v2-appearance="light"] .text-black {
        color: #1a1208 !important;
      }

      body[data-v2-appearance="light"] .text-slate-600,
      body[data-v2-appearance="light"] .text-slate-500,
      body[data-v2-appearance="light"] .text-slate-400,
      body[data-v2-appearance="light"] .text-blue-100,
      body[data-v2-appearance="light"] .text-zinc-400 {
        color: #6b5a3a !important;
      }

      /* Gold accent text (replaces blue) */
      body[data-v2-appearance="light"] .text-blue-900,
      body[data-v2-appearance="light"] .text-blue-800,
      body[data-v2-appearance="light"] .text-blue-700,
      body[data-v2-appearance="light"] .text-blue-600,
      body[data-v2-appearance="light"] .text-emerald-700,
      body[data-v2-appearance="light"] .text-emerald-600,
      body[data-v2-appearance="light"] .text-orange-800,
      body[data-v2-appearance="light"] .text-amber-900,
      body[data-v2-appearance="light"] .text-amber-800,
      body[data-v2-appearance="light"] .text-amber-700,
      body[data-v2-appearance="light"] .text-violet-700,
      body[data-v2-appearance="light"] .text-cyan-700,
      body[data-v2-appearance="light"] .text-green-700 {
        color: #a67c1a !important;
      }

      /* Borders */
      body[data-v2-appearance="light"] .border-slate-100,
      body[data-v2-appearance="light"] .border-slate-200,
      body[data-v2-appearance="light"] .border-slate-300,
      body[data-v2-appearance="light"] .border-blue-200,
      body[data-v2-appearance="light"] .border-blue-300,
      body[data-v2-appearance="light"] .border-amber-200,
      body[data-v2-appearance="light"] .border-orange-200 {
        border-color: rgba(180, 140, 30, 0.24) !important;
      }

      /* Inputs */
      body[data-v2-appearance="light"] input,
      body[data-v2-appearance="light"] textarea,
      body[data-v2-appearance="light"] select {
        background-color: #fffdf7 !important;
        border-color: rgba(180, 140, 30, 0.30) !important;
        color: #1a1208 !important;
      }

      body[data-v2-appearance="light"] input::placeholder,
      body[data-v2-appearance="light"] textarea::placeholder {
        color: #9e8560 !important;
      }

      /* Rings */
      body[data-v2-appearance="light"] .ring-blue-100,
      body[data-v2-appearance="light"] .ring-blue-200,
      body[data-v2-appearance="light"] .ring-blue-300\/20,
      body[data-v2-appearance="light"] .ring-white\/20,
      body[data-v2-appearance="light"] .ring-white\/80,
      body[data-v2-appearance="light"] .ring-slate-900\/5 {
        --tw-ring-color: rgba(180, 140, 30, 0.28) !important;
      }

      /* Dividers */
      body[data-v2-appearance="light"] .divide-slate-100 > :not([hidden]) ~ :not([hidden]),
      body[data-v2-appearance="light"] .divide-slate-200 > :not([hidden]) ~ :not([hidden]) {
        border-color: rgba(180, 140, 30, 0.16) !important;
      }

      /* Shadows */
      body[data-v2-appearance="light"] .shadow-sm,
      body[data-v2-appearance="light"] .shadow-md,
      body[data-v2-appearance="light"] .shadow-lg,
      body[data-v2-appearance="light"] .shadow-2xl,
      body[data-v2-appearance="light"] [class*="shadow-"] {
        box-shadow: 0 18px 50px rgba(100, 70, 10, 0.12) !important;
      }

      /* Hover */
      body[data-v2-appearance="light"] a:hover,
      body[data-v2-appearance="light"] button:hover {
        border-color: rgba(180, 140, 30, 0.44) !important;
      }

      /* ─── DARK ─────────────────────────────────────────────────────── */
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
