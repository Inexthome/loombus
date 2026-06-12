"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { registerNativePushNotifications } from "@/lib/native-push";

export function NativePushRegistration() {
  useEffect(() => {
    let mounted = true;

    async function registerIfSignedIn() {
      const { data } = await supabase.auth.getSession();

      console.info("Loombus native push diagnostics: component session check", {
        mounted,
        signedIn: Boolean(data.session),
      });

      if (!mounted || !data.session) {
        return;
      }

      await registerNativePushNotifications();
    }

    void registerIfSignedIn();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.info("Loombus native push diagnostics: auth state changed", {
        event,
        signedIn: Boolean(session),
      });

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
