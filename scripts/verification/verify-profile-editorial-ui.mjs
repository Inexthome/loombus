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

const layout = read("src/app/profile/layout.tsx");
const page = read("src/app/profile/page.tsx");
const controller = read("src/components/profile-workspace-controller.tsx");
const editorialCss = read("src/app/profile/profile-editorial-ui.css");
const creatorHub = read("src/components/creator-hub-phase-one.tsx");
const viewers = read("src/components/profile-viewers-panel.tsx");
const supporter = read("src/components/creator-supporter-program-manager-phase2.tsx");
const paidSupporter = read("src/components/creator-paid-supporter-manager.tsx");

assertIncludes(layout, 'import "./profile-v2-shell.css";', "legacy Profile shell import");
assertIncludes(layout, 'import "./profile-editorial-ui.css";', "Profile Editorial UI import");
if (
  layout.indexOf('import "./profile-editorial-ui.css";') <
  layout.indexOf('import "./profile-v2-shell.css";')
) {
  throw new Error("Profile Editorial UI must load after the legacy shell stylesheet.");
}

for (const section of [
  'label: "Overview"',
  'label: "Public profile"',
  'label: "Creator Hub"',
  'label: "Profile viewers"',
  'label: "Preview and sharing"',
]) {
  assertIncludes(controller, section, `Profile workspace section ${section}`);
}

assertIncludes(page, 'from("profiles")', "profile data loading");
assertIncludes(page, 'from("avatars")', "avatar storage upload");
assertIncludes(page, 'fetch("/api/profile/avatar"', "avatar API update");
assertIncludes(page, 'fetch("/api/profile/public"', "public profile save API");
assertIncludes(page, "validatePublicProfileCompletion", "public profile completion gate");
assertIncludes(page, "beforeunload", "unsaved-change browser guard");
assertIncludes(page, "copyPublicProfileLink", "public profile sharing behavior");

assertIncludes(creatorHub, "CreatorHubPhaseOne", "Creator Hub runtime");
assertIncludes(creatorHub, 'fetch("/api/profile/public"', "Creator Hub profile save API");
assertIncludes(viewers, 'fetch("/api/profiles/viewers"', "Profile viewers API");
assertIncludes(supporter, "CreatorSupporterProgramManagerPhase2", "supporter program runtime");
assertIncludes(paidSupporter, "CreatorPaidSupporterManager", "paid supporter runtime");

assertIncludes(editorialCss, "--profile-editorial-gold: #cbab5b", "canonical Loombus Gold");
assertIncludes(editorialCss, "--profile-editorial-cream: #fefbec", "canonical Loombus Cream");
assertIncludes(editorialCss, 'html[data-loombus-theme="light"] .profile-v2-route', "Light appearance behavior");
assertIncludes(editorialCss, 'html[data-loombus-theme="system"] .profile-v2-route', "System-light appearance behavior");
assertIncludes(editorialCss, ".profile-workspace-nav button.is-active::before", "Gold Profile navigation indicator");
assertIncludes(editorialCss, ".profile-v2-content form", "flat Profile editor treatment");
assertIncludes(editorialCss, ".creator-hub-launch-grid article", "Creator Hub Editorial treatment");
assertIncludes(editorialCss, ".creator-supporter-manager", "supporter manager Editorial treatment");
assertIncludes(editorialCss, ".creator-paid-supporter-manager", "paid supporter Editorial treatment");
assertIncludes(editorialCss, ".profile-workspace-standalone-section > section", "Profile viewers Editorial treatment");
assertIncludes(editorialCss, "overflow-x: clip", "mobile page overflow protection");
assertIncludes(editorialCss, "min-height: 2.75rem", "minimum practical mobile controls");
assertIncludes(editorialCss, "@media (prefers-reduced-motion: reduce)", "reduced-motion support");
assertIncludes(editorialCss, ":focus-visible", "visible keyboard focus");
assertExcludes(editorialCss, "radial-gradient", "dashboard gradient chrome in Profile Editorial override");

console.log("Profile Editorial UI verification passed.");
