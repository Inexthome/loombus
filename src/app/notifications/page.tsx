import NotificationsV2Client from "./notifications-v2-client";
import TeenSafetyNotificationDestinations from "./teen-safety-notification-destinations";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function NotificationsPage() {
  return (
    <>
      <NotificationsV2Client />
      <TeenSafetyNotificationDestinations />
    </>
  );
}
