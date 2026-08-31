import fs from "node:fs";

const routes = [
  ["reports", "ReportsV2Client", "reports-v2-page"],
  ["safety", "SafetyV2Client", "safety-v2-page"],
  ["enforcement", "AdminEnforcementClient", "admin-enforcement-page"],
  ["deleted", "AdminDeletedV2Client", "deleted-v2-page"],
  ["deleted-replies", "AdminDeletedRepliesV2Client", "deleted-replies-v2-page"],
  ["audit", "AdminAuditV2Client", "audit-v2-page"],
];

const sharedPath = "src/app/admin/trust-safety-editorial.css";
const shared = fs.readFileSync(sharedPath, "utf8");

function requireText(text, value, message) {
  if (!text.includes(value)) throw new Error(message);
}

for (const [route, component, scope] of routes) {
  const pagePath = `src/app/admin/${route}/page.tsx`;
  const page = fs.readFileSync(pagePath, "utf8");
  requireText(page, 'import "../trust-safety-editorial.css"', `${route} must load the shared Admin Editorial layer.`);
  requireText(page, component, `${route} route composition changed unexpectedly.`);
  requireText(shared, `.${scope}`, `${route} must be covered by the shared Admin Editorial layer.`);
}

const reportsPage = fs.readFileSync("src/app/admin/reports/page.tsx", "utf8");
requireText(reportsPage, 'href="/admin/reports/trust-safety"', "Restricted Trust and Safety navigation changed unexpectedly.");
requireText(reportsPage, "Open restricted Trust and Safety cases", "Restricted Trust and Safety label changed unexpectedly.");

requireText(shared, "background: var(--loombus-page-bg) !important", "Admin trust and safety routes must use the standard Loombus page background.");
requireText(shared, "border-bottom: 1px solid var(--loombus-border) !important", "Admin trust and safety routes must use divider-led Editorial structure.");
requireText(shared, "#CBAB5B", "Admin trust and safety routes must retain restrained Loombus Gold.");
requireText(shared, "box-shadow: none !important", "Admin trust and safety routes must remove dashboard elevation.");
requireText(shared, "prefers-reduced-motion", "Admin trust and safety routes must preserve reduced-motion behavior.");

if (/radial-gradient|linear-gradient/.test(shared)) {
  throw new Error("Shared Admin Editorial layer must not introduce decorative gradients.");
}

console.log("Admin Trust and Safety Editorial UI verification passed.");
