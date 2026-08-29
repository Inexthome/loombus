import fs from "node:fs";

const paths = {
  page: "src/app/admin/page.tsx",
  client: "src/app/admin/admin-operations-client.tsx",
  styles: "src/app/admin/admin-operations.css",
};

const files = Object.fromEntries(
  Object.entries(paths).map(([key, path]) => [key, fs.readFileSync(path, "utf8")])
);

function requireText(source, needle, label) {
  if (!source.includes(needle)) throw new Error(`Missing ${label}: ${needle}`);
}

function forbidText(source, needle, label) {
  if (source.includes(needle)) throw new Error(`Unexpected ${label}: ${needle}`);
}

requireText(files.page, "AdminOperationsClient", "Admin operations route");
requireText(files.page, './admin-operations.css', "Admin Editorial stylesheet");
forbidText(files.page, 'aria-label="Admin operations shortcuts"', "detached shortcut strip");

requireText(files.client, 'window.location.replace("/login?next=/admin")', "signed-out redirect");
requireText(files.client, '.select("is_admin")', "Admin role verification");
requireText(files.client, 'supabase.from("reports")', "report totals");
requireText(files.client, 'supabase.from("support_requests")', "support totals");
requireText(files.client, 'supabase.from("labs_feature_requests")', "Labs totals");
requireText(files.client, 'supabase.from("profiles")', "member totals");
requireText(files.client, 'className="admin-ops-signal-strip"', "flat operational signal strip");
requireText(files.client, 'className="admin-ops-attention-list"', "attention list");
requireText(files.client, 'className="admin-ops-directory"', "operations directory");
requireText(files.client, 'href: "/admin/age-safety"', "Age Safety directory entry");
requireText(files.client, 'href: "/admin/enforcement"', "Enforcement directory entry");
requireText(files.client, 'href: "/admin/library-review"', "Library Review directory entry");
requireText(files.client, 'href: "/admin/legal-operations"', "Legal Operations directory entry");
requireText(files.client, 'href: "/admin/professional-booking/payments"', "booking payments directory entry");
requireText(files.client, '<h1>Operations</h1>', "concise Admin heading");
forbidText(files.client, "Run Loombus from one verified workspace.", "retired Admin hero wording");
forbidText(files.client, "without creating parallel Admin systems", "retired Admin hero wording");
forbidText(files.client, "MetricCard", "dashboard metric-card component");
forbidText(files.client, "ModuleCard", "dashboard module-card component");
forbidText(files.client, "admin-ops-integrity-card", "dashboard integrity card");

requireText(files.styles, 'background: var(--loombus-page-bg, #000000);', "preserved Loombus page background");
requireText(files.styles, '.admin-ops-signal-strip', "signal-strip styles");
requireText(files.styles, '.admin-ops-attention-row', "attention-row styles");
requireText(files.styles, '.admin-ops-module-row', "directory-row styles");
requireText(files.styles, 'border-bottom: 1px solid var(--loombus-border', "divider-led structure");
requireText(files.styles, '@media (max-width: 680px)', "mobile adaptation");
requireText(files.styles, '@media (prefers-reduced-motion: reduce)', "reduced-motion support");
forbidText(files.styles, "radial-gradient", "decorative Admin background gradient");
forbidText(files.styles, ".admin-ops-metric {", "legacy metric cards");
forbidText(files.styles, ".admin-ops-module-card", "legacy module cards");
forbidText(files.styles, ".admin-ops-priority-card", "legacy priority cards");
forbidText(files.styles, "--admin-ops-cream", "forced Admin Cream token");

console.log("Admin Editorial UI verification passed.");
