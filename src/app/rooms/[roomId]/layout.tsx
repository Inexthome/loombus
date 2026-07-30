import { RoomFeatureHost } from "@/components/room-feature-host";
import RoomRouteFrameV3 from "@/components/room-route-frame-v3";
import { RoomTopbarActions } from "@/components/room-topbar-actions";
import { RoomWorkspaceProvider } from "@/components/room-workspace-context";
import "../room-phase4-corrections.css";
import "../room-operations-phase4.css";
import "../room-thread-attachments.css";
import "../room-mobile-safe-area-hotfix.css";

export default function RoomRouteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <RoomWorkspaceProvider>
      <RoomRouteFrameV3>{children}</RoomRouteFrameV3>
      <RoomTopbarActions />
      <RoomFeatureHost />
    </RoomWorkspaceProvider>
  );
}
