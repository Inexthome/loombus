import fs from "node:fs";

const page = fs.readFileSync("src/app/admin/platform/page.tsx", "utf8");
const modulePage = fs.readFileSync("src/app/admin/platform/[module]/page.tsx", "utf8");
const foundation = fs.readFileSync("src/app/admin/platform/admin-platform-foundation.tsx", "utf8");
const registry = fs.readFileSync("src/app/admin/platform/admin-platform-registry.ts", "utf8");

function requireText(text, value, message) {
  if (!text.includes(value)) throw new Error(message);
}

requireText(page, "PlatformOverviewClient", "Platform overview client must remain mounted.");
requireText(modulePage, "ADMIN_PLATFORM_MODULES", "Dynamic platform route must remain registry-backed.");
requireText(modulePage, 'module === "duplicates"', "Duplicate review route must remain preserved.");
requireText(modulePage, 'module === "search"', "Search operations route must remain preserved.");
requireText(modulePage, "PlatformModuleClient", "Standard platform modules must remain mounted.");

requireText(foundation, "admin-platform-editorial-masthead", "Platform shell must use the native Editorial masthead.");
requireText(foundation, "admin-platform-editorial-nav", "Platform shell must use text-led Editorial navigation.");
requireText(foundation, "admin-platform-editorial-metric", "Metrics must use the Editorial index treatment.");
requireText(foundation, "admin-platform-editorial-section", "Operational groups must use Editorial sections.");
requireText(foundation, "border-b border-[var(--loombus-border)]", "Editorial structure must be divider-led.");
requireText(foundation, "bg-[var(--loombus-page-bg)]", "Platform pages must use the Loombus page background.");
requireText(foundation, "focus-visible:outline", "Platform controls must preserve visible keyboard focus.");
requireText(foundation, "motion-reduce:transition-none", "Platform controls must preserve reduced-motion behavior.");

if (/radial-gradient|shadow-2xl|rounded-\[2rem\]/.test(foundation)) {
  throw new Error("Admin Platform foundation must not restore dashboard hero decoration.");
}

for (const slug of ["marketplace", "businesses", "jobs", "events", "requests", "services", "rooms", "appointments", "local", "matches", "duplicates", "search"]) {
  requireText(registry, `key: "${slug}"`, `Platform module slug ${slug} must remain registered.`);
}

console.log("Admin Platform Editorial UI verification passed.");
