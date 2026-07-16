import { RoomPlanFeatureEnhancer } from "@/components/room-plan-feature-enhancer";
import { RoomResourcesWorkspace } from "@/components/room-resources-workspace";
import "./rooms-v2.css";
import "./rooms-v2-route-states.css";
import "./rooms-live.css";
import "./room-tier-features.css";

export default function RoomsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <RoomPlanFeatureEnhancer />
      <RoomResourcesWorkspace />
      {children}
    </>
  );
}
