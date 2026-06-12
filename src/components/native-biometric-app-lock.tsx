"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  BIOMETRIC_UNLOCK_SETTING_EVENT,
  isBiometricUnlockEnabled,
  setBiometricUnlockEnabled,
  verifyNativeBiometric,
} from "@/lib/native-biometric";
import { isNativeApp } from "@/lib/native-app";

type LockState = "checking" | "unlocked" | "locked" | "failed";

export function NativeBiometricAppLock() {
  const [lockState, setLockState] = useState<LockState>("checking");
  const [errorMessage, setErrorMessage] = useState("");

  const unlock = useCallback(async () => {
    setErrorMessage("");
    setLockState("locked");

    const result = await verifyNativeBiometric("Unlock Loombus on this device.");

    if (result.ok) {
      setLockState("unlocked");
      return;
    }

    setErrorMessage(result.error ?? "Unable to unlock Loombus.");
    setLockState("failed");
  }, []);

  const checkLockRequirement = useCallback(async () => {
    if (!isNativeApp() || !isBiometricUnlockEnabled()) {
      setLockState("unlocked");
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setLockState("unlocked");
      return;
    }

    await unlock();
  }, [unlock]);

  useEffect(() => {
    void checkLockRequirement();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && isNativeApp() && isBiometricUnlockEnabled()) {
        void unlock();
      } else {
        setLockState("unlocked");
      }
    });

    window.addEventListener(BIOMETRIC_UNLOCK_SETTING_EVENT, checkLockRequirement);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener(
        BIOMETRIC_UNLOCK_SETTING_EVENT,
        checkLockRequirement
      );
    };
  }, [checkLockRequirement, unlock]);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function disableOnThisDevice() {
    setBiometricUnlockEnabled(false);
    setLockState("unlocked");
  }

  if (lockState === "checking" || lockState === "unlocked") {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[var(--loombus-bg)] px-5 text-[var(--loombus-text)]">
      <div className="w-full max-w-md rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 shadow-2xl shadow-black/20">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--loombus-text-subtle)]">
          Device unlock
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Unlock Loombus
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--loombus-text-muted)]">
          Use Face ID, Touch ID, fingerprint, or your device passcode to open
          Loombus on this device.
        </p>

        {errorMessage ? (
          <p className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
            {errorMessage}
          </p>
        ) : null}

        <div className="mt-6 grid gap-3">
          <button
            type="button"
            onClick={() => void unlock()}
            className="rounded-full bg-[var(--loombus-primary-bg)] px-5 py-3 text-sm font-semibold text-[var(--loombus-primary-text)] transition hover:opacity-90"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={disableOnThisDevice}
            className="rounded-full border border-[var(--loombus-border)] px-5 py-3 text-sm font-medium text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)]"
          >
            Disable on this device
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-full border border-red-500/30 px-5 py-3 text-sm font-medium text-red-500 transition hover:bg-red-500/10"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
