"use client";

import { useEffect, useRef, useState } from "react";
import { isNativeApp } from "@/lib/native-app";
import { performLoombusHaptic } from "@/lib/native-live-updates";

const PULL_THRESHOLD_PX = 88;
const MAX_PULL_VISUAL_PX = 116;
const HAPTIC_SELECTOR =
  'button, a[href], [role="button"], summary, input[type="checkbox"], input[type="radio"]';

function fallbackVibrate(duration = 10) {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(duration);
    }
  } catch {
    // Vibration is best-effort only. iOS relies on the Loombus native bridge.
  }
}

async function haptic(style: "light" | "success" = "light") {
  try {
    await performLoombusHaptic(style);
  } catch {
    fallbackVibrate(style === "success" ? 18 : 10);
  }
}

function isDisabledInteractiveElement(element: Element) {
  return (
    element.matches(":disabled") ||
    element.getAttribute("aria-disabled") === "true"
  );
}

export function NativeMobileInteractionRuntime() {
  const touchStartYRef = useRef<number | null>(null);
  const pullDistanceRef = useRef(0);
  const refreshingRef = useRef(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!isNativeApp()) return;

    function handleClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const interactive = target.closest(HAPTIC_SELECTOR);
      if (!interactive || isDisabledInteractiveElement(interactive)) return;

      void haptic("light");
    }

    function handleTouchStart(event: TouchEvent) {
      if (refreshingRef.current || event.touches.length !== 1) return;
      if (window.scrollY > 1 || document.documentElement.scrollTop > 1) return;

      touchStartYRef.current = event.touches[0]?.clientY ?? null;
      pullDistanceRef.current = 0;
      setPullDistance(0);
    }

    function handleTouchMove(event: TouchEvent) {
      if (touchStartYRef.current == null || event.touches.length !== 1) return;

      const currentY = event.touches[0]?.clientY;
      if (typeof currentY !== "number") return;

      const distance = Math.max(0, currentY - touchStartYRef.current);
      pullDistanceRef.current = distance;
      setPullDistance(Math.min(distance, MAX_PULL_VISUAL_PX));
    }

    function resetPullState() {
      touchStartYRef.current = null;
      pullDistanceRef.current = 0;
      setPullDistance(0);
    }

    function handleTouchEnd() {
      if (touchStartYRef.current == null || refreshingRef.current) {
        resetPullState();
        return;
      }

      const shouldRefresh = pullDistanceRef.current >= PULL_THRESHOLD_PX;
      resetPullState();

      if (!shouldRefresh) return;

      refreshingRef.current = true;
      setRefreshing(true);
      void haptic("success").finally(() => {
        // Keep the same URL and let the app restore its persisted authenticated session.
        window.location.reload();
      });
    }

    function handleTouchCancel() {
      resetPullState();
    }

    document.addEventListener("click", handleClick, true);
    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });
    document.addEventListener("touchcancel", handleTouchCancel, { passive: true });

    return () => {
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("touchcancel", handleTouchCancel);
    };
  }, []);

  if (!isNativeApp() || (pullDistance <= 0 && !refreshing)) return null;

  const armed = pullDistance >= PULL_THRESHOLD_PX;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-[10000] flex justify-center pt-[calc(env(safe-area-inset-top)+0.5rem)]"
    >
      <div className="rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-3 py-1.5 text-xs font-medium text-[color:var(--loombus-text)] shadow-lg">
        {refreshing ? "Refreshing Loombus…" : armed ? "Release to refresh" : "Pull to refresh"}
      </div>
    </div>
  );
}
