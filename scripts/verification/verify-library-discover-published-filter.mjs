import fs from "node:fs";

const path = "src/components/library/library-functional-surface.tsx";
if (!fs.existsSync(path)) throw new Error(`Missing required file: ${path}`);

const source = fs.readFileSync(path, "utf8");

for (const fragment of [
  'from("library_publications")',
  '.eq("status", "published")',
  'Published Library',
]) {
  if (!source.includes(fragment)) {
    throw new Error(`Missing published-discovery contract: ${fragment}`);
  }
}

if (source.includes('eq("status", "archived")')) {
  throw new Error("Public Library discovery must not query archived publications.");
}

console.log("Library published-discovery verification passed.");
