import { RoomDocumentsNavigationBridge } from "@/components/room-documents-navigation-bridge";
import { RoomFeatureHost } from "@/components/room-feature-host";
import { RoomMaintenanceNavigationBridge } from "@/components/room-maintenance-navigation-bridge";
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
import "../room-documents-polish.css";

export default function RoomRouteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <RoomWorkspaceProvider>
      <RoomRouteFrameV4>{children}</RoomRouteFrameV4>
      <RoomDocumentsNavigationBridge />
      <RoomMaintenanceNavigationBridge />
      <RoomReservationsNavigationBridge />
      <RoomTopbarActions />
      <RoomFeatureHost />
    </RoomWorkspaceProvider>
  );
}
