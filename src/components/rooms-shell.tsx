"use client";

import Link from "next/link";
import { ArrowLeft, Monitor, Moon, Sun } from "lucide-react";
import { useParams, usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

type AppearanceMode = "light" | "system" | "dark";

const APPEARANCE_STORAGE_KEY = "loombus:appearance";

function readAppearance(): AppearanceMode {
  try {
    const stored = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
    return stored === "light" || stored === "dark" || stored === "system"
      ? stored
      : "system";
  } catch {
    return "system";
  }
}

export function RoomsAppearanceControl({ compact = false }: { compact?: boolean }) {
  const [appearance, setAppearance] = useState<AppearanceMode>("system");

  useEffect(() => {
    setAppearance(readAppearance());
  }, []);

  function applyAppearance(mode: AppearanceMode) {
    setAppearance(mode);
    try {
      window.localStorage.setItem(APPEARANCE_STORAGE_KEY, mode);
    } catch {
      // The selected appearance still applies for the current session.
    }
    document.documentElement.dataset.loombusTheme = mode;
    window.dispatchEvent(
      new CustomEvent("loombus:appearance-changed", { detail: { mode } })
    );
  }

  const options = [
    { value: "light" as const, label: "Light", Icon: Sun },
    { value: "system" as const, label: "System", Icon: Monitor },
    { value: "dark" as const, label: "Dark", Icon: Moon },
  ];

  return (
    <div
      className={`rooms-phase1-appearance${compact ? " is-compact" : ""}`}
      role="group"
      aria-label="Rooms appearance"
    >
      {options.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => applyAppearance(value)}
          aria-pressed={appearance === value}
          title={`${label} appearance`}
        >
          <Icon aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

export default function RoomsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId ?? "";
  const checkoutReturn = pathname.endsWith("/billing/success");
  const activeRoom = Boolean(roomId) && !checkoutReturn;

  if (activeRoom) {
    return (
      <div className="loombus-rooms-scope" data-rooms-shell="room">
        {children}
      </div>
    );
  }

  return (
    <div
      className="loombus-rooms-scope"
      data-rooms-shell={checkoutReturn ? "transition" : "hub"}
    >
      <header className="rooms-phase1-hub-header">
        <Link href="/home" className="rooms-phase1-brand" aria-label="Loombus home">
          <span className="rooms-phase1-brand-mark" aria-hidden="true">
            <img src="/assets/brand/loombus-mark-transparent.png" alt="" />
          </span>
          <span>
            <strong>Loombus</strong>
            <small>Rooms</small>
          </span>
        </Link>

        <div className="rooms-phase1-hub-actions">
          <RoomsAppearanceControl compact />
          <Link href={checkoutReturn ? "/rooms" : "/home"} className="rooms-phase1-back-link">
            <ArrowLeft aria-hidden="true" />
            {checkoutReturn ? "Back to Rooms" : "Back to Loombus"}
          </Link>
        </div>
      </header>

      <div className="rooms-phase1-hub-stage">{children}</div>
    </div>
  );
}
