import { readFile } from "node:fs/promises";

const AUDIT_URL = "https://registry.npmjs.org/-/npm/v1/security/advisories/bulk";
const MAX_ATTEMPTS = 4;
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const BLOCKING_SEVERITIES = new Set(["high", "critical"]);

function packageNameFromPath(path) {
  const marker = "node_modules/";
  const index = path.lastIndexOf(marker);
  if (index < 0) return null;

  const remainder = path.slice(index + marker.length);
  if (!remainder) return null;

  if (remainder.startsWith("@")) {
    const [scope, name] = remainder.split("/");
    return scope && name ? `${scope}/${name}` : null;
  }

  return remainder.split("/")[0] || null;
}

function buildProductionVersionMap(lockfile) {
  const packages = lockfile?.packages;
  if (!packages || typeof packages !== "object") {
    throw new Error("package-lock.json does not contain a packages map.");
  }

  const versionsByPackage = new Map();

  for (const [path, metadata] of Object.entries(packages)) {
    if (!path || !path.includes("node_modules/")) continue;
    if (!metadata || typeof metadata !== "object") continue;
    if (metadata.dev === true) continue;
    if (typeof metadata.version !== "string" || metadata.version.length === 0) continue;

    const name = packageNameFromPath(path);
    if (!name) continue;

    const versions = versionsByPackage.get(name) ?? new Set();
    versions.add(metadata.version);
    versionsByPackage.set(name, versions);
  }

  return Object.fromEntries(
    [...versionsByPackage.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, versions]) => [name, [...versions].sort()])
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchAdvisories(payload) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);

    try {
      const response = await fetch(AUDIT_URL, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "user-agent": "loombus-ci-bulk-audit/1.0",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const text = await response.text();

      if (response.ok) {
        try {
          return text ? JSON.parse(text) : {};
        } catch (error) {
          throw new Error(`npm bulk audit returned invalid JSON: ${error.message}`);
        }
      }

      const error = new Error(
        `npm bulk audit returned HTTP ${response.status}${text ? `: ${text.slice(0, 400)}` : ""}`
      );

      if (!RETRYABLE_STATUS.has(response.status) || attempt === MAX_ATTEMPTS) {
        throw error;
      }

      lastError = error;
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error));
      lastError = normalized;

      if (attempt === MAX_ATTEMPTS) {
        throw normalized;
      }
    } finally {
      clearTimeout(timeout);
    }

    await sleep(2_000 * attempt);
  }

  throw lastError ?? new Error("npm bulk audit failed without a response.");
}

function normalizeAdvisories(response) {
  if (!response || typeof response !== "object" || Array.isArray(response)) return [];

  const advisories = [];
  for (const [id, advisory] of Object.entries(response)) {
    if (!advisory || typeof advisory !== "object") continue;
    advisories.push({ id, ...advisory });
  }
  return advisories;
}

const lockfile = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url), "utf8"));
const payload = buildProductionVersionMap(lockfile);
const packageCount = Object.keys(payload).length;

if (packageCount === 0) {
  throw new Error("No production dependencies were found in package-lock.json.");
}

console.log(`Auditing ${packageCount} production package names through npm bulk advisories.`);

const response = await fetchAdvisories(payload);
const advisories = normalizeAdvisories(response);
const blocking = advisories.filter((advisory) =>
  BLOCKING_SEVERITIES.has(String(advisory.severity ?? "").toLowerCase())
);

if (blocking.length > 0) {
  console.error(`Found ${blocking.length} high/critical production advisories:`);
  for (const advisory of blocking) {
    const packageName = advisory.name ?? advisory.module_name ?? "unknown-package";
    const title = advisory.title ?? advisory.overview ?? "security advisory";
    const severity = String(advisory.severity ?? "unknown").toUpperCase();
    const url = advisory.url ?? advisory.advisory ?? "";
    console.error(`- [${severity}] ${packageName}: ${title}${url ? ` (${url})` : ""}`);
  }
  process.exit(1);
}

console.log(
  advisories.length === 0
    ? "No npm production advisories were returned."
    : `No high/critical production advisories found (${advisories.length} lower-severity advisories returned).`
);
