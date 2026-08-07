"use client";

import { useEffect } from "react";
import { showLoombusPrompt } from "@/lib/loombus-prompt";

export function PlatformUnhandledErrorPrompt() {
  useEffect(() => {
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "Something went wrong. Please try again.";
      if (!message.trim()) return;
      showLoombusPrompt({ message, tone: "error" });
    };

    window.addEventListener("unhandledrejection", onRejection);
    return () => window.removeEventListener("unhandledrejection", onRejection);
  }, []);

  return null;
}
