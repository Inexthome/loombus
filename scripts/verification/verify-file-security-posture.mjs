import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const posturePath = "src/lib/file-security-posture.ts";
const safetyPath = "src/app/safety/page.tsx";
const inventoryPath = "docs/security/file-upload-security-posture.md";
const reportPath = path.join(root, ".file-security-upload-inventory.txt");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function fail(message) {
  console.error(`file-security posture verification failed: ${message}`);
  process.exitCode = 1;
}

const posture = read(posturePath);
const safety = read(safetyPath);
const inventory = read(inventoryPath);

if (!/malwareScanning:\s*["']not_enforced["']/.test(posture)) {
  fail("shared posture must explicitly remain malwareScanning=not_enforced until an enforced scanner is implemented");
}
if (!/quarantine:\s*["']not_active["']/.test(posture)) {
  fail("shared posture must explicitly remain quarantine=not_active until a real quarantine workflow exists");
}
if (!safety.includes("FILE_SECURITY_POSTURE.disclosure")) {
  fail("public Safety file disclosure must come from the shared posture");
}
if (!inventory.includes("does not currently enforce malware scanning on all uploaded files")) {
  fail("the audit document must state the production malware-scanning limitation plainly");
}
if (!inventory.includes("Supabase Storage access control is not an antivirus service")) {
  fail("the audit must distinguish Storage authorization from malware scanning");
}

const forbiddenClaims = [
  /Loombus scans (?:all )?uploads for malware/i,
  /Loombus virus[- ]scans/i,
  /uploads are malware[- ]scanned/i,
  /files are malware[- ]free/i,
];
for (const expression of forbiddenClaims) {
  if (expression.test(safety)) {
    fail(`public Safety copy contains unsupported scanner claim: ${expression}`);
  }
}

const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const ignoredDirectories = new Set(["node_modules", ".next", ".git", "dist", "build", "coverage"]);
const uploadSignals = [
  /\.upload\s*\(/,
  /\.uploadToSignedUrl\s*\(/,
  /\.createSignedUploadUrl\s*\(/,
  /new\s+FormData\s*\(/,
  /type\s*=\s*["']file["']/,
];

const discovered = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(absolute);
      continue;
    }
    if (!sourceExtensions.has(path.extname(entry.name))) continue;
    const content = fs.readFileSync(absolute, "utf8");
    if (!uploadSignals.some((signal) => signal.test(content))) continue;
    discovered.push(path.relative(root, absolute).split(path.sep).join("/"));
  }
}

walk(path.join(root, "src"));
discovered.sort();

const undocumented = discovered.filter((relativePath) => !inventory.includes(`\`${relativePath}\``));
fs.writeFileSync(
  reportPath,
  [
    `Discovered upload-capable source files: ${discovered.length}`,
    ...discovered.map((item) => `- ${item}`),
    "",
    `Undocumented source files: ${undocumented.length}`,
    ...undocumented.map((item) => `- ${item}`),
    "",
  ].join("\n")
);

if (undocumented.length > 0) {
  fail(
    "upload-capable source files are missing from the deterministic inventory:\n" +
      undocumented.map((item) => `  - ${item}`).join("\n")
  );
}

console.log("File security posture verified.");
console.log(`Documented upload-capable source files: ${discovered.length}`);
for (const relativePath of discovered) console.log(`- ${relativePath}`);
