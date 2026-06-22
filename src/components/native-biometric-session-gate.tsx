"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { isNativeApp } from "@/lib/native-app";
import {
  BIOMETRIC_SESSION_LOCK_EVENT,
  BIOMETRIC_UNLOCK_SETTING_EVENT,
  deleteNativeBiometricLoginCredentials,
  getNativeBiometricAvailability,
  isBiometricUnlockEnabled,
  setBiometricUnlockEnabled,
  verifyNativeBiometric,
} from "@/lib/native-biometric";

const BIOMETRIC_SESSION_VERIFIED_KEY =
  "loombus:native-biometric-session-verified";
const BIOMETRIC_SESSION_PROMPT_SEEN_KEY =
  "loombus:native-biometric-session-prompt-seen";

const SKIPPED_PATH_PREFIXES = [
  "/auth/callback",
  "/login",
  "/signup",
  "/password-reset",
];

type GateStatus = "ready" | "checking" | "verifying" | "locked";

function shouldSkipCurrentPath() {
  if (typeof window === "undefined") {
    return true;
  }

  return SKIPPED_PATH_PREFIXES.some((prefix) =>
    window.location.pathname.startsWith(prefix)
  );
}

function markSessionVerified() {
  window.sessionStorage.setItem(BIOMETRIC_SESSION_VERIFIED_KEY, "true");
}

function clearSessionVerified() {
  window.sessionStorage.removeItem(BIOMETRIC_SESSION_VERIFIED_KEY);
}

function isSessionVerified() {
  return window.sessionStorage.getItem(BIOMETRIC_SESSION_VERIFIED_KEY) === "true";
}

export function NativeBiometricSessionGate() {
  const [status, setStatus] = useState<GateStatus>("ready");
  const [message, setMessage] = useState("");
  const checkInFlight = useRef(false);

  const runBiometricGate = useCallback(async (forceVerification = false) => {
    if (typeof window === "undefined" || checkInFlight.current) {
      return;
    }

    if (!isNativeApp() || shouldSkipCurrentPath()) {
      setStatus("ready");
      return;
    }

    checkInFlight.current = true;
    setStatus((currentStatus) =>
      currentStatus === "locked" ? currentStatus : "checking"
    );

    try {
      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        clearSessionVerified();
        setStatus("ready");
        setMessage("");
        return;
      }

      const availability = await getNativeBiometricAvailability();

      if (!availability.isAvailable) {
        setStatus("ready");
        setMessage("");
        return;
      }

      let unlockEnabled = isBiometricUnlockEnabled();

      if (!unlockEnabled) {
        const promptSeen =
          window.localStorage.getItem(BIOMETRIC_SESSION_PROMPT_SEEN_KEY) ===
          "true";

        if (!promptSeen) {
          window.localStorage.setItem(BIOMETRIC_SESSION_PROMPT_SEEN_KEY, "true");
          unlockEnabled = window.confirm(
            "Protect remembered Loombus sessions with Face ID on this device?"
          );

          if (unlockEnabled) {
            setBiometricUnlockEnabled(true);
          }
        }
      }

      if (!unlockEnabled) {
        setStatus("ready");
        setMessage("");
        return;
      }

      if (!forceVerification && isSessionVerified()) {
        setStatus("ready");
        setMessage("");
        return;
      }

      setStatus("verifying");
      setMessage("");

      const result = await verifyNativeBiometric("Unlock Loombus to continue.");

      if (result.ok) {
        markSessionVerified();
        setStatus("ready");
        setMessage("");
        return;
      }

      clearSessionVerified();
      setStatus("locked");
      setMessage(result.error ?? "Face ID verification was canceled.");
    } finally {
      checkInFlight.current = false;
    }
  }, []);

  useEffect(() => {
    void runBiometricGate();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        clearSessionVerified();
        setStatus("ready");
        return;
      }

      void runBiometricGate();
    });

    function handleVisibilityChange() {
      if (document.visibilityState !== "visible" || !isBiometricUnlockEnabled()) {
        return;
      }

      clearSessionVerified();
      void runBiometricGate(true);
    }

    function handleSettingChange() {
      clearSessionVerified();
      void runBiometricGate(true);
    }

    function handleSessionLockRequest() {
      clearSessionVerified();
      void runBiometricGate(true);
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener(BIOMETRIC_UNLOCK_SETTING_EVENT, handleSettingChange);
    window.addEventListener(BIOMETRIC_SESSION_LOCK_EVENT, handleSessionLockRequest);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener(
        BIOMETRIC_UNLOCK_SETTING_EVENT,
        handleSettingChange
      );
      window.removeEventListener(
        BIOMETRIC_SESSION_LOCK_EVENT,
        handleSessionLockRequest
      );
    };
  }, [runBiometricGate]);

  async function handleRetry() {
    clearSessionVerified();
    await runBiometricGate(true);
  }

  async function handleSignOut() {
    clearSessionVerified();
    await deleteNativeBiometricLoginCredentials();
    await supabase.auth.signOut();
    window.location.replace("/login");
  }

  if (status === "ready") {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black px-6 text-white">
      <div className="w-full max-w-sm rounded-3xl border border-zinc-800 bg-zinc-950 p-7 text-center shadow-2xl shadow-black/50">
        <p className="mb-3 text-xs uppercase tracking-[0.3em] text-zinc-500">
          Loombus security
        </p>

        <h2 className="mb-3 text-2xl font-semibold tracking-tight">
          {status === "locked" ? "Loombus is locked." : "Securing Loombus..."}
        </h2>

        <p className="mb-6 text-sm leading-relaxed text-zinc-400">
          {status === "locked"
            ? message || "Use Face ID, Touch ID, or your device passcode to continue."
            : "Checking this device before opening your remembered session."}
        </p>

        {status === "locked" ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => void handleRetry()}
              className="w-full rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200"
            >
              Try Face ID again
            </button>

            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="w-full rounded-full border border-zinc-800 px-5 py-3 text-sm font-medium text-zinc-400 transition hover:border-zinc-600 hover:text-white"
            >
              Sign out completely
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
