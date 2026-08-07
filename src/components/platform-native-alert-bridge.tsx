"use client";

import { useEffect } from "react";
import { showLoombusPrompt } from "@/lib/loombus-prompt";

export function PlatformNativeAlertBridge() {
  useEffect(() => {
    const nativeAlert = window.alert.bind(window);

    window.alert = (message?: unknown) => {
      const text = typeof message === "string" ? message.trim() : String(message ?? "").trim();
      if (!text) return;
      showLoombusPrompt({ message: text, tone: "info", autoDismissMs: 6500 });
    };

    return () => {
      window.alert = nativeAlert;
    };
  }, []);

  return null;
}
