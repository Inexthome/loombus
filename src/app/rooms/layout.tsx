import { RoomPlanFeatureEnhancer } from "@/components/room-plan-feature-enhancer";
import RoomsShell from "@/components/rooms-shell";
import "./rooms-v2.css";
import "./rooms-v2-route-states.css";
import "./rooms-live.css";
import "./room-expansion.css";
import "./room-expansion-brand.css";
import "./room-foundation.css";
import "./room-operations.css";
import "./room-tier-features.css";
import "./room-tier-overrides.css";
import "./room-expansion-hardening.css";
import "./room-core-list-hardening.css";
import "./room-foundation-operations-hardening.css";
import "./room-shell-v3.css";
import "./room-content-overflow-hardening.css";
import "./room-subscription-refresh.css";
import "./room-shell-tokens.css";
import "./room-shell-phase1.css";
import "./room-shell-phase1-route-fixes.css";
import "./room-feature-rail.css";
import "./room-feature-host.css";
import "./room-mobile-safe-area.css";
import "./rooms-editorial-system.css";

export default function RoomsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <RoomPlanFeatureEnhancer />
      <RoomsShell>{children}</RoomsShell>
    </>
  );
}
