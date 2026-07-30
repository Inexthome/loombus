"use client";

import { X } from "lucide-react";
import { createPortal } from "react-dom";
import {
  Component,
  type ErrorInfo,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { RoomExpansionFeature } from "@/components/room-expansion-feature";
import { RoomFoundationFeature } from "@/components/room-foundation-feature";
import { RoomOperationsFeature } from "@/components/room-operations-feature";
import { RoomResourcesFeature } from "@/components/room-resources-feature";
import { RoomTierParityFeature } from "@/components/room-tier-parity-feature";
import { useRoomWorkspace } from "@/components/room-workspace-context";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

type FeatureBoundaryProps = {
  resetKey: string;
  children: ReactNode;
  onClose: () => void;
};

type FeatureBoundaryState = {
  failed: boolean;
};

class RoomFeatureErrorBoundary extends Component<
  FeatureBoundaryProps,
  FeatureBoundaryState
> {
  state: FeatureBoundaryState = { failed: false };

  static getDerivedStateFromError(): FeatureBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Room feature workspace failed:", error, info.componentStack);
  }

  componentDidUpdate(previousProps: FeatureBoundaryProps) {
    if (
      previousProps.resetKey !== this.props.resetKey &&
      this.state.failed
    ) {
      this.setState({ failed: false });
    }
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="room-phase4-feature-error" role="alert">
        <div>
          <h3>This Room workspace could not finish loading</h3>
          <p>
            The rest of the Room remains available. Close this workspace and try
            again instead of losing the entire Room route.
          </p>
          <button type="button" onClick={this.props.onClose}>
            Close workspace
          </button>
        </div>
      </div>
    );
  }
}

export function RoomFeatureHost() {
  const { activeFeature, closeFeature } = useRoomWorkspace();
  const [mounted, setMounted] = useState(false);
  const surfaceRef = useRef<HTMLElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!activeFeature) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("room-phase3-feature-open");
    window.requestAnimationFrame(() => headingRef.current?.focus());

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeFeature();
        return;
      }
      if (event.key !== "Tab" || !surfaceRef.current) return;
      const focusable = Array.from(
        surfaceRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter(
        (element) =>
          !element.hasAttribute("disabled") &&
          element.getAttribute("aria-hidden") !== "true" &&
          element.getClientRects().length > 0
      );
      if (focusable.length === 0) {
        event.preventDefault();
        headingRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement;
      if (
        event.shiftKey &&
        (current === first || !surfaceRef.current.contains(current))
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.classList.remove("room-phase3-feature-open");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeFeature, closeFeature]);

  if (!mounted || !activeFeature) return null;

  let content: ReactNode;
  if (activeFeature.kind === "foundation") {
    content = <RoomFoundationFeature panel={activeFeature.panel} />;
  } else if (activeFeature.kind === "operations") {
    content = (
      <RoomOperationsFeature
        initialView={activeFeature.initialView}
        hideNavigation={activeFeature.hideNavigation}
      />
    );
  } else if (activeFeature.kind === "studio") {
    content = (
      <RoomExpansionFeature
        initialView={activeFeature.initialView ?? "tasks"}
        hideNavigation={activeFeature.hideNavigation}
      />
    );
  } else if (activeFeature.kind === "organization") {
    content = (
      <RoomExpansionFeature
        initialView={activeFeature.initialView ?? "organization"}
        hideNavigation={activeFeature.hideNavigation}
      />
    );
  } else if (activeFeature.kind === "module") {
    content =
      activeFeature.moduleKey === "files" ? (
        <RoomResourcesFeature />
      ) : (
        <RoomTierParityFeature
          moduleKey={activeFeature.moduleKey}
          label={activeFeature.label}
        />
      );
  } else {
    content = null;
  }

  return createPortal(
    <div className="room-phase3-feature-host">
      <button
        type="button"
        className="room-phase3-feature-backdrop"
        aria-label={`Close ${activeFeature.label}`}
        onClick={() => closeFeature()}
      />
      <section
        ref={surfaceRef}
        className="room-phase3-feature-surface"
        role="dialog"
        aria-modal="true"
        aria-labelledby="room-phase3-feature-title"
      >
        <header className="room-phase3-feature-header">
          <div>
            <p>Private Room workspace</p>
            <h2 id="room-phase3-feature-title" ref={headingRef} tabIndex={-1}>
              {activeFeature.label}
            </h2>
          </div>
          <button
            type="button"
            className="room-phase3-feature-close"
            aria-label={`Close ${activeFeature.label}`}
            onClick={() => closeFeature()}
          >
            <X aria-hidden="true" />
          </button>
        </header>
        <div className="room-phase3-feature-body">
          <RoomFeatureErrorBoundary
            resetKey={activeFeature.id}
            onClose={() => closeFeature()}
          >
            {content}
          </RoomFeatureErrorBoundary>
        </div>
      </section>
    </div>,
    document.body
  );
}
