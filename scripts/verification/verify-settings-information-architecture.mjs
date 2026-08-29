import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function assertIncludes(source, needle, label) {
  if (!source.includes(needle)) {
    throw new Error(`Missing ${label}: ${needle}`);
  }
}

function assertExcludes(source, needle, label) {
  if (source.includes(needle)) {
    throw new Error(`Unexpected ${label}: ${needle}`);
  }
}

const controller = read("src/components/settings-workspace-controller.tsx");
const mobileSectionSelect = read("src/components/settings-mobile-section-select.tsx");
const page = read("src/app/settings/page.tsx");
const workspaceCss = read("src/app/settings/settings-workspace.css");
const editorialCss = read("src/app/settings/settings-editorial-ui.css");
const mobileCss = read("src/app/settings/settings-editorial-mobile.css");
const mobileSectionCss = read("src/app/settings/settings-mobile-section-select.css");
const profileLayout = read("src/app/profile/layout.tsx");

for (const label of [
  "Account & Security",
  "Profile & Identity",
  "Privacy & Safety",
  "Messages",
  "Notifications & Alerts",
  "Appearance",
  "Subscriptions & Billing",
  "Data & Activity",
]) {
  assertIncludes(controller, `label: \"${label}\"`, `canonical Settings section ${label}`);
  assertIncludes(mobileSectionSelect, `\"${label}\"`, `mobile Settings option ${label}`);
}

assertIncludes(
  controller,
  '\"account-security\": [\"account-security\", \"security\", \"account-controls\"]',
  "Account & Security ownership"
);
assertIncludes(
  controller,
  '\"privacy-safety\": [\"privacy\", \"privacy-safety\"]',
  "Privacy & Safety ownership"
);
assertIncludes(
  controller,
  '\"notifications-alerts\": [\"notifications-alerts\", \"topics\"]',
  "Notifications & Alerts ownership"
);
assertIncludes(
  controller,
  '\"subscriptions-billing\": [\"plan\"]',
  "Subscriptions & Billing ownership"
);

for (const legacy of [
  'signal: \"notifications-alerts\"',
  'topics: \"notifications-alerts\"',
  '\"blocked-members\": \"privacy-safety\"',
  'plan: \"subscriptions-billing\"',
  '\"account-controls\": \"account-security\"',
]) {
  assertIncludes(controller, legacy, `legacy section alias ${legacy}`);
}

assertIncludes(controller, 'href="/account/enforcement"', "Account decisions & appeals placement");
assertIncludes(controller, "Help & Legal", "secondary Help & Legal area");
assertIncludes(page, "<SettingsWorkspaceController />", "canonical Settings workspace controller");
assertIncludes(page, "<SettingsMobileSectionSelect />", "mobile Settings section selector");
assertIncludes(
  page,
  'import { SettingsMobileSectionSelect } from "@/components/settings-mobile-section-select";',
  "mobile Settings selector import"
);
assertExcludes(page, "settings-enforcement-link", "standalone account enforcement action");
assertIncludes(workspaceCss, ".settings-v2-metrics", "dashboard metric removal rule");
assertIncludes(workspaceCss, "#privacy > .settings-v2-resource-grid", "privacy duplicate-link cleanup");
assertIncludes(
  profileLayout,
  "Account, privacy, message, and notification",
  "Profile ownership boundary copy"
);
assertExcludes(profileLayout, "<strong>Communication</strong>", "Profile communication ownership");

assertIncludes(page, 'import "./settings-editorial-ui.css";', "Settings Editorial UI import");
assertIncludes(page, 'import "./settings-editorial-mobile.css";', "Settings mobile Editorial polish import");
assertIncludes(
  page,
  'import "./settings-mobile-section-select.css";',
  "Settings mobile dropdown stylesheet import"
);
if (
  page.indexOf('import "./settings-editorial-mobile.css";') <
  page.indexOf('import "./settings-editorial-ui.css";')
) {
  throw new Error("Settings mobile Editorial polish must load after the main Editorial stylesheet.");
}
if (
  page.indexOf('import "./settings-mobile-section-select.css";') <
  page.indexOf('import "./settings-editorial-mobile.css";')
) {
  throw new Error("Settings mobile section dropdown must load after the mobile Editorial stylesheet.");
}
assertIncludes(editorialCss, "--settings-editorial-gold: #cbab5b", "canonical Loombus Gold");
assertIncludes(editorialCss, "--settings-editorial-cream: #fefbec", "canonical Loombus Cream");
assertIncludes(editorialCss, '.settings-v2-card,\n.settings-workspace-custom-card', "flat Settings section treatment");
assertIncludes(editorialCss, "border-radius: 0;", "flat editorial section geometry");
assertIncludes(editorialCss, ".settings-workspace-nav button.is-active::before", "Gold active navigation indicator");
assertIncludes(editorialCss, "html[data-loombus-theme=\"light\"] .settings-v2-page", "Light appearance behavior");
assertIncludes(editorialCss, "html[data-loombus-theme=\"system\"] .settings-v2-page", "System appearance behavior");
assertIncludes(editorialCss, "@media (prefers-reduced-motion: reduce)", "reduced-motion support");
assertIncludes(editorialCss, ":focus-visible", "visible keyboard focus treatment");
assertIncludes(editorialCss, ".settings-subscription-card", "subscription Editorial UI treatment");
assertIncludes(editorialCss, ".member-privacy-toggle", "privacy Editorial UI treatment");
assertExcludes(editorialCss, "radial-gradient", "dashboard gradient chrome in Editorial override");

assertIncludes(mobileCss, "@media (max-width: 700px)", "mobile Editorial breakpoint");
assertIncludes(mobileCss, "overflow-x: hidden", "mobile page overflow protection");
assertIncludes(mobileCss, "min-height: 2.75rem", "minimum 44px mobile interaction target");
assertIncludes(mobileCss, ".settings-v2-card-header .settings-v2-badge", "mobile header density reduction");
assertIncludes(mobileCss, ".member-privacy-toggle-icon", "compact mobile privacy rows");
assertIncludes(mobileCss, ".settings-subscription-actions,", "compact mobile subscription actions");
assertIncludes(
  mobileCss,
  "grid-template-columns: repeat(2, minmax(0, 1fr));",
  "compact two-column mobile controls"
);
assertExcludes(mobileCss, "grid-template-columns: 1fr;\n  }\n\n  .settings-subscription-facts", "single-column subscription fact overfill");

assertIncludes(
  mobileSectionSelect,
  'aria-label="Settings section"',
  "accessible mobile Settings dropdown"
);
assertIncludes(mobileSectionSelect, "new MutationObserver", "mobile selector active-state synchronization");
assertIncludes(mobileSectionSelect, "button.click();", "mobile selector reuses canonical Settings section behavior");
assertIncludes(
  mobileSectionCss,
  "@media (max-width: 900px)",
  "mobile/tablet Settings dropdown breakpoint"
);
assertIncludes(
  mobileSectionCss,
  ".settings-workspace-nav > button {\n    display: none !important;",
  "mobile horizontal Settings tabs hidden"
);
assertIncludes(
  mobileSectionCss,
  ".settings-mobile-section-select-control select",
  "mobile current-section dropdown styling"
);
assertIncludes(mobileSectionCss, "min-height: 2.75rem", "44px mobile dropdown target");
assertIncludes(mobileSectionCss, "select:focus-visible", "visible dropdown keyboard focus");

console.log("Settings information architecture and Editorial UI verification passed.");
