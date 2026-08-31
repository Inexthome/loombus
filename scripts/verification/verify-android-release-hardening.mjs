#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const buildGradlePath = path.join(root, "android/app/build.gradle");
const variablesPath = path.join(root, "android/variables.gradle");
const androidSourcePath = path.join(root, "android/app/src");

const buildGradle = fs.readFileSync(buildGradlePath, "utf8");
const variables = fs.readFileSync(variablesPath, "utf8");

const failures = [];

if (!/minifyEnabled\s+true/.test(buildGradle)) {
  failures.push("Android release build must enable R8 minification.");
}

if (!/shrinkResources\s+true/.test(buildGradle)) {
  failures.push("Android release build must enable resource shrinking.");
}

if (!/androidxMaterialVersion\s*=\s*['"]1\.14\.0['"]/.test(variables)) {
  failures.push("Android Material must remain pinned to 1.14.0.");
}

const deprecatedWindowApis = [
  "setStatusBarColor",
  "setNavigationBarColor",
  "getStatusBarColor",
  "getNavigationBarColor",
];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      return walk(full);
    }

    return [full];
  });
}

const sourceFiles = walk(androidSourcePath).filter((file) =>
  /\.(java|kt)$/.test(file),
);

for (const file of sourceFiles) {
  const source = fs.readFileSync(file, "utf8");

  for (const api of deprecatedWindowApis) {
    if (source.includes(api)) {
      failures.push(
        `Repository Android source uses deprecated Window API ${api}: ${path.relative(root, file)}`,
      );
    }
  }
}

if (failures.length) {
  console.error("Android release hardening verification failed:\n");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Android release hardening verification passed.");
console.log("- R8 minification enabled");
console.log("- Resource shrinking enabled");
console.log("- Material 1.14.0 pinned");
console.log("- No deprecated system-bar Window APIs in Loombus Android source");
