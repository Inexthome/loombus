import RoomRouteFrame from "@/components/room-route-frame";

export default function RoomRouteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (process.env.VERCEL_ENV === "preview") {
    return <>{children}</>;
  }

  return <RoomRouteFrame>{children}</RoomRouteFrame>;
}
