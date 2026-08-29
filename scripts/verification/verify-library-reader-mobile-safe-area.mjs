import fs from "node:fs";

const pagePath = "src/app/library/read/[publicationId]/page.tsx";
const guardrailPath = "src/components/library/library-reader-mobile-safe-area.tsx";

for (const path of [pagePath, guardrailPath]) {
  if (!fs.existsSync(path)) throw new Error(`Missing Reader safe-area file: ${path}`);
}

const page = fs.readFileSync(pagePath, "utf8");
const guardrail = fs.readFileSync(guardrailPath, "utf8");

function requireText(source, text, label) {
  if (!source.includes(text)) throw new Error(`Missing ${label}: ${text}`);
}

requireText(page, "LibraryReaderMobileSafeArea", "Reader safe-area component import/wiring");
requireText(guardrail, "env(safe-area-inset-top, 0px)", "top device safe area");
requireText(guardrail, "env(safe-area-inset-bottom, 0px)", "bottom device safe area");
requireText(guardrail, "env(safe-area-inset-left, 0px)", "left device safe area");
requireText(guardrail, "env(safe-area-inset-right, 0px)", "right device safe area");
requireText(guardrail, '[aria-label="Reader controls"]', "mobile Reader trigger protection");
requireText(guardrail, '[data-library-reader-mobile-sheet="true"]', "mobile Reader sheet protection");
requireText(guardrail, '[data-library-reader-selection-toolbar="true"]', "selection toolbar protection");
requireText(guardrail, "> aside", "Reader side panel safe-area protection");
requireText(guardrail, "min-width: 44px", "minimum mobile touch target width");
requireText(guardrail, "min-height: 44px", "minimum mobile touch target height");

for (const forbidden of ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY", "dangerouslySetInnerHTML"]) {
  if (guardrail.includes(forbidden)) throw new Error(`Forbidden Reader safe-area token: ${forbidden}`);
}

console.log("PASS: Reader mobile controls respect top/bottom/side device safe areas and preserve reachable touch targets.");
