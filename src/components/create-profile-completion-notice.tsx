"use client";

import { useEffect, useState } from "react";
import { LoombusPrompt } from "@/components/loombus-prompt";
import { supabase } from "@/lib/supabase/client";
import { validatePublicProfileCompletion } from "@/lib/profile-completion";

export function CreateProfileCompletionNotice() {
  const [message, setMessage] = useState("");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkProfileCompletion() {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      if (!user || cancelled) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, username, bio")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled || error || !data) return;

      const completion = validatePublicProfileCompletion({
        fullName: data.full_name,
        username: data.username,
        bio: data.bio,
      });

      setMessage(completion.ok ? "" : completion.message);
      setDismissed(false);
    }

    void checkProfileCompletion();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!message || dismissed) return null;

  return (
    <LoombusPrompt
      tone="error"
      title="Complete your profile before publishing."
      message={`${message} Your discussion draft can remain saved while you finish your profile.`}
      actionHref="/profile?section=public"
      actionLabel="Complete profile"
      onClose={() => setDismissed(true)}
    />
  );
}
