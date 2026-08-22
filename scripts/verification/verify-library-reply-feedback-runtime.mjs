import fs from "node:fs";

const files = {
  route: "src/app/api/library/reply-feedback/create/route.ts",
  surface: "src/components/library/library-reply-feedback-surface.tsx",
  page: "src/app/library/research/from-reply/page.tsx",
  launcher: "src/components/library/discussion-library-feedback-launcher.tsx",
};

for (const path of Object.values(files)) {
  if (!fs.existsSync(path)) throw new Error(`Missing ${path}`);
}

const route = fs.readFileSync(files.route, "utf8");
const surface = fs.readFileSync(files.surface, "utf8");
const page = fs.readFileSync(files.page, "utf8");
const launcher = fs.readFileSync(files.launcher, "utf8");

const requireAll = (source, values, label) => {
  for (const value of values) {
    if (!source.includes(value)) throw new Error(`${label} missing: ${value}`);
  }
};

requireAll(route, [
  'from("replies")',
  '.eq("discussion_id", discussionId)',
  '.is("deleted_at", null)',
  'sha256(canonicalBody)',
  'canonicalBody.slice(startOffset, endOffset) !== selectedText',
  'from("library_research_claims")',
  'from("library_knowledge_objects")',
  'from("library_reply_claim_derivations")',
  'from("library_reply_knowledge_derivations")',
  'reply_author_id: replyAuthorId',
  'reply_body_sha256: canonicalHash',
], "route");

requireAll(surface, [
  'from("replies")',
  '.eq("discussion_id", discussionId)',
  '.is("deleted_at", null)',
  'selectionStart',
  'selectionEnd',
  'replyBodySha256: replyHash',
  '/api/library/reply-feedback/create',
  'Reply → Knowledge',
  'Save private {mode}',
], "surface");

requireAll(page, ["LibraryReplyFeedbackSurface", "Suspense"], "page");
requireAll(launcher, ["/library/research/from-reply?discussionId=", "From Reply"], "launcher");

for (const forbidden of ["SUPABASE_SERVICE_ROLE", "library-publication-originals", "library_publication_sources", "dangerouslySetInnerHTML", "openai", "OpenAI"]) {
  if (route.includes(forbidden) || surface.includes(forbidden)) {
    throw new Error(`Forbidden reply feedback runtime dependency: ${forbidden}`);
  }
}

console.log("Library reply feedback runtime verification passed.");
