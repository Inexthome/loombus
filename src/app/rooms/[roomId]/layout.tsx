import { RoomFeatureHost } from "@/components/room-feature-host";
import { RoomReservationsNavigationBridge } from "@/components/room-reservations-navigation-bridge";
import RoomRouteFrameV4 from "@/components/room-route-frame-v4";
import { RoomTopbarActions } from "@/components/room-topbar-actions";
import { RoomWorkspaceProvider } from "@/components/room-workspace-context";
import "../room-phase4-corrections.css";
import "../room-operations-phase4.css";
import "../room-thread-attachments.css";
import "../room-mobile-safe-area-hotfix.css";
import "../room-secondary-rail.css";
import "../room-refresh-policy.css";

export default function RoomRouteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <RoomWorkspaceProvider>
      <RoomRouteFrameV4>{children}</RoomRouteFrameV4>
      <RoomReservationsNavigationBridge />
      <RoomTopbarActions />
      <RoomFeatureHost />
    </RoomWorkspaceProvider>
  );
}
