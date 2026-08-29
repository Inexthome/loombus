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
const page = read("src/app/settings/page.tsx");
const workspaceCss = read("src/app/settings/settings-workspace.css");
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
assertExcludes(page, "settings-enforcement-link", "standalone account enforcement action");
assertIncludes(workspaceCss, ".settings-v2-metrics", "dashboard metric removal rule");
assertIncludes(workspaceCss, "#privacy > .settings-v2-resource-grid", "privacy duplicate-link cleanup");
assertIncludes(
  profileLayout,
  "Account, privacy, message, and notification",
  "Profile ownership boundary copy"
);
assertExcludes(profileLayout, "<strong>Communication</strong>", "Profile communication ownership");

console.log("Settings information architecture verification passed.");
