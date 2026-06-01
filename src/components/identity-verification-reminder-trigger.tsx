"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

const LOCAL_CHECK_THROTTLE_MS = 6 * 60 * 60 * 1000;
const LOCAL_STORAGE_KEY_PREFIX = "loombus-identity-verification-reminder-check";

export function IdentityVerificationReminderTrigger() {
  useEffect(() => {
    let cancelled = false;

    async function checkReminder() {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data.session;

        if (!session || cancelled) {
          return;
        }

        const storageKey = `${LOCAL_STORAGE_KEY_PREFIX}:${session.user.id}`;
        const lastLocalCheck = Number(window.localStorage.getItem(storageKey) ?? "0");

        if (
          Number.isFinite(lastLocalCheck) &&
          Date.now() - lastLocalCheck < LOCAL_CHECK_THROTTLE_MS
        ) {
          return;
        }

        window.localStorage.setItem(storageKey, String(Date.now()));

        const response = await fetch("/api/identity/verification-reminder", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok || cancelled) {
          return;
        }

        const result = (await response.json().catch(() => null)) as {
          created?: boolean;
        } | null;

        if (result?.created) {
          window.dispatchEvent(new Event("loombus:notifications-changed"));
        }
      } catch (error) {
        console.error("Unable to check identity verification reminder.", error);
      }
    }

    void checkReminder();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
