"use client";

import { useEffect, useState } from "react";
import {
  V2_APPEARANCE_OPTIONS,
  V2_DEFAULT_APPEARANCE,
  type V2AppearanceTheme,
  getStoredV2Appearance,
  isV2AppearanceTheme,
  setV2AppearancePreference,
} from "./v2-appearance";

export function V2AppearanceControl() {
  const [theme, setTheme] = useState<V2AppearanceTheme>(V2_DEFAULT_APPEARANCE);
  const [status, setStatus] = useState("");

  useEffect(() => {
    setTheme(getStoredV2Appearance());

    function handleAppearanceChange(event: Event) {
      const nextTheme = (event as CustomEvent<{ theme?: unknown }>).detail?.theme;
      if (isV2AppearanceTheme(nextTheme)) {
        setTheme(nextTheme);
      }
    }

    window.addEventListener("loombus:v2-appearance-changed", handleAppearanceChange);
    return () => window.removeEventListener("loombus:v2-appearance-changed", handleAppearanceChange);
  }, []);

  return (
    <section className="mb-6 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.12)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Appearance</p>
          <h2 className="mt-2 text-2xl font-black text-slate-950">V2 Appearance</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Choose how the V2 shell looks across pages, including login, signup, and reset password.</p>
        </div>
        {status && <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">{status}</span>}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {V2_APPEARANCE_OPTIONS.map((option) => {
          const active = theme === option.key;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => {
                setTheme(option.key);
                setStatus("Saved");
                setV2AppearancePreference(option.key);
                window.setTimeout(() => setStatus(""), 1800);
              }}
              className={`rounded-3xl border p-4 text-left transition ${
                active
                  ? "border-blue-500 bg-blue-50 ring-4 ring-blue-100"
                  : "border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/50"
              }`}
            >
              <span className="text-base font-black text-slate-950">{option.label}</span>
              <span className="mt-2 block text-sm leading-6 text-slate-600">{option.description}</span>
              <span className="mt-4 flex h-12 overflow-hidden rounded-2xl border border-slate-200">
                <span className={`flex-1 ${option.key === "dark" ? "bg-[#050710]" : "bg-[#f7fbff]"}`} />
                <span className={`flex-1 ${option.key === "dark" ? "bg-[#d4af37]" : "bg-blue-600"}`} />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
