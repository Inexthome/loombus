"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  initializeNativePushListeners,
  registerNativePushNotifications,
} from "@/lib/native-push";

export function NativePushRegistration() {
  useEffect(() => {
    let mounted = true;

    void initializeNativePushListeners();

    async function registerIfSignedIn() {
      const { data } = await supabase.auth.getSession();

      if (!mounted || !data.session) {
        return;
      }

      await registerNativePushNotifications();
    }

    void registerIfSignedIn();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
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
