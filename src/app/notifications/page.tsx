import FollowRequestActions from "./follow-request-actions";
import NotificationsV2Client from "./notifications-v2-client";
import TeenSafetyNotificationDestinations from "./teen-safety-notification-destinations";
import AdminAttentionNotifications from "./admin-attention-notifications";
import "./notifications-desktop-width.css";
import "./notifications-editorial.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ room?: string | string[] }>;
}) {
  const params = await searchParams;
  const roomParam = Array.isArray(params.room) ? params.room[0] : params.room;
  const roomId = roomParam?.trim() || null;

  return (
    <>
      {!roomId ? <AdminAttentionNotifications /> : null}
      <NotificationsV2Client roomId={roomId} />
      {!roomId ? <FollowRequestActions /> : null}
      {!roomId ? <TeenSafetyNotificationDestinations /> : null}
    </>
  );
}
