import fs from "node:fs";

const directoryPath = "src/components/rooms-directory-v3.tsx";
const routePath = "src/app/rooms/page.tsx";

const directory = fs.readFileSync(directoryPath, "utf8");
const route = fs.readFileSync(routePath, "utf8");

function requireText(source, needle, label) {
  if (!source.includes(needle)) {
    throw new Error(`Missing ${label}: ${needle}`);
  }
}

function forbidText(source, needle, label) {
  if (source.includes(needle)) {
    throw new Error(`Forbidden ${label}: ${needle}`);
  }
}

requireText(route, "RoomsDirectoryV3", "Rooms directory route wiring");
requireText(directory, 'data-rooms-editorial="directory"', "Editorial directory marker");
requireText(directory, "bg-[var(--loombus-page-bg)]", "original Loombus background");
requireText(directory, 'fetch("/api/rooms"', "Rooms API contract");
requireText(directory, 'window.location.href = "/login?next=/rooms"', "authenticated Rooms redirect");
requireText(directory, '.channel("rooms-directory-v3")', "Rooms realtime channel");
requireText(directory, 'table: "rooms"', "rooms realtime subscription");
requireText(directory, 'table: "room_members"', "membership realtime subscription");
requireText(directory, 'table: "room_posts"', "post realtime subscription");
requireText(directory, 'table: "room_events"', "event realtime subscription");
requireText(directory, 'table: "room_announcements"', "announcement realtime subscription");
requireText(directory, 'window.location.assign(`/rooms/join?token=${encodeURIComponent(token)}`)', "invitation join handoff");
requireText(directory, 'href="/rooms/new"', "Room creation destination");
requireText(directory, 'href={`/rooms/${encodeURIComponent(room.id)}`}', "Room destination");
requireText(directory, 'href={`/rooms/${encodeURIComponent(room.id)}/calendar`}', "Room calendar destination");
requireText(directory, "border-b-2", "underline filter structure");
requireText(directory, "border-[var(--loombus-gold)]", "restrained Gold active state");
requireText(directory, "divide-y divide-[var(--loombus-border)]", "divider-led records");
requireText(directory, "ROOM_MODELS.slice(0, 4)", "empty-state model guidance");

for (const forbidden of [
  "rooms-directory-left",
  "rooms-directory-right",
  "rooms-directory-sticky",
  "rooms-directory-rail-card",
  "rooms-directory-card",
  "shadow-xl",
  "shadow-2xl",
  "radial-gradient",
]) {
  forbidText(directory, forbidden, "legacy dashboard/card treatment");
}

console.log("Rooms directory Editorial UI verification passed.");
