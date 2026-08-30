import fs from "node:fs";

const route = fs.readFileSync("src/app/notifications/page.tsx", "utf8");
const client = fs.readFileSync("src/app/notifications/notifications-v2-client.tsx", "utf8");
const css = fs.readFileSync("src/app/notifications/notifications-editorial.css", "utf8");

function requireText(source, needle, label) {
  if (!source.includes(needle)) throw new Error(`Missing ${label}: ${needle}`);
}

function forbidText(source, needle, label) {
  if (source.includes(needle)) throw new Error(`Forbidden ${label}: ${needle}`);
}

requireText(route, 'import "./notifications-editorial.css"', "Editorial stylesheet wiring");
requireText(route, "<NotificationsV2Client roomId={roomId} />", "Notifications client wiring");
requireText(route, "<FollowRequestActions />", "follow request actions");
requireText(route, "<TeenSafetyNotificationDestinations />", "teen safety destinations");

requireText(client, 'getBlockedRelationshipUserIds(supabase, user.id)', "blocked-relationship privacy filter");
requireText(client, 'filterBlockedActorNotifications(', "blocked-actor notification filter");
requireText(client, '.from("notifications")', "notifications data contract");
requireText(client, 'fetch("/api/settings/notification-preferences"', "notification preference contract");
requireText(client, 'href="/contact"', "report issue destination");
requireText(client, 'window.dispatchEvent(new Event("loombus:notifications-changed"))', "unread badge synchronization");

requireText(css, "background: var(--loombus-page-bg);", "Loombus page background");
requireText(css, "border-bottom: 1px solid var(--loombus-border);", "divider-led structure");
requireText(css, ".notifications-v2-tabs button::after", "underline filter structure");
requireText(css, "background: var(--loombus-gold);", "restrained Gold active state");
requireText(css, ".notifications-v2-row.is-unread::before", "flat unread signal");
requireText(css, ".notifications-v2-row.is-unread:hover", "unread flat-state override");
requireText(css, "@media (max-width: 719px)", "mobile layout");
requireText(css, "@media (prefers-reduced-motion: reduce)", "reduced-motion support");

for (const forbidden of [
  "radial-gradient",
  "linear-gradient",
  "border-radius: 999px",
  "var(--loombus-gold-surface)",
]) {
  forbidText(css, forbidden, "legacy card/pill treatment in Editorial layer");
}

console.log("Notifications Editorial UI verification passed.");
