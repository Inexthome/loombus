import { RoomExpansionWorkspace } from "@/components/room-expansion-workspace";
import { RoomFoundationWorkspace } from "@/components/room-foundation-workspace";
import { RoomOperationsWorkspace } from "@/components/room-operations-workspace";
import { RoomPlanFeatureEnhancer } from "@/components/room-plan-feature-enhancer";
import { RoomResourcesWorkspace } from "@/components/room-resources-workspace";
import { RoomTierModulesWorkspace } from "@/components/room-tier-modules-workspace";
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
import "./room-workspace-simplified.css";

export default function RoomsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <RoomPlanFeatureEnhancer />
      <RoomFoundationWorkspace />
      <RoomOperationsWorkspace />
      <RoomExpansionWorkspace />
      <RoomTierModulesWorkspace />
      <RoomResourcesWorkspace />
      {children}
    </>
  );
}
