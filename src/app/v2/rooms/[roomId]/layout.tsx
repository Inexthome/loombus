import { RoomPlanMenu } from "./room-plan-menu";
import { RoomPreferencesEnforcer } from "./room-preferences-enforcer";

const ROOM_LANDING_CARD_SELECTOR = [
  'a[href="#overview"]',
  'a[href="#discussions"]',
  'a[href="#calendar"]',
  'a[href="#announcements"]',
  'a[href="#members"]',
  'a[href="#requests"]',
  'a[href="#resources"]',
  'a[href="#services"]',
  'a[href="#settings"]',
  'a[href="#billing"]',
].join(", ");

const ROOM_LANDING_SECTION_SELECTOR = [
  'section#requests',
  'section#resources',
  'section#services',
  'section#settings',
].join(", ");

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
