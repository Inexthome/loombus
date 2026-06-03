"use client";

import { useEffect, useRef, useState } from "react";

const APP_VERSION_STORAGE_KEY = "loombus:last-seen-app-version";
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

type AppVersionResponse = {
  version?: string;
};

export function AppUpdateNotice() {
  const [latestVersion, setLatestVersion] = useState("");
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [dismissedVersion, setDismissedVersion] = useState("");
  const checkingRef = useRef(false);

  async function checkForUpdate() {
    if (checkingRef.current) {
      return;
    }

    checkingRef.current = true;

    try {
      const response = await fetch(`/api/app-version?ts=${Date.now()}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        return;
      }

      const result = (await response.json().catch(() => ({}))) as AppVersionResponse;
      const version = typeof result.version === "string" ? result.version : "";

      if (!version || version === "local") {
        return;
      }

      const storedVersion = window.localStorage.getItem(APP_VERSION_STORAGE_KEY);

      if (!storedVersion) {
        window.localStorage.setItem(APP_VERSION_STORAGE_KEY, version);
        return;
      }

      if (storedVersion !== version && dismissedVersion !== version) {
        setLatestVersion(version);
        setUpdateAvailable(true);
      }
    } finally {
      checkingRef.current = false;
    }
  }

  function refreshNow() {
    if (latestVersion) {
      window.localStorage.setItem(APP_VERSION_STORAGE_KEY, latestVersion);
    }

    const url = new URL(window.location.href);
    url.searchParams.set("loombus_update", latestVersion || `${Date.now()}`);
    window.location.replace(url.toString());
  }

  function dismissUpdate() {
    if (latestVersion) {
      setDismissedVersion(latestVersion);
    }

    setUpdateAvailable(false);
  }

  useEffect(() => {
    checkForUpdate();

    const intervalId = window.setInterval(checkForUpdate, CHECK_INTERVAL_MS);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        checkForUpdate();
      }
    }

    window.addEventListener("focus", checkForUpdate);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", checkForUpdate);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [dismissedVersion]);

  if (!updateAvailable) {
    return null;
  }

  return (
    <div className="fixed inset-x-3 bottom-24 z-[90] mx-auto max-w-md rounded-2xl border border-zinc-800 bg-zinc-950/95 p-4 text-white shadow-2xl shadow-black/40 backdrop-blur-xl sm:bottom-6">
      <p className="mb-1 text-xs uppercase tracking-[0.22em] text-zinc-600">
        Loombus update
      </p>

      <p className="text-sm leading-relaxed text-zinc-300">
        A new version of Loombus is available.
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={refreshNow}
          className="rounded-full bg-white px-4 py-2.5 text-sm text-black transition hover:bg-zinc-200"
        >
          Refresh now
        </button>

        <button
          type="button"
          onClick={dismissUpdate}
          className="rounded-full border border-zinc-800 px-4 py-2.5 text-sm text-zinc-400 transition hover:border-zinc-600 hover:text-white"
        >
          Later
        </button>
      </div>
    </div>
  );
}
