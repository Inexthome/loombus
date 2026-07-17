import { RoomPlanFeatureEnhancer } from "@/components/room-plan-feature-enhancer";
import { RoomResourcesWorkspace } from "@/components/room-resources-workspace";
import { RoomTierModulesWorkspace } from "@/components/room-tier-modules-workspace";
import "./rooms-v2.css";
import "./rooms-v2-route-states.css";
import "./rooms-live.css";
import "./room-tier-features.css";
import "./room-tier-overrides.css";

export default function RoomsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <RoomPlanFeatureEnhancer />
      <RoomTierModulesWorkspace />
      <RoomResourcesWorkspace />
      {children}
    </>
  );
}
