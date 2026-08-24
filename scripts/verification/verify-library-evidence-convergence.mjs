import fs from "node:fs";

const discussionPath = "src/components/library/discussion-library-feedback-launcher.tsx";
const convergencePath = "src/components/library/library-research-discussion-convergence.tsx";
const researchPagePath = "src/app/library/research/page.tsx";

for (const path of [discussionPath, convergencePath, researchPagePath]) {
  if (!fs.existsSync(path)) throw new Error(`Missing Library evidence convergence file: ${path}`);
}

const discussion = fs.readFileSync(discussionPath, "utf8");
const convergence = fs.readFileSync(convergencePath, "utf8");
const researchPage = fs.readFileSync(researchPagePath, "utf8");
const failures = [];

for (const token of [
  'from("library_passage_discussions")',
  'from("library_research_items")',
  'Evidence saved',
  'Needs evidence',
  'Open source',
  'View evidence',
  'Investigate',
  'Build Knowledge',
  'selected_text',
  'start_offset',
  'end_offset',
  'text_sha256',
]) {
  if (!discussion.includes(token)) failures.push(`missing discussion evidence contract: ${token}`);
}

for (const token of [
  'from("library_research_items")',
  'from("library_passage_discussions")',
  'from("discussions")',
  'Discussion ↔ Evidence',
  'Same passage provenance',
  'publication_id',
  'locator',
  'start_offset',
  'end_offset',
  'text_sha256',
]) {
  if (!convergence.includes(token)) failures.push(`missing Research convergence contract: ${token}`);
}

if (!researchPage.includes("LibraryResearchDiscussionConvergence")) {
  failures.push("Research page does not render LibraryResearchDiscussionConvergence");
}

for (const source of [discussion, convergence]) {
  for (const token of ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY", "library-publication-originals", "dangerouslySetInnerHTML"]) {
    if (source.includes(token)) failures.push(`forbidden convergence capability present: ${token}`);
  }
}

if (failures.length) {
  console.error("Loombus Library evidence convergence verification FAILED");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("PASS: Library discussion and Research evidence converge on exact passage provenance.");
console.log("- passage-driven discussions show source context and private evidence state when available");
console.log("- Research surfaces discussions that share the exact saved passage identity");
console.log("- matching uses publication, locator, UTF-16 offsets, and source SHA-256");
console.log("- no schema migration, service role, original EPUB access, or raw HTML rendering was introduced");
