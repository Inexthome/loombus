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
    <section className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-50 mx-auto max-w-md rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 text-[var(--loombus-text)] shadow-2xl shadow-black/20 backdrop-blur-xl md:left-auto md:right-6 md:mx-0">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--loombus-text-subtle)]">
            Native app security
          </p>
          <h2 className="mt-1 text-base font-semibold">
            Face ID / biometric unlock
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-[var(--loombus-text-muted)]">
            Lock Loombus behind Face ID, fingerprint, or your device passcode on
            this device.
          </p>
          {availability ? (
            <p className="mt-2 text-xs text-[var(--loombus-text-subtle)]">
              Available: {availability.isAvailable ? "Yes" : "No"} · Device
              secure: {availability.deviceIsSecure ? "Yes" : "No"}
            </p>
          ) : null}
          {message ? (
            <p className="mt-2 text-xs text-[var(--loombus-text-muted)]">
              {message}
            </p>
          ) : null}
        </div>

        {enabled ? (
          <button
            type="button"
            onClick={disableUnlock}
            className="shrink-0 rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm font-medium text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)]"
          >
            Disable
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void enableUnlock()}
            disabled={busy || availability?.isAvailable === false}
            className="shrink-0 rounded-full bg-[var(--loombus-primary-bg)] px-4 py-2 text-sm font-semibold text-[var(--loombus-primary-text)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Checking..." : "Enable"}
          </button>
        )}
      </div>
    </section>
  );
}
