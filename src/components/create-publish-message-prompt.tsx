"use client";

import { useEffect, useState } from "react";
import { LoombusPrompt } from "@/components/loombus-prompt";

const CREATE_ENDPOINT = "/api/discussions/create";

function getRequestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") return new URL(input, window.location.origin);
  if (input instanceof URL) return new URL(input.href);
  return new URL(input.url, window.location.origin);
}

function getRequestMethod(input: RequestInfo | URL, init?: RequestInit) {
  if (init?.method) return init.method.toUpperCase();
  if (input instanceof Request) return input.method.toUpperCase();
  return "GET";
}

export function CreatePublishMessagePrompt() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    let active = true;

    const guardedFetch: typeof window.fetch = async (input, init) => {
      const requestUrl = getRequestUrl(input);
      const isCreateRequest =
        requestUrl.origin === window.location.origin &&
        requestUrl.pathname === CREATE_ENDPOINT &&
        getRequestMethod(input, init) === "POST";

      const response = await originalFetch(input, init);

      if (isCreateRequest) {
        if (response.ok) {
          if (active) setMessage("");
        } else {
          try {
            const payload = (await response.clone().json()) as {
              error?: string;
              message?: string;
            };
            const nextMessage = payload.error ?? payload.message ?? "Unable to publish this discussion.";
            if (active) setMessage(nextMessage);
          } catch {
            if (active) setMessage("Unable to publish this discussion.");
          }
        }
      }

      return response;
    };

    window.fetch = guardedFetch;

    return () => {
      active = false;
      if (window.fetch === guardedFetch) {
        window.fetch = originalFetch;
      }
    };
  }, []);

  return (
    <LoombusPrompt
      message={message}
      title="Unable to publish"
      tone="error"
      onClose={() => setMessage("")}
      actionHref="/profile?section=public"
      actionLabel={/profile|name|username|bio|impersonat/i.test(message) ? "Complete profile" : undefined}
    />
  );
}
