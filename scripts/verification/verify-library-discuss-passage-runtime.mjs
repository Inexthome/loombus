import fs from "node:fs";

const files = {
  readerPage: "src/app/library/read/[publicationId]/page.tsx",
  launcher: "src/components/library/library-discuss-passage-launcher.tsx",
  passageContext: "src/lib/library/passage-context.ts",
  composer: "src/components/library/library-discuss-passage-composer.tsx",
  api: "src/app/api/library/discuss-passage/create/route.ts",
};

for (const path of Object.values(files)) {
  if (!fs.existsSync(path)) throw new Error(`Missing Discuss Passage runtime file: ${path}`);
}

const readerPage = fs.readFileSync(files.readerPage, "utf8");
const launcher = fs.readFileSync(files.launcher, "utf8");
const passageContext = fs.readFileSync(files.passageContext, "utf8");
const composer = fs.readFileSync(files.composer, "utf8");
const api = fs.readFileSync(files.api, "utf8");

for (const contract of ["LibraryDiscussPassageLauncher", "publicationId={publicationId}"]) {
  if (!readerPage.includes(contract)) throw new Error(`Reader Discuss Passage contract missing: ${contract}`);
}

for (const contract of [
  'const MAX_PASSAGE_CHARS = 1200',
  'section.content_text.slice(startOffset, endOffset) !== trimmed',
  'sha256Text(section.content_text)',
  'writeLibraryPassageContext(destination, selection)',
  'openTool("discuss", "/library/discuss-passage")',
  "Discuss passage",
]) {
  if (!launcher.includes(contract)) throw new Error(`Launcher contract missing: ${contract}`);
}

for (const contract of [
  'discuss: "loombus:library:discuss-passage:v1"',
  'window.sessionStorage.setItem(LIBRARY_PASSAGE_CONTEXT_KEYS[destination], JSON.stringify(passage))',
]) {
  if (!passageContext.includes(contract)) throw new Error(`Shared passage context missing: ${contract}`);
}

for (const contract of [
  'fetch("/api/library/discuss-passage/create"',
  'Authorization: `Bearer ${session.access_token}`',
  'window.sessionStorage.removeItem(PASSAGE_STORAGE_KEY)',
  'window.location.href = `/discussions/${discussionId}`',
]) {
  if (!composer.includes(contract)) throw new Error(`Composer contract missing: ${contract}`);
}

for (const contract of [
  'createHash("sha256")',
  '.from("library_publication_sections")',
  'sectionText.slice(startOffset, endOffset) !== selectedText',
  'canonicalHash !== textSha256',
  'new URL("/api/discussions/create", request.url)',
  '.from("library_passage_discussions")',
  'discussion_id: discussionId',
  'publication_id: publicationId',
  'text_sha256: canonicalHash',
]) {
  if (!api.includes(contract)) throw new Error(`API contract missing: ${contract}`);
}

const forbidden = ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY", "library-publication-originals", "storage.from", "dangerouslySetInnerHTML"];
for (const token of forbidden) {
  if (launcher.includes(token) || composer.includes(token) || api.includes(token)) throw new Error(`Forbidden Discuss Passage runtime token found: ${token}`);
}

console.log("PASS: Library Discuss Passage runtime contracts verified with shared passage context.");
