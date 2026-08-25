"use client";

import { useEffect } from "react";

import { supabase } from "@/lib/supabase/client";

export function WelcomeEmailTrigger() {
  useEffect(() => {
    let cancelled = false;

    async function attemptWelcomeEmail() {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;

      if (cancelled || !session?.access_token || !session.user?.id) {
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
        // Non-blocking: welcome email delivery must never interrupt app use.
      }
    }

    void attemptWelcomeEmail();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        void attemptWelcomeEmail();
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return null;
}
