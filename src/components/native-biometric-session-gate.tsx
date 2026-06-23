"use client";

import { useEffect } from "react";
import { isNativeApp } from "@/lib/native-app";
import { deleteNativeBiometricLoginCredentials } from "@/lib/native-biometric";

const LEGACY_BIOMETRIC_CLEANUP_KEY =
  "loombus:legacy-native-biometric-cleaned-up";

export function NativeBiometricSessionGate() {
  useEffect(() => {
    if (!isNativeApp() || typeof window === "undefined") {
      return;
    }

    if (window.localStorage.getItem(LEGACY_BIOMETRIC_CLEANUP_KEY) === "true") {
      return;
    }

    window.localStorage.setItem(LEGACY_BIOMETRIC_CLEANUP_KEY, "true");
    void deleteNativeBiometricLoginCredentials();
  }, []);

  return null;
}
