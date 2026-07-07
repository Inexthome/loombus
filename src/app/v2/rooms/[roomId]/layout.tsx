import { RoomPlanMenu } from "./room-plan-menu";
import { RoomPreferencesEnforcer } from "./room-preferences-enforcer";
import { RoomQuickActions } from "./room-quick-actions";

export default async function V2RoomLayout({ children, params }: { children: React.ReactNode; params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;

  return (
    <>
      {children}
      <RoomPlanMenu roomId={roomId} />
      <RoomQuickActions roomId={roomId} />
      <RoomPreferencesEnforcer roomId={roomId} />
    </>
  );
}
