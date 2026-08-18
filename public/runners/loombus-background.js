const UNREAD_COUNT_KEY = "loombus.background.unread-count";
const LAST_REFRESH_KEY = "loombus.background.last-refresh-at";
const LAST_SIGNAL_KEY = "loombus.background.last-signal-at";

function normalizeUnreadCount(value) {
  const count = Number(value);

  if (!Number.isFinite(count)) {
    return null;
  }

  return Math.max(0, Math.min(999, Math.trunc(count)));
}

function applyUnreadCount(value) {
  const count = normalizeUnreadCount(value);

  if (count === null) {
    return false;
  }

  CapacitorNotifications.setBadge({ count });
  CapacitorKV.set(UNREAD_COUNT_KEY, String(count));
  return true;
}

addEventListener("refreshLoombus", (resolve, reject) => {
  try {
    // Keep scheduled work network-free. APNs and FCM carry the current badge
    // count when there is real activity, so this event only records that the
    // operating system granted a background refresh window.
    CapacitorKV.set(LAST_REFRESH_KEY, new Date().toISOString());
    resolve();
  } catch (error) {
    reject(error);
  }
});

addEventListener("remoteNotification", (resolve, reject, args) => {
  try {
    applyUnreadCount(args?.unreadCount);
    CapacitorKV.set(LAST_SIGNAL_KEY, new Date().toISOString());
    resolve();
  } catch (error) {
    reject(error);
  }
});
