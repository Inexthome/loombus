"use client";

import Link from "next/link";
import { AlertCircle, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { validatePublicProfileCompletion } from "@/lib/profile-completion";

export function CreateProfileCompletionNotice() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function checkProfileCompletion() {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      if (!user || cancelled) {
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, username, bio")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled || error || !data) {
        return;
      }

      const completion = validatePublicProfileCompletion({
        fullName: data.full_name,
        username: data.username,
        bio: data.bio,
      });

      setMessage(completion.ok ? "" : completion.message);
    }

    void checkProfileCompletion();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!message) {
    return null;
  }

  return (
    <aside
      role="status"
      aria-live="polite"
      className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+1rem)] z-[115] w-[min(92vw,42rem)] -translate-x-1/2 rounded-2xl border border-[color-mix(in_srgb,var(--loombus-gold)_52%,var(--loombus-border))] bg-[color-mix(in_srgb,var(--loombus-surface)_96%,transparent)] px-4 py-3 text-[var(--loombus-text)] shadow-2xl shadow-black/20 backdrop-blur-xl"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-[var(--loombus-gold-surface)] text-[var(--loombus-gold)]">
          <AlertCircle aria-hidden="true" className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <strong className="block text-sm font-black">
            Complete your profile before publishing.
          </strong>
          <p className="mt-1 text-sm leading-6 text-[var(--loombus-text-muted)]">
            {message} Your discussion draft can remain saved while you finish your profile.
          </p>
          <Link
            href="/profile?section=public"
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-black text-[var(--loombus-gold)] no-underline"
          >
            Complete profile
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </div>
    </aside>
  );
}
