"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import type { RoomFeatureLaunch } from "@/components/room-feature-events";

type CloseFeatureOptions = {
  restoreFocus?: boolean;
};

type RoomWorkspaceContextValue = {
  activeFeature: RoomFeatureLaunch | null;
  openFeature: (feature: RoomFeatureLaunch, trigger?: HTMLElement | null) => void;
  closeFeature: (options?: CloseFeatureOptions) => void;
};

const RoomWorkspaceContext = createContext<RoomWorkspaceContextValue | null>(null);

export function RoomWorkspaceProvider({ children }: { children: ReactNode }) {
  const [activeFeature, setActiveFeature] = useState<RoomFeatureLaunch | null>(null);
  const activeFeatureRef = useRef<RoomFeatureLaunch | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const openFeature = useCallback(
    (feature: RoomFeatureLaunch, trigger?: HTMLElement | null) => {
      if (trigger || !activeFeatureRef.current) {
        triggerRef.current =
          trigger ??
          (document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null);
      }
      activeFeatureRef.current = feature;
      setActiveFeature(feature);
    },
    []
  );

  const closeFeature = useCallback((options: CloseFeatureOptions = {}) => {
    const restoreFocus = options.restoreFocus !== false;
    activeFeatureRef.current = null;
    setActiveFeature(null);
    if (restoreFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }, []);

  const value = useMemo(
    () => ({ activeFeature, openFeature, closeFeature }),
    [activeFeature, closeFeature, openFeature]
  );

  return (
    <RoomWorkspaceContext.Provider value={value}>
      {children}
    </RoomWorkspaceContext.Provider>
  );
}

export function useRoomWorkspace() {
  const context = useContext(RoomWorkspaceContext);
  if (!context) {
    throw new Error("useRoomWorkspace must be used inside RoomWorkspaceProvider.");
  }
  return context;
}
