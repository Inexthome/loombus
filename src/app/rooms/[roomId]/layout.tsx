import { RoomExpansionWorkspace } from "@/components/room-expansion-workspace";
import { RoomFoundationWorkspace } from "@/components/room-foundation-workspace";
import { RoomOperationsWorkspace } from "@/components/room-operations-workspace";
import { RoomResourcesWorkspace } from "@/components/room-resources-workspace";
import RoomRouteFrame from "@/components/room-route-frame";
import { RoomTierModulesWorkspace } from "@/components/room-tier-modules-workspace";

export default function RoomRouteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <RoomFoundationWorkspace />
      <RoomOperationsWorkspace />
      <RoomExpansionWorkspace />
      <RoomTierModulesWorkspace />
      <RoomResourcesWorkspace />
      <RoomRouteFrame>{children}</RoomRouteFrame>
    </>
  );
}
