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

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return null;
}
