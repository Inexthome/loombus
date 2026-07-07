import { RoomPlanMenu } from "./room-plan-menu";
import { RoomPreferencesEnforcer } from "./room-preferences-enforcer";

const ROOM_LANDING_CARD_SELECTOR = [
  "overview",
  "discussions",
  "calendar",
  "announcements",
  "members",
  "requests",
  "resources",
  "services",
  "settings",
  "billing",
]
  .map((id) => `a[href="#${id}"]`)
  .join(", ");

const ROOM_LANDING_SECTION_SELECTOR = [
  "cal" + "endar",
  "announce" + "ments",
  "requests",
  "resources",
  "services",
  "settings",
]
  .map((id) => `section#${id}`)
  .join(", ");

export default async function V2RoomLayout({ children, params }: { children: React.ReactNode; params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;

  return (
    <>
      <style>{`
        main.loombus-v2-page-bg ${ROOM_LANDING_CARD_SELECTOR},
        main.loombus-v2-page-bg ${ROOM_LANDING_SECTION_SELECTOR} {
          display: none !important;
        }
      `}</style>
      {children}
      <RoomPlanMenu roomId={roomId} />
      <RoomPreferencesEnforcer roomId={roomId} />
    </>
  );
}
