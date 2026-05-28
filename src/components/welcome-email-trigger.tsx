"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

export function WelcomeEmailTrigger() {
  useEffect(() => {
    async function sendWelcomeEmailOnce() {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;

      if (!session?.access_token || !session.user?.id) {
        return;
      }

      const storageKey = `loombus:welcome-email:${session.user.id}`;

      if (window.localStorage.getItem(storageKey) === "done") {
        return;
      }

      try {
        const response = await fetch("/api/email/welcome/send", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          window.localStorage.setItem(storageKey, "done");
        }
      } catch {
        // Non-blocking: welcome email delivery should never interrupt dashboard use.
      }
    }

    sendWelcomeEmailOnce();
  }, []);

  return null;
}
