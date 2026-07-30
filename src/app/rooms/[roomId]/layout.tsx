import { RoomFeatureHost } from "@/components/room-feature-host";
import RoomRouteFrameV3 from "@/components/room-route-frame-v3";
import { RoomWorkspaceProvider } from "@/components/room-workspace-context";

export default function RoomRouteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <RoomWorkspaceProvider>
      <RoomRouteFrameV3>{children}</RoomRouteFrameV3>
      <RoomFeatureHost />
    </RoomWorkspaceProvider>
  );
}
