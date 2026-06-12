"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { isNativeApp } from "@/lib/native-app";
import {
  BIOMETRIC_UNLOCK_SETTING_EVENT,
  getNativeBiometricAvailability,
  isBiometricUnlockEnabled,
  setBiometricUnlockEnabled,
  verifyNativeBiometric,
} from "@/lib/native-biometric";

type Availability = Awaited<ReturnType<typeof getNativeBiometricAvailability>>;

export function NativeBiometricSettingsCard() {
  const pathname = usePathname();
  const [isNative, setIsNative] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (pathname !== "/settings") {
      return;
    }

    let active = true;

    async function load() {
      const native = isNativeApp();
      const available = await getNativeBiometricAvailability();

      if (!active) {
        return;
      }

      setIsNative(native);
      setAvailability(available);
      setEnabled(isBiometricUnlockEnabled());
    }

    void load();

    function refresh() {
      setEnabled(isBiometricUnlockEnabled());
    }

    window.addEventListener(BIOMETRIC_UNLOCK_SETTING_EVENT, refresh);

    return () => {
      active = false;
      window.removeEventListener(BIOMETRIC_UNLOCK_SETTING_EVENT, refresh);
    };
  }, [pathname]);

  if (pathname !== "/settings" || !isNative) {
    return null;
  }

  async function enableUnlock() {
    setBusy(true);
    setMessage("");

    const result = await verifyNativeBiometric(
      "Enable Loombus device unlock on this device."
    );

    if (!result.ok) {
      setMessage(result.error ?? "Unable to enable device unlock.");
      setBusy(false);
      return;
    }

    setBiometricUnlockEnabled(true);
    setEnabled(true);
    setMessage("Device unlock is enabled for Loombus on this device.");
    setBusy(false);
  }

  function disableUnlock() {
    setBiometricUnlockEnabled(false);
    setEnabled(false);
    setMessage("Device unlock is disabled for Loombus on this device.");
  }

  return (
    <section className="mb-6 rounded-2xl border border-zinc-900 bg-black p-4 text-white sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Native app security
          </p>
          <h2 className="mt-1 text-base font-semibold">
            Face ID / biometric unlock
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-zinc-500">
            Lock Loombus behind Face ID, fingerprint, or your device passcode on
            this device.
          </p>
          {availability ? (
            <p className="mt-2 text-xs text-zinc-600">
              Available: {availability.isAvailable ? "Yes" : "No"} · Device
              secure: {availability.deviceIsSecure ? "Yes" : "No"}
            </p>
          ) : null}
          {message ? (
            <p className="mt-2 text-xs text-zinc-400">
              {message}
            </p>
          ) : null}
        </div>

        {enabled ? (
          <button
            type="button"
            onClick={disableUnlock}
            className="shrink-0 rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
          >
            Disable
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void enableUnlock()}
            disabled={busy || availability?.isAvailable === false}
            className="shrink-0 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Checking..." : "Enable"}
          </button>
        )}
      </div>
    </section>
  );
}
