"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase/client";

type AudiencePreference = {
  default_audience_type: string | null;
};

function jsonResponse(error: string, status: number) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getAttachmentSection() {
  const videoInput = document.querySelector<HTMLInputElement>(
    'main form input[type="file"][accept="video/*"]'
  );
  return videoInput?.closest<HTMLElement>("section") ?? null;
}

function hasStagedDiscussionAttachments() {
  const section = getAttachmentSection();
  return Boolean(section?.querySelector('button[aria-label^="Remove "]'));
}

function applyAttachmentPolicy(restricted: boolean) {
  const section = getAttachmentSection();
  if (!section) return false;

  section.dataset.audienceRestricted = restricted ? "true" : "false";
  const actionGrid = section.querySelector<HTMLElement>(":scope > div.mt-4.grid");
  const buttons = Array.from(
    actionGrid?.querySelectorAll<HTMLButtonElement>(":scope > button") ?? []
  );

  for (const button of buttons) {
    button.disabled = restricted;
    button.title = restricted
      ? "Your Future Discussion visibility setting is restricted. Attachments require Public."
      : "";
  }

  section
    .querySelector<HTMLElement>("[data-discussion-audience-policy-note]")
    ?.remove();

  if (!restricted) return true;

  const note = document.createElement("div");
  note.dataset.discussionAudiencePolicyNote = "true";
  note.className = "discussion-audience-create-policy-note";
  note.append(
    "Attachments are unavailable because your Future Discussion visibility setting is restricted. "
  );

  const link = document.createElement("a");
  link.href = "/settings#privacy";
  link.textContent = "Change it in Settings";
  note.append(link);
  section.append(note);
  return true;
}

export function CreateDiscussionAudiencePolicyGuard() {
  const restrictedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let locateTimer: number | null = null;

    async function loadPolicy() {
      const { data: userResult } = await supabase.auth.getUser();
      const user = userResult.user;

      if (!user || cancelled) {
        restrictedRef.current = false;
        applyAttachmentPolicy(false);
        return;
      }

      const { data: capability, error: capabilityError } = await supabase.rpc(
        "get_discussion_audience_capability"
      );

      if (cancelled || capability !== true || capabilityError) {
        restrictedRef.current = false;
        applyAttachmentPolicy(false);
        return;
      }

      const { data: preference } = await supabase
        .from("discussion_audience_preferences")
        .select("default_audience_type")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      const audienceType =
        (preference as AudiencePreference | null)?.default_audience_type ?? "public";
      restrictedRef.current = audienceType !== "public";
      applyAttachmentPolicy(restrictedRef.current);
    }

    function locateAndApply() {
      if (cancelled) return;
      if (applyAttachmentPolicy(restrictedRef.current)) return;
      locateTimer = window.setTimeout(locateAndApply, 120);
    }

    void loadPolicy().then(locateAndApply);

    const originalFetch = window.fetch.bind(window);
    const guardedFetch: typeof window.fetch = async (input, init) => {
      const inputUrl =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      let pathname = inputUrl;

      try {
        pathname = new URL(inputUrl, window.location.origin).pathname;
      } catch {
        // Preserve the original value when URL parsing fails.
      }

      const method = String(
        init?.method ?? (input instanceof Request ? input.method : "GET")
      ).toUpperCase();

      if (
        restrictedRef.current &&
        pathname === "/api/discussions/create" &&
        method === "POST" &&
        hasStagedDiscussionAttachments()
      ) {
        return jsonResponse(
          "Remove staged attachments or change Future Discussion visibility to Public in Settings.",
          400
        );
      }

      return originalFetch(input, init);
    };

    window.fetch = guardedFetch;

    function refreshPolicy() {
      if (document.visibilityState !== "hidden") void loadPolicy();
    }

    window.addEventListener("focus", refreshPolicy);
    document.addEventListener("visibilitychange", refreshPolicy);

    return () => {
      cancelled = true;
      if (locateTimer) window.clearTimeout(locateTimer);
      if (window.fetch === guardedFetch) window.fetch = originalFetch;
      window.removeEventListener("focus", refreshPolicy);
      document.removeEventListener("visibilitychange", refreshPolicy);
      applyAttachmentPolicy(false);
    };
  }, []);

  return null;
}
