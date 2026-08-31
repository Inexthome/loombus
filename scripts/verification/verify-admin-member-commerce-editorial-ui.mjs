import fs from "node:fs";

const routes = [
  ["users", "AdminUsersV2Client", 'active="users"'],
  ["support", "AdminSupportV2Client", 'active="support"'],
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

for (const label of ["Members", "Support", "AI access", "Billing", "Booking payments"]) {
  requireText(frame, label, `Editorial suite navigation must retain ${label}.`);
}
requireText(frame, 'aria-current={active === item.key ? "page" : undefined}', "Editorial navigation must expose active-route semantics.");
requireText(frame, "Members, support & billing", "Editorial suite eyebrow changed unexpectedly.");
requireText(css, "background: var(--loombus-page-bg)", "Admin member and commerce routes must use the standard Loombus page background.");
requireText(css, "border-bottom: 1px solid var(--loombus-border)", "Editorial structure must remain divider-led.");
requireText(css, "#CBAB5B", "Editorial routes must retain restrained Loombus Gold.");
requireText(css, "prefers-reduced-motion", "Editorial routes must preserve reduced-motion behavior.");
requireText(css, "booking-payments", "Professional Booking payment operations must be covered by the shared Editorial layer.");

if (/radial-gradient|linear-gradient/.test(css)) {
  throw new Error("Shared member and commerce Editorial layer must not introduce decorative gradients.");
}

console.log("Admin member and commerce Editorial UI verification passed.");
