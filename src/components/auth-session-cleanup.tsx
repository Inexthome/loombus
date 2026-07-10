"use client";

import { useEffect } from "react";
import { deleteNativeBiometricLoginCredentials } from "@/lib/native-biometric";
import { supabase } from "@/lib/supabase/client";

const TRANSIENT_LOCAL_STORAGE_KEYS = [
  "loombus:pending-date-of-birth",
];

function clearTransientSessionState() {
  if (typeof window === "undefined") {
    return;
  }

  for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
    const key = window.sessionStorage.key(index);

    if (key?.startsWith("loombus:")) {
      window.sessionStorage.removeItem(key);
    }
  }

  for (const key of TRANSIENT_LOCAL_STORAGE_KEYS) {
    window.localStorage.removeItem(key);
  }
}

export function AuthSessionCleanup() {
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_OUT") {
        return;
      }

      clearTransientSessionState();
      void deleteNativeBiometricLoginCredentials();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return null;
}
