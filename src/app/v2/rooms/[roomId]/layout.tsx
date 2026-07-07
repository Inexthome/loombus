import { RoomHomeOverview } from "./room-home-overview";
import { RoomPlanMenu } from "./room-plan-menu";
import { RoomPreferencesEnforcer } from "./room-preferences-enforcer";

export default async function V2RoomLayout({ children, params }: { children: React.ReactNode; params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;

  return (
    <>
      {children}
      <RoomHomeOverview roomId={roomId} />
      <RoomPlanMenu roomId={roomId} />
      <RoomPreferencesEnforcer roomId={roomId} />
    </>
  );
}
