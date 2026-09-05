"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { getNativePlatform } from "@/lib/native-app";
import {
  getNativeBiometricAvailability,
  isBiometricUnlockEnabled,
  setBiometricUnlockEnabled,
} from "@/lib/native-biometric";
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
  disabled = false,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={`settings-v2-toggle-row${disabled ? " is-disabled" : ""}`}>
      <span className="settings-v2-toggle-copy">
        <strong>{label}</strong>
        <span>{description}</span>
      </span>
      <span className="settings-v2-switch">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span aria-hidden="true" />
      </span>
    </label>
  );
}

export function MobileNativeSettingsBridge() {
  const [appearanceMount, setAppearanceMount] = useState<HTMLElement | null>(null);
  const [securityMount, setSecurityMount] = useState<HTMLElement | null>(null);
  const [platform] = useState(() => getNativePlatform());
  const [preferences, setPreferencesState] = useState<MobileNativePreferences>(
    DEFAULT_MOBILE_NATIVE_PREFERENCES
  );
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [message, setMessage] = useState("");
  const [securityMessage, setSecurityMessage] = useState("");

  useEffect(() => {
    if (platform !== "ios" && platform !== "android") return;

    setPreferencesState(getMobileNativePreferences());
    setBiometricEnabled(isBiometricUnlockEnabled());
    void getNativeBiometricAvailability().then((availability) => {
      setBiometricAvailable(availability.isAvailable);
    });

    let cancelled = false;
    let attempts = 0;

    function findMounts() {
      const appearance = document.getElementById("appearance");
      const security = document.querySelector<HTMLElement>(
        '[data-settings-workspace-slot="account-security"]'
      );

      if (appearance) setAppearanceMount(appearance);
      if (security) setSecurityMount(security);

      if (appearance && security) return;

      attempts += 1;
      if (!cancelled && attempts < 80) window.setTimeout(findMounts, 100);
    }

    findMounts();
    return () => {
      cancelled = true;
    };
  }, [platform]);

  if (platform !== "ios" && platform !== "android") return null;

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

  async function setBiometricAppLock(enabled: boolean) {
    setSecurityMessage("");

    if (enabled) {
      const availability = await getNativeBiometricAvailability();
      setBiometricAvailable(availability.isAvailable);
      if (!availability.isAvailable) {
        setSecurityMessage(
          "Face ID, fingerprint, or device unlock is not available on this device."
        );
        return;
      }
    }

    setBiometricUnlockEnabled(enabled);
    setBiometricEnabled(enabled);
    setSecurityMessage(
      enabled
        ? "Biometric app lock enabled on this device."
        : "Biometric app lock disabled on this device."
    );
  }

  return (
    <>
      {appearanceMount
        ? createPortal(
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
            appearanceMount
          )
        : null}

      {securityMount
        ? createPortal(
            <section className="settings-v2-section" aria-labelledby="biometric-app-lock-heading">
              <div className="settings-v2-section-heading">
                <div>
                  <p className="settings-v2-eyebrow">Device security</p>
                  <h3 id="biometric-app-lock-heading">Biometric app lock</h3>
                </div>
              </div>
              <div className="settings-v2-toggle-list">
                <Toggle
                  label={platform === "ios" ? "Face ID / device biometrics" : "Device biometrics"}
                  description="Require this device's biometric or device-unlock check to protect your remembered Loombus session. Turning this off does not sign you out."
                  checked={biometricEnabled}
                  disabled={!biometricAvailable && !biometricEnabled}
                  onChange={(enabled) => void setBiometricAppLock(enabled)}
                />
              </div>
              {securityMessage ? (
                <p className="settings-v2-muted" role="status">{securityMessage}</p>
              ) : null}
            </section>,
            securityMount
          )
        : null}
    </>
  );
}
