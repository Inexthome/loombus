import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const check = (value, message) => {
  if (!value) throw new Error(message);
};

const apiRoute = read("src/app/api/local/route.ts");
const discoveryPage = read("src/components/local-discovery-page.tsx");

check(
  apiRoute.includes("function normalizeLocalResult") &&
    apiRoute.includes("function normalizeLocalResponse"),
  "Local Discovery API is missing its runtime response normalizers."
);

check(
  apiRoute.includes("distanceMiles: finiteNumber(row.distanceMiles ?? row.distance_miles)") &&
    apiRoute.includes("sourceTable: requiredText(row.sourceTable ?? row.source_table)") === false,
  "Local Discovery result normalization must coerce distance values and support snake_case payloads."
);

check(
  apiRoute.includes("const sourceTable = requiredText(row.sourceTable ?? row.source_table)") &&
    apiRoute.includes("const entityType = requiredText(row.entityType ?? row.entity_type)"),
  "Local Discovery result normalization must normalize identity fields before rendering."
);

check(
  apiRoute.includes("normalizeLocalResponse(\n      await searchLocalDiscovery") &&
    apiRoute.includes("normalizeLocalResponse(await searchLocalDiscovery(input))"),
  "Both Local Discovery GET and POST search paths must normalize RPC responses."
);

check(
  apiRoute.includes("Array.isArray(raw.results) ? raw.results : []") &&
    apiRoute.includes("Math.max(1, Math.floor(finiteNumber(raw.pageSize ?? raw.page_size) ?? 24))"),
  "Local Discovery top-level response normalization is incomplete."
);

check(
  discoveryPage.includes("result.distanceMiles.toFixed(1)"),
  "Verifier should track the render path protected by Local API numeric normalization."
);

console.log("Local runtime load verification passed.");
