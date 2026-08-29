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
const route = read("src/app/profile/page.tsx");
const page = read("src/app/profile/profile-editorial-page.tsx");
const editorialCss = read("src/app/profile/profile-editorial-ui.css");
const accessibilityCss = read("src/app/profile/profile-editorial-accessibility.css");
const creatorHub = read("src/components/creator-hub-phase-one.tsx");
const viewers = read("src/components/profile-viewers-panel.tsx");
const supporter = read("src/components/creator-supporter-program-manager-phase2.tsx");
const paidSupporter = read("src/components/creator-paid-supporter-manager.tsx");

assertIncludes(layout, 'import "./profile-editorial-ui.css";', "Profile Editorial UI import");
assertIncludes(layout, 'import "./profile-editorial-accessibility.css";', "Profile accessibility import");
assertExcludes(layout, 'import "./profile-v2-shell.css";', "legacy Profile shell import");
assertIncludes(route, 'export { default } from "./profile-editorial-page";', "Editorial profile route");

for (const section of [
  'label: "Overview"',
  'label: "Public profile"',
  'label: "Creator"',
  'label: "Viewers"',
  'label: "Preview & sharing"',
]) {
  assertIncludes(page, section, `Profile workspace section ${section}`);
}

assertIncludes(page, "activeSection", "React-rendered Profile section state");
assertExcludes(page, "document.querySelector", "legacy DOM-query section control");
assertExcludes(page, "style.display", "legacy DOM visibility mutation");
assertIncludes(page, 'from("profiles")', "profile data loading");
assertIncludes(page, 'from("avatars")', "avatar storage upload");
assertIncludes(page, 'fetch("/api/profile/avatar"', "avatar API update");
assertIncludes(page, 'fetch("/api/profile/public"', "public profile save API");
assertIncludes(page, "validatePublicProfileCompletion", "public profile completion gate");
assertIncludes(page, "beforeunload", "unsaved-change browser guard");
assertIncludes(page, "copyPublicProfileLink", "public profile sharing behavior");
assertIncludes(page, "getIdentityVerificationDisplay", "identity verification display");
assertIncludes(page, "CreatorHubPhaseOne", "Creator Hub placement");
assertIncludes(page, "ProfileViewersPanel", "Profile viewers placement");

assertIncludes(creatorHub, "CreatorHubPhaseOne", "Creator Hub runtime");
assertIncludes(creatorHub, 'fetch("/api/profile/public"', "Creator Hub profile save API");
assertIncludes(viewers, 'fetch("/api/profiles/viewers"', "Profile viewers API");
assertIncludes(supporter, "CreatorSupporterProgramManagerPhase2", "supporter program runtime");
assertIncludes(paidSupporter, "CreatorPaidSupporterManager", "paid supporter runtime");

assertIncludes(editorialCss, "background: var(--loombus-page-bg);", "original Loombus page background");
assertExcludes(editorialCss, "--profile-editorial-cream", "forced Cream Profile background");
assertIncludes(editorialCss, ".profile-editorial-tabs", "horizontal Editorial section navigation");
assertIncludes(editorialCss, ".profile-editorial-tabs button.is-active::after", "Gold active navigation indicator");
assertIncludes(editorialCss, ".profile-editorial-facts", "divider-led overview facts");
assertIncludes(editorialCss, ".profile-editorial-field-grid", "structural Editorial form fields");
assertIncludes(editorialCss, ".profile-editorial-preview-layout", "structural preview and sharing layout");
assertIncludes(editorialCss, ".profile-editorial-creator-runtime", "Creator runtime Editorial containment");
assertIncludes(editorialCss, ".profile-editorial-viewers-runtime", "Profile viewers Editorial containment");
assertExcludes(editorialCss, "radial-gradient", "dashboard gradient chrome");

assertIncludes(accessibilityCss, "overflow-x: clip", "mobile page overflow protection");
assertIncludes(accessibilityCss, "min-height: 2.75rem", "minimum practical mobile controls");
assertIncludes(accessibilityCss, "@media (prefers-reduced-motion: reduce)", "reduced-motion support");
assertIncludes(accessibilityCss, ":focus-visible", "visible keyboard focus");

console.log("Profile Editorial UI verification passed.");
