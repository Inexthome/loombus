import { RoomPlanMenu } from "./room-plan-menu";
import { RoomPreferencesEnforcer } from "./room-preferences-enforcer";

export default async function V2RoomLayout({ children, params }: { children: React.ReactNode; params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;

  return (
    <>
      {children}
      <RoomPlanMenu roomId={roomId} />
      <RoomPreferencesEnforcer roomId={roomId} />
    </>
  );
}
