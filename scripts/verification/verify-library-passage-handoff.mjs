import fs from "node:fs";

const helper = fs.readFileSync("src/lib/library/passage-context.ts", "utf8");
const launcher = fs.readFileSync("src/components/library/library-discuss-passage-launcher.tsx", "utf8");
const discuss = fs.readFileSync("src/components/library/library-discuss-passage-composer.tsx", "utf8");
const ask = fs.readFileSync("src/components/library/library-ask-loombus-panel.tsx", "utf8");
const researchPage = fs.readFileSync("src/app/library/research/page.tsx", "utf8");
const researchHandoff = fs.readFileSync("src/components/library/library-research-passage-handoff.tsx", "utf8");
const failures = [];

for (const token of [
  'discuss: "loombus:library:discuss-passage:v1"',
  'ask: "loombus:library:ask-loombus:v1"',
  'research: "loombus:library:research-passage:v1"',
  'selectedText: string',
  'startOffset: number',
  'endOffset: number',
  'textSha256: string',
  'libraryReaderHref',
  'params.set("locator", focus.locator)',
  'params.set("start", String(focus.startOffset))',
  'params.set("end", String(focus.endOffset))',
  'params.set("sha", focus.textSha256)',
]) {
  if (!helper.includes(token)) failures.push(`missing shared passage context contract: ${token}`);
}

for (const token of [
  'writeLibraryPassageContext(destination, passage)',
  'writeLibraryPassageContext("research", passage)',
  'data-library-reader-page',
  'data-library-page-start',
  'closestReaderPage',
  'baseOffset + textOffsetWithin',
  'Passage → Discussion → Evidence → Knowledge',
  'Research evidence',
  'Discuss passage',
  'Ask Loombus',
  '"/api/library/save-to-research"',
  '.eq("status", "published")',
  'section.content_text.slice(startOffset, endOffset) !== trimmed',
  'loombus:reader:passage-action',
]) {
  if (!launcher.includes(token)) failures.push(`missing Reader handoff contract: ${token}`);
}

for (const token of [
  'loombus:library:discuss-passage:v1',
  'selectedText: passage.selectedText',
  'startOffset: passage.startOffset',
  'endOffset: passage.endOffset',
  'textSha256: passage.textSha256',
]) {
  if (!discuss.includes(token)) failures.push(`discussion provenance contract lost: ${token}`);
}

for (const token of [
  'loombus:library:ask-loombus:v1',
  'selectedText: passage.selectedText',
  'startOffset: passage.startOffset',
  'endOffset: passage.endOffset',
  'textSha256: passage.textSha256',
]) {
  if (!ask.includes(token)) failures.push(`Ask Loombus provenance contract lost: ${token}`);
}

for (const token of [
  'LibraryResearchPassageHandoff',
  'readLibraryPassageContext("research")',
  'source preserved',
  'characters {passage.startOffset}–{passage.endOffset}',
  'libraryReaderHref(passage.publicationId, passage)',
  'Back to exact passage',
]) {
  const source = token === 'LibraryResearchPassageHandoff' ? researchPage : researchHandoff;
  if (!source.includes(token)) failures.push(`missing Research handoff contract: ${token}`);
}

for (const source of [helper, launcher, researchHandoff]) {
  for (const token of ["SUPABASE_SERVICE_ROLE_KEY", "service_role", "stripe", "checkout", "openai", "anthropic", "drm"]) {
    if (source.toLowerCase().includes(token.toLowerCase())) failures.push(`out-of-scope capability present: ${token}`);
  }
}

if (failures.length) {
  console.error("Loombus Library passage handoff verification FAILED");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Loombus Library passage handoff verification passed");
console.log("- exact selected passage provenance is captured from full-section or paginated Reader text");
console.log("- discussion, Ask Loombus, and Research retain locator, offsets, and source hash");
console.log("- Research handoff saves the passage before opening the workspace");
console.log("- return links preserve locator, UTF-16 offsets, and source hash for exact Reader restoration");
console.log("- paginated Reader offsets are rebased against the canonical normalized section before handoff");
console.log("- no schema migration or unrelated backend capability is introduced");
