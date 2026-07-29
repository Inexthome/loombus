import { RoomResourcesWorkspace } from "@/components/room-resources-workspace";
import { RoomTierModulesWorkspace } from "@/components/room-tier-modules-workspace";
import "../../rooms/rooms-live.css";
import "../../rooms/room-tier-features.css";
import "../../rooms/room-expansion.css";
import "../../rooms/room-expansion-brand.css";
import "../../rooms/room-expansion-hardening.css";
import "../../rooms/room-core-list-hardening.css";
import "../../rooms/room-content-overflow-hardening.css";
import "./room-option1.css";

export default function RoomOptionOneLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <RoomTierModulesWorkspace />
      <RoomResourcesWorkspace />
      {children}
    </>
  );
}
