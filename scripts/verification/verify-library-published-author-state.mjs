import fs from "node:fs";

const pagePath = "src/app/library/publish/page.tsx";
if (!fs.existsSync(pagePath)) throw new Error(`Missing required file: ${pagePath}`);

const page = fs.readFileSync(pagePath, "utf8");

for (const fragment of [
  'row.publication.status === "published" ? "published"',
  'Published to Library',
  'This publication is published in the Loombus Library and is locked from author-side draft editing.',
]) {
  if (!page.includes(fragment)) throw new Error(`Missing published author state behavior: ${fragment}`);
}

if (page.includes("dangerouslySetInnerHTML")) {
  throw new Error("Author publishing page must not use dangerouslySetInnerHTML.");
}

console.log("Library published author state verification passed.");
