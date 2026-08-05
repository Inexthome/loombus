import { Bell, MessageCircle } from "lucide-react";
import Link from "next/link";
import MessagesV2Client from "../messages/messages-v2-client";
import NotificationsV2Client from "../notifications/notifications-v2-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type InboxTab = "notifications" | "messages";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const params = await searchParams;
  const requestedTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const activeTab: InboxTab =
    requestedTab === "messages" ? "messages" : "notifications";

  return (
    <div className="loombus-inbox-hub">
      <header className="loombus-inbox-hub-header">
        <div>
          <p>Attention center</p>
          <h1>Inbox</h1>
          <span>
            Notifications and private conversations now live in one predictable place.
          </span>
        </div>

        <nav aria-label="Inbox sections">
          <Link
            href="/inbox?tab=notifications"
            aria-current={activeTab === "notifications" ? "page" : undefined}
            data-active={activeTab === "notifications" ? "true" : "false"}
          >
            <Bell aria-hidden="true" size={17} strokeWidth={2.1} />
            Notifications
          </Link>
          <Link
            href="/inbox?tab=messages"
            aria-current={activeTab === "messages" ? "page" : undefined}
            data-active={activeTab === "messages" ? "true" : "false"}
          >
            <MessageCircle aria-hidden="true" size={17} strokeWidth={2.1} />
            Messages
          </Link>
        </nav>
      </header>

      <section className="loombus-inbox-hub-content">
        {activeTab === "messages" ? (
          <MessagesV2Client />
        ) : (
          <NotificationsV2Client />
        )}
      </section>
    </div>
  );
}
