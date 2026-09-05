"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { getNativePlatform } from "@/lib/native-app";
import {
  DEFAULT_MOBILE_NATIVE_PREFERENCES,
  getMobileNativePreferences,
  setMobileNativePreferences,
  type MobileNativePreferences,
} from "@/lib/mobile-native-preferences";
import {
  endAllAppointmentLiveUpdates,
  performLoombusHaptic,
} from "@/lib/native-live-updates";

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="settings-v2-toggle-row">
      <span className="settings-v2-toggle-copy">
        <strong>{label}</strong>
        <span>{description}</span>
      </span>
      <span className="settings-v2-switch">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span aria-hidden="true" />
      </span>
    </label>
  );
}

export function MobileNativeSettingsBridge() {
  const [mount, setMount] = useState<HTMLElement | null>(null);
  const [platform] = useState(() => getNativePlatform());
  const [preferences, setPreferencesState] = useState<MobileNativePreferences>(
    DEFAULT_MOBILE_NATIVE_PREFERENCES
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (platform !== "ios" && platform !== "android") return;

    setPreferencesState(getMobileNativePreferences());

    let cancelled = false;
    let attempts = 0;

    function findMount() {
      const target = document.getElementById("appearance");
      if (target) {
        setMount(target);
        return;
      }
      attempts += 1;
      if (!cancelled && attempts < 80) window.setTimeout(findMount, 100);
    }

    findMount();
    return () => {
      cancelled = true;
    };
  }, [platform]);

  if ((platform !== "ios" && platform !== "android") || !mount) return null;

  function save(next: MobileNativePreferences) {
    setPreferencesState(setMobileNativePreferences(next));
  }

  async function setHaptics(enabled: boolean) {
    const next = { ...preferences, hapticFeedbackEnabled: enabled };
    save(next);
    setMessage(enabled ? "Haptic feedback enabled." : "Haptic feedback disabled.");
    if (enabled) {
      try {
        await performLoombusHaptic("success");
      } catch {
        // The setting remains enabled; device haptic availability is best-effort.
      }
    }
  }

  async function setLiveAppointmentUpdates(enabled: boolean) {
    const next = { ...preferences, liveAppointmentUpdatesEnabled: enabled };
    save(next);
    if (!enabled) {
      try {
        await endAllAppointmentLiveUpdates();
      } catch {
        // Preference enforcement also runs when the appointments surface reconciles.
      }
    }
    setMessage(
      enabled
        ? "Live appointment updates enabled."
        : "Live appointment updates disabled."
    );
  }

  return createPortal(
    <section className="settings-v2-section" aria-labelledby="mobile-app-behavior-heading">
      <div className="settings-v2-section-heading">
        <div>
          <p className="settings-v2-eyebrow">Mobile app behavior</p>
          <h3 id="mobile-app-behavior-heading">Native experience</h3>
        </div>
      </div>
      <div className="settings-v2-toggle-list">
        <Toggle
          label="Haptic feedback"
          description="Use subtle tactile feedback for taps and actions in the Loombus mobile app."
          checked={preferences.hapticFeedbackEnabled}
          onChange={(enabled) => void setHaptics(enabled)}
        />
        <Toggle
          label="Live appointment updates"
          description={
            platform === "ios"
              ? "Allow eligible appointments to use iOS Live Activities when supported by this device."
              : "Allow eligible appointments to use ongoing and promoted Android system updates when supported by this device."
          }
          checked={preferences.liveAppointmentUpdatesEnabled}
          onChange={(enabled) => void setLiveAppointmentUpdates(enabled)}
        />
      </div>
      {message ? <p className="settings-v2-muted" role="status">{message}</p> : null}
    </section>,
    mount
  );
}
