import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const layout = read("src/app/rooms/layout.tsx");
const roomLayout = read("src/app/rooms/[roomId]/layout.tsx");
const routeFrame = read("src/components/room-route-frame-v4.tsx");
const newRoom = read("src/app/rooms/new/page.tsx");
const enterprise = read("src/app/rooms/enterprise/room-enterprise-client.tsx");
const join = read("src/app/rooms/join/page.tsx");
const css = read("src/app/rooms/rooms-editorial-system.css");

function requireText(source, text, message) {
  if (!source.includes(text)) throw new Error(message);
}

function forbidText(source, text, message) {
  if (source.includes(text)) throw new Error(message);
}

// All Rooms routes inherit the final shared Editorial system.
requireText(layout, 'import "./rooms-editorial-system.css";', "Rooms Editorial stylesheet must be loaded.");
const editorialImport = layout.indexOf('import "./rooms-editorial-system.css";');
const previousImport = layout.indexOf('import "./room-mobile-safe-area.css";');
if (editorialImport < previousImport) {
  throw new Error("Rooms Editorial stylesheet must load after the existing Rooms stack.");
}

// The authenticated Room route remains owned by the hardened V4 shell and feature hosts.
requireText(roomLayout, "RoomRouteFrameV4", "Room V4 route frame must remain authoritative.");
requireText(roomLayout, "RoomWorkspaceProvider", "Room workspace provider must remain present.");
requireText(roomLayout, "RoomFeatureHost", "Room feature host must remain present.");
requireText(routeFrame, '/api/rooms/${encodeURIComponent(roomId)}/shell', "Private Room shell authorization must remain present.");
requireText(routeFrame, "roleCanOpenModule", "Plan/role module gating must remain present.");
requireText(routeFrame, "ROOM_MODULE_DEFINITIONS", "Room module registry must remain present.");
requireText(routeFrame, 'aria-current={active ? "page" : undefined}', "Active Room route semantics must remain present.");

// Create / plan / provision behavior remains unchanged.
requireText(newRoom, 'fetch("/api/rooms/checkout-config"', "Room checkout configuration read must remain present.");
requireText(newRoom, 'fetch("/api/rooms/provision"', "Room provisioning contract must remain present.");
requireText(newRoom, "ROOM_BUILDER_DRAFT_KEY", "Room builder draft persistence must remain present.");
requireText(newRoom, "/rooms/enterprise?", "Enterprise handoff must remain present.");
requireText(newRoom, "includedPlanAvailable", "Included-Room subscription behavior must remain present.");

// Enterprise and invitation contracts remain intact.
requireText(enterprise, 'fetch("/api/contact"', "Enterprise inquiry submission must remain present.");
requireText(enterprise, 'category: "billing"', "Enterprise billing/support category must remain present.");
requireText(join, 'fetch("/api/rooms/join"', "Room invitation redemption must remain present.");
requireText(join, "pendingApproval", "Room invitation approval state must remain present.");

// Representative route families must still exist; all inherit the shared layout.
for (const path of [
  "src/app/rooms/[roomId]/age-safety/page.tsx",
  "src/app/rooms/[roomId]/analytics/page.tsx",
  "src/app/rooms/[roomId]/announcements/page.tsx",
  "src/app/rooms/[roomId]/billing/page.tsx",
  "src/app/rooms/[roomId]/calendar/page.tsx",
  "src/app/rooms/[roomId]/dashboard/page.tsx",
  "src/app/rooms/[roomId]/documents/page.tsx",
  "src/app/rooms/[roomId]/finance/page.tsx",
  "src/app/rooms/[roomId]/governance/page.tsx",
  "src/app/rooms/[roomId]/guests/page.tsx",
  "src/app/rooms/[roomId]/maintenance/page.tsx",
  "src/app/rooms/[roomId]/members/page.tsx",
]) {
  if (!fs.existsSync(path)) throw new Error(`Expected Room route missing: ${path}`);
}

// Shared Editorial contract.
requireText(css, '[data-rooms-shell="room"] .rooms-phase1-sidebar', "Authenticated Room shell must receive Editorial treatment.");
requireText(css, ".rooms-v2-builder-page", "Room builder must receive Editorial treatment.");
requireText(css, ".rooms-enterprise-page", "Enterprise flow must receive Editorial treatment.");
requireText(css, ".rooms-live-access-card", "Invitation/access states must receive Editorial treatment.");
requireText(css, "var(--loombus-page-bg)", "Rooms must retain the standard Loombus page background.");
requireText(css, "#CBAB5B", "Canonical Loombus Gold must remain present.");
requireText(css, "focus-visible", "Visible keyboard focus must remain protected.");
requireText(css, "prefers-reduced-motion", "Reduced-motion handling must remain protected.");
requireText(css, "box-shadow: none !important", "Dashboard elevation must remain suppressed in the Editorial layer.");
requireText(css, "border-radius: 0 !important", "Flat Editorial section treatment must remain present.");

forbidText(css, "radial-gradient", "Rooms Editorial layer must not add decorative radial gradients.");
forbidText(css, "shadow-2xl", "Rooms Editorial layer must not add dashboard shadows.");
forbidText(css, "shadow-xl", "Rooms Editorial layer must not add dashboard shadows.");
forbidText(css, "#FEFBEC", "Rooms Editorial completion layer must not force Cream as the page background.");

console.log("Rooms Editorial UI verification passed.");
