"use client";

export function V2AppearanceStyles() {
  return (
    <style jsx global>{`
      html[data-v2-appearance="light_blue"],
      body[data-v2-appearance="light_blue"] {
        color-scheme: light;
      }

      html[data-v2-appearance="dark_gold"],
      body[data-v2-appearance="dark_gold"] {
        color-scheme: dark;
        background: #050710;
      }

      body[data-v2-appearance="dark_gold"] main {
        background: radial-gradient(circle at top left, rgba(212, 175, 55, 0.2), transparent 30rem), radial-gradient(circle at bottom right, rgba(23, 37, 84, 0.34), transparent 34rem), #050710 !important;
        color: #f8eed7 !important;
      }

      body[data-v2-appearance="dark_gold"] header {
        background: linear-gradient(90deg, #050710, #0a1020 55%, #11131f) !important;
        border-color: rgba(212, 175, 55, 0.24) !important;
      }

      body[data-v2-appearance="dark_gold"] .bg-white,
      body[data-v2-appearance="dark_gold"] .bg-white\/95 {
        background-color: rgba(11, 15, 27, 0.94) !important;
      }

      body[data-v2-appearance="dark_gold"] .bg-slate-50,
      body[data-v2-appearance="dark_gold"] .bg-slate-100,
      body[data-v2-appearance="dark_gold"] .bg-blue-50,
      body[data-v2-appearance="dark_gold"] .bg-emerald-50,
      body[data-v2-appearance="dark_gold"] .bg-amber-50,
      body[data-v2-appearance="dark_gold"] .bg-orange-50 {
        background-color: rgba(18, 24, 38, 0.92) !important;
      }

      body[data-v2-appearance="dark_gold"] .bg-blue-100,
      body[data-v2-appearance="dark_gold"] .bg-blue-600,
      body[data-v2-appearance="dark_gold"] .bg-emerald-700 {
        background: linear-gradient(135deg, #d4af37, #a66d1f) !important;
        color: #080b14 !important;
      }

      body[data-v2-appearance="dark_gold"] .text-slate-950,
      body[data-v2-appearance="dark_gold"] .text-slate-900,
      body[data-v2-appearance="dark_gold"] .text-slate-800,
      body[data-v2-appearance="dark_gold"] .text-slate-700 {
        color: #f8eed7 !important;
      }

      body[data-v2-appearance="dark_gold"] .text-slate-600,
      body[data-v2-appearance="dark_gold"] .text-slate-500,
      body[data-v2-appearance="dark_gold"] .text-slate-400,
      body[data-v2-appearance="dark_gold"] .text-blue-100 {
        color: #b8ab8f !important;
      }

      body[data-v2-appearance="dark_gold"] .text-blue-900,
      body[data-v2-appearance="dark_gold"] .text-blue-800,
      body[data-v2-appearance="dark_gold"] .text-blue-700,
      body[data-v2-appearance="dark_gold"] .text-blue-600,
      body[data-v2-appearance="dark_gold"] .text-emerald-700,
      body[data-v2-appearance="dark_gold"] .text-orange-800,
      body[data-v2-appearance="dark_gold"] .text-amber-900,
      body[data-v2-appearance="dark_gold"] .text-amber-800,
      body[data-v2-appearance="dark_gold"] .text-amber-700 {
        color: #d4af37 !important;
      }

      body[data-v2-appearance="dark_gold"] .border-slate-100,
      body[data-v2-appearance="dark_gold"] .border-slate-200,
      body[data-v2-appearance="dark_gold"] .border-slate-300,
      body[data-v2-appearance="dark_gold"] .border-blue-200,
      body[data-v2-appearance="dark_gold"] .border-amber-200,
      body[data-v2-appearance="dark_gold"] .border-orange-200 {
        border-color: rgba(212, 175, 55, 0.22) !important;
      }

      body[data-v2-appearance="dark_gold"] input,
      body[data-v2-appearance="dark_gold"] textarea,
      body[data-v2-appearance="dark_gold"] select {
        background-color: rgba(8, 12, 22, 0.95) !important;
        border-color: rgba(212, 175, 55, 0.26) !important;
        color: #f8eed7 !important;
      }

      body[data-v2-appearance="dark_gold"] input::placeholder,
      body[data-v2-appearance="dark_gold"] textarea::placeholder {
        color: #8e846f !important;
      }

      body[data-v2-appearance="dark_gold"] .ring-blue-100,
      body[data-v2-appearance="dark_gold"] .ring-blue-300\/20,
      body[data-v2-appearance="dark_gold"] .ring-white\/20,
      body[data-v2-appearance="dark_gold"] .ring-white\/80 {
        --tw-ring-color: rgba(212, 175, 55, 0.28) !important;
      }

      body[data-v2-appearance="dark_gold"] .shadow-sm,
      body[data-v2-appearance="dark_gold"] .shadow-lg,
      body[data-v2-appearance="dark_gold"] .shadow-2xl,
      body[data-v2-appearance="dark_gold"] [class*="shadow-["] {
        box-shadow: 0 22px 70px rgba(0, 0, 0, 0.46) !important;
      }

      body[data-v2-appearance="dark_gold"] a:hover,
      body[data-v2-appearance="dark_gold"] button:hover {
        border-color: rgba(212, 175, 55, 0.46) !important;
      }
    `}</style>
  );
}
