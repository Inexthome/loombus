import { RoomExpansionWorkspace } from "@/components/room-expansion-workspace";
import { RoomFeatureBridge } from "@/components/room-feature-bridge";
import { RoomFoundationWorkspace } from "@/components/room-foundation-workspace";
import { RoomOperationsWorkspace } from "@/components/room-operations-workspace";
import { RoomResourcesWorkspace } from "@/components/room-resources-workspace";
import RoomRouteFrameV2 from "@/components/room-route-frame-v2";
import { RoomTierModulesRouteBoundary } from "@/components/room-tier-modules-route-boundary";

export default function RoomRouteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <RoomFeatureBridge />
      <RoomFoundationWorkspace />
      <RoomOperationsWorkspace />
      <RoomExpansionWorkspace />
      <RoomTierModulesRouteBoundary />
      <RoomResourcesWorkspace />
      <RoomRouteFrameV2>{children}</RoomRouteFrameV2>
    </>
  );
}
