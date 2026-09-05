"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  initializeNativePushListeners,
  registerNativePushNotifications,
  syncNativeNotificationBadge,
} from "@/lib/native-push";

export function NativePushRegistration() {
  useEffect(() => {
    let mounted = true;

    void initializeNativePushListeners();

    async function registerIfSignedIn() {
      const { data } = await supabase.auth.getSession();

      if (!mounted) {
        return;
      }

      if (!data.session) {
        await syncNativeNotificationBadge();
        return;
      }

      await registerNativePushNotifications();
    }

    function handleResume() {
      if (document.visibilityState !== "visible") return;
      void registerIfSignedIn();
    }

    void registerIfSignedIn();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      void syncNativeNotificationBadge();
      if (session) {
        void registerNativePushNotifications();
      }
    });

    document.addEventListener("visibilitychange", handleResume);
    window.addEventListener("focus", handleResume);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleResume);
      window.removeEventListener("focus", handleResume);
    };
  }, []);

  return null;
}
