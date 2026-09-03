import fs from "node:fs";

const routes = [
  ["users", "AdminUsersV2Client", 'active="users"'],
  ["support", "AdminSupportV2Client", 'active="support"'],
  ["communications", "AdminCommunicationsClient", 'active="communications"'],
  ["ai-access", "AdminAiAccessV2Client", 'active="ai-access"'],
  ["billing", "AdminBillingV2Client", 'active="billing"'],
  ["professional-booking/payments", "ProfessionalBookingPaymentOperationsClient", 'active="booking-payments"'],
];

function requireText(text, value, message) {
  if (!text.includes(value)) throw new Error(message);
}

for (const [route, component, active] of routes) {
  const page = fs.readFileSync(`src/app/admin/${route}/page.tsx`, "utf8");
  requireText(page, "AdminMemberCommerceEditorialFrame", `${route} must use the native Editorial frame.`);
  requireText(page, component, `${route} client composition changed unexpectedly.`);
  requireText(page, active, `${route} must declare its active Editorial section.`);
  requireText(page, "member-commerce-editorial.css", `${route} must load the shared Editorial layer.`);
}

const frame = fs.readFileSync("src/app/admin/admin-member-commerce-editorial-frame.tsx", "utf8");
const css = fs.readFileSync("src/app/admin/member-commerce-editorial.css", "utf8");
const communicationsCss = fs.readFileSync("src/app/admin/communications/communications-editorial.css", "utf8");

for (const label of ["Members", "Support", "Communications", "AI access", "Billing", "Booking payments"]) {
  requireText(frame, label, `Editorial suite navigation must retain ${label}.`);
}
requireText(frame, 'aria-current={active === item.key ? "page" : undefined}', "Editorial navigation must expose active-route semantics.");
requireText(frame, "Members, support & billing", "Editorial suite eyebrow changed unexpectedly.");
requireText(css, "background: var(--loombus-page-bg)", "Admin member and commerce routes must use the standard Loombus page background.");
requireText(css, "border-bottom: 1px solid var(--loombus-border)", "Editorial structure must remain divider-led.");
requireText(css, "#CBAB5B", "Editorial routes must retain restrained Loombus Gold.");
requireText(css, "prefers-reduced-motion", "Editorial routes must preserve reduced-motion behavior.");
requireText(css, "booking-payments", "Professional Booking payment operations must be covered by the shared Editorial layer.");
requireText(communicationsCss, "var(--loombus-text)", "Communications must use Loombus appearance variables.");
requireText(communicationsCss, "border-bottom: 1px solid var(--loombus-border)", "Communications must remain divider-led.");
requireText(communicationsCss, "#CBAB5B", "Communications must retain restrained Loombus Gold.");
requireText(communicationsCss, "prefers-reduced-motion", "Communications must preserve reduced-motion behavior.");

if (/radial-gradient|linear-gradient/.test(`${css}\n${communicationsCss}`)) {
  throw new Error("Admin member and commerce Editorial layers must not introduce decorative gradients.");
}

const communicationsClient = fs.readFileSync("src/app/admin/communications/communications-client.tsx", "utf8");
if (/rounded-3xl|bg-neutral-950|bg-neutral-900/.test(communicationsClient)) {
  throw new Error("Admin Communications must not regress to the standalone generic dashboard shell.");
}

const usersClient = fs.readFileSync("src/app/admin/users/admin-users-v2-client.tsx", "utf8");
requireText(
  usersClient,
  'if (!value) return "";',
  "Admin suspension datetime conversion must preserve a null suspension as an empty editor value."
);
requireText(
  usersClient,
  "function defaultSuspensionEndValue()",
  "Admin member suspension must keep the 7-day default separate from persisted suspension data."
);
requireText(
  usersClient,
  'action === "suspend_user" && !suspendedUntil',
  "Admin member suspension must initialize the default only when an Admin begins a suspension action."
);
if (/value \? new Date\(value\) : new Date\(Date\.now\(\) \+ 7/.test(usersClient)) {
  throw new Error("Admin member suspension must not fabricate a future suspension date for null records.");
}

console.log("Admin member and commerce Editorial UI verification passed.");
