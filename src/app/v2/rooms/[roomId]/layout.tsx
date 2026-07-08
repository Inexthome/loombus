import { RoomBillingLockEnforcer } from "./room-billing-lock-enforcer";
import { RoomDiscussionCardActions } from "./room-discussion-card-actions";
import { RoomPlanMenu } from "./room-plan-menu";
import { RoomPostAttachments } from "./room-post-attachments";
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
      <RoomPostAttachments roomId={roomId} />
      <RoomDiscussionCardActions />
      <RoomPlanMenu roomId={roomId} />
      <RoomPreferencesEnforcer roomId={roomId} />
      <RoomBillingLockEnforcer roomId={roomId} />
    </>
  );
}
