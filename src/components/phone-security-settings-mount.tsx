"use client";

import { useEffect, useState } from "react";
import { PhoneSecuritySettingsBridge } from "@/components/phone-security-settings-bridge";

export function PhoneSecuritySettingsMount() {
  const [settingsTargetsReady, setSettingsTargetsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    let timer: number | null = null;

    function locateSettingsTargets() {
      const profileSlot = document.querySelector<HTMLElement>(
        '[data-settings-workspace-slot="profile"]'
      );
      const privacySection = document.getElementById("privacy");

      if (profileSlot && privacySection) {
        if (!cancelled) setSettingsTargetsReady(true);
        return;
      }

      attempts += 1;
      if (attempts < 80) {
        timer = window.setTimeout(locateSettingsTargets, 100);
      }
    }

    locateSettingsTargets();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  return settingsTargetsReady ? <PhoneSecuritySettingsBridge /> : null;
}
