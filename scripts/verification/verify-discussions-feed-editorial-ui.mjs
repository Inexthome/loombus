import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const page = read("src/app/discussions/page.tsx");
const layout = read("src/app/discussions/layout.tsx");
const css = read("src/app/discussions/discussions-feed-editorial.css");

function requireText(source, text, message) {
  if (!source.includes(text)) throw new Error(message);
}

function forbidText(source, text, message) {
  if (source.includes(text)) throw new Error(message);
}

// Existing behavior contracts remain authoritative.
requireText(page, '.from("discussions")', "Discussions query must remain present.");
requireText(page, '.from("questions_of_the_week")', "Question of the Week exclusion must remain present.");
requireText(page, '.from("user_blocks")', "Blocked-user filtering must remain present.");
requireText(page, '.from("follows")', "Following feed behavior must remain present.");
requireText(page, '.from("bookmarks")', "Saved discussion behavior must remain present.");
requireText(page, 'href={`/discussions/${discussion.id}`}', "Canonical discussion destinations must remain present.");
requireText(page, 'href="/create"', "Create-discussion destination must remain present.");
requireText(page, "DiscussionAttachmentGrid", "Discussion attachments must remain present.");

// The final Editorial layer must load after the legacy refinements.
requireText(layout, 'import "./discussions-feed-editorial.css";', "Discussions Editorial stylesheet must be loaded.");
const editorialImport = layout.indexOf('import "./discussions-feed-editorial.css";');
const legacyImport = layout.indexOf('import "./discussion-compact-media-square.css";');
if (editorialImport < legacyImport) {
  throw new Error("Discussions Editorial stylesheet must load after legacy discussion styles.");
}

// Editorial presentation contract.
requireText(css, "continuous editorial queue", "Editorial queue intent must remain documented.");
requireText(css, "border-radius: 0 !important", "Flat Editorial section treatment must remain present.");
requireText(css, "box-shadow: none !important", "Dashboard elevation must remain suppressed.");
requireText(css, "background: transparent !important", "Flat working surfaces must remain present.");
requireText(css, "#CBAB5B", "Canonical Loombus Gold must remain present.");
requireText(css, "focus-visible", "Visible keyboard focus must remain protected.");
requireText(css, "prefers-reduced-motion", "Reduced-motion handling must remain protected.");
requireText(css, 'aria-label="Discussion attachments"', "Attachment objects must remain intentionally scoped.");

// The new layer must not introduce decorative dashboard treatments.
forbidText(css, "radial-gradient", "Editorial layer must not add decorative radial gradients.");
forbidText(css, "shadow-2xl", "Editorial layer must not add large dashboard shadows.");
forbidText(css, "shadow-xl", "Editorial layer must not add dashboard shadows.");
forbidText(css, "#FEFBEC", "Discussions feed must keep the standard Loombus page background rather than force Cream.");

console.log("Discussions feed Editorial UI verification passed.");
