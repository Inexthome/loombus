import fs from "node:fs";

const matchesPagePath = "src/app/matches/page.tsx";
const matchesCssPath = "src/app/matches/matches-editorial.css";
const matchesSourcePath = "src/components/intelligent-matching-page.tsx";
const stickiesPagePath = "src/app/stickies/page.tsx";
const stickiesCssPath = "src/app/stickies/stickies-editorial.css";
const stickiesSourcePath = "src/app/stickies/stickies-v2-client.tsx";

const matchesPage = fs.readFileSync(matchesPagePath, "utf8");
const matchesCss = fs.readFileSync(matchesCssPath, "utf8");
const matchesSource = fs.readFileSync(matchesSourcePath, "utf8");
const stickiesPage = fs.readFileSync(stickiesPagePath, "utf8");
const stickiesCss = fs.readFileSync(stickiesCssPath, "utf8");
const stickiesSource = fs.readFileSync(stickiesSourcePath, "utf8");

function requireText(text, value, message) {
  if (!text.includes(value)) throw new Error(message);
}

function forbid(text, pattern, message) {
  if (pattern.test(text)) throw new Error(message);
}

requireText(matchesPage, 'import "./matches-editorial.css"', "/matches must load its Editorial stylesheet.");
requireText(matchesPage, "data-loombus-matches-editorial", "/matches must expose its Editorial route scope.");
requireText(matchesPage, "<IntelligentMatchingPage />", "/matches route composition changed unexpectedly.");
requireText(matchesCss, "#FEFBEC", "/matches Light/System-light must use canonical Loombus Cream.");
requireText(matchesCss, "#CBAB5B", "/matches must use canonical Loombus Gold.");
requireText(matchesCss, 'section[class*="lg:grid-cols-4"]', "/matches summary must be flattened into an editorial index.");
requireText(matchesCss, 'section[class*="space-y-4"] > article', "/matches result records must use restrained editorial containment.");
requireText(matchesCss, "aside > section", "/matches preferences and rules must use a quiet contextual rail.");
requireText(matchesCss, "border-bottom: 2px solid transparent", "/matches view controls must use text-led tabs.");
requireText(matchesCss, 'section[class*="space-y-4"] > div[class*="rounded-[1.75rem]"]', "/matches loading, paused, and empty states must be flattened into editorial sections.");
requireText(matchesCss, 'aside label[class*="rounded-full"]', "/matches preference choices must not remain pill-heavy.");
requireText(matchesCss, 'aside details[class*="rounded-2xl"]', "/matches category controls must use flat Editorial treatment.");
requireText(matchesCss, "justify-content: flex-start !important", "/matches empty-state actions must align with the editorial reading flow.");
requireText(matchesCss, "prefers-reduced-motion", "/matches must preserve reduced-motion behavior.");
forbid(matchesCss, /radial-gradient|linear-gradient/, "/matches Editorial layer must not add decorative gradients.");

requireText(matchesSource, 'serviceRequestsAuthorizedFetch(\n        "/api/matches"', "/matches load contract changed unexpectedly.");
requireText(matchesSource, 'action: "refresh"', "/matches refresh behavior changed unexpectedly.");
requireText(matchesSource, 'action: "update_preferences"', "/matches preference-save behavior changed unexpectedly.");
requireText(matchesSource, 'action: "candidate_state"', "/matches candidate-state behavior changed unexpectedly.");
requireText(matchesSource, 'action: "feedback"', "/matches feedback behavior changed unexpectedly.");
requireText(matchesSource, 'action: "create_rule"', "/matches rule creation behavior changed unexpectedly.");
requireText(matchesSource, "setViewMode(tab.value)", "/matches Active/Saved/Dismissed switching changed unexpectedly.");
requireText(matchesSource, "href={match.target.href}", "/matches destination behavior changed unexpectedly.");
requireText(matchesSource, "No matches in this view", "/matches empty-state guidance changed unexpectedly.");
requireText(matchesSource, "Matching preferences", "/matches preference workspace changed unexpectedly.");

requireText(stickiesPage, 'import "./stickies-editorial.css"', "/stickies must load its Editorial stylesheet.");
requireText(stickiesPage, "data-loombus-stickies-editorial", "/stickies must expose its Editorial route scope.");
requireText(stickiesPage, "<StickiesV2Client />", "/stickies route composition changed unexpectedly.");
requireText(stickiesPage, 'export const dynamic = "force-dynamic"', "/stickies dynamic rendering contract changed unexpectedly.");
requireText(stickiesPage, "export const revalidate = 0", "/stickies revalidation contract changed unexpectedly.");
requireText(stickiesCss, "#FEFBEC", "/stickies Light/System-light must use canonical Loombus Cream.");
requireText(stickiesCss, "#CBAB5B", "/stickies must use canonical Loombus Gold.");
requireText(stickiesCss, ".stickies-v2-grid", "/stickies pinned discussions must retain their board surface.");
requireText(stickiesCss, "grid-template-columns: 1fr !important", "/stickies pinned discussions must use a continuous editorial queue.");
requireText(stickiesCss, ".stickies-v2-sidebar > section", "/stickies contextual rail must be editorialized.");
requireText(stickiesCss, "box-shadow: none !important", "/stickies Editorial layer must remove dashboard elevation.");
requireText(stickiesCss, "prefers-reduced-motion", "/stickies must preserve reduced-motion behavior.");
forbid(stickiesCss, /radial-gradient|linear-gradient/, "/stickies Editorial layer must not add decorative gradients.");

requireText(stickiesSource, 'fetch("/api/stickies"', "/stickies API contract changed unexpectedly.");
requireText(stickiesSource, 'method: "POST"', "/stickies pin behavior changed unexpectedly.");
requireText(stickiesSource, 'method: "PATCH"', "/stickies reorder behavior changed unexpectedly.");
requireText(stickiesSource, 'method: "DELETE"', "/stickies removal behavior changed unexpectedly.");
requireText(stickiesSource, "orderedIds: nextItems.map((item) => item.id)", "/stickies persisted-order payload changed unexpectedly.");
requireText(stickiesSource, "handleStickyDragStart", "/stickies drag reorder changed unexpectedly.");
requireText(stickiesSource, "moveSticky(stickyId", "/stickies keyboard/button reorder changed unexpectedly.");
requireText(stickiesSource, "upgradeRequired", "/stickies Premium entitlement behavior changed unexpectedly.");
requireText(stickiesSource, 'href="/saved"', "/stickies Saved destination changed unexpectedly.");

console.log("Matches and Stickies Editorial UI verification passed.");
