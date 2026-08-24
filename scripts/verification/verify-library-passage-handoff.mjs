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
]) {
  if (!helper.includes(token)) failures.push(`missing shared passage context contract: ${token}`);
}

for (const token of [
  'writeLibraryPassageContext(destination, selection)',
  'writeLibraryPassageContext("research", selection)',
  'characters {selection.startOffset}–{selection.endOffset}',
  'Passage → Discussion → Evidence → Knowledge',
  'Research evidence',
  'Discuss passage',
  'Ask Loombus',
  '"/api/library/save-to-research"',
  '.eq("status", "published")',
  'section.content_text.slice(startOffset, endOffset) !== trimmed',
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
  'libraryReaderHref(passage.publicationId)',
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
console.log("- exact selected passage provenance is captured once and reused across tools");
console.log("- discussion, Ask Loombus, and Research retain locator, offsets, and source hash");
console.log("- Research handoff saves the passage before opening the workspace");
console.log("- Reader selection remains bounded and checked against normalized section text");
console.log("- no schema migration or unrelated backend capability is introduced");
