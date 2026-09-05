"use client";

import { useEffect, useState } from "react";
import { PhoneSecuritySettingsBridge } from "@/components/phone-security-settings-bridge";

export function PhoneSecuritySettingsMount() {
  const [privacySectionReady, setPrivacySectionReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    let timer: number | null = null;

    function locatePrivacySection() {
      if (document.getElementById("privacy")) {
        if (!cancelled) setPrivacySectionReady(true);
        return;
      }

      attempts += 1;
      if (attempts < 60) {
        timer = window.setTimeout(locatePrivacySection, 120);
      }
    }

    locatePrivacySection();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  return privacySectionReady ? <PhoneSecuritySettingsBridge /> : null;
}
