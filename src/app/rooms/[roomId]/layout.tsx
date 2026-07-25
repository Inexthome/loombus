import RoomRouteFrame from "@/components/room-route-frame";

export default function RoomRouteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <RoomRouteFrame>{children}</RoomRouteFrame>;
}
