import fs from "node:fs";

const surfacePath = "src/components/library/library-functional-surface.tsx";
const discoverPath = "src/components/library/library-discover-catalog.tsx";
for (const path of [surfacePath, discoverPath]) {
  if (!fs.existsSync(path)) throw new Error(`Missing required file: ${path}`);
}

const surface = fs.readFileSync(surfacePath, "utf8");
const discover = fs.readFileSync(discoverPath, "utf8");

for (const fragment of [
  'from("library_publications")',
  '.eq("status", "published")',
]) {
  if (!surface.includes(fragment)) {
    throw new Error(`Missing private-Library published filter contract: ${fragment}`);
  }
}

for (const fragment of [
  'rpc("search_library_published_catalog"',
  'published Library catalog',
]) {
  if (!discover.includes(fragment)) {
    throw new Error(`Missing published-discovery contract: ${fragment}`);
  }
}

if (surface.includes('eq("status", "archived")') || discover.includes('eq("status", "archived")')) {
  throw new Error("Public Library discovery must not query archived publications.");
}

console.log("Library published-discovery verification passed.");
console.log("- private Library metadata remains published-only");
console.log("- Discover uses the published-catalog RPC");
