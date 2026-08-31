import fs from "node:fs";

const checks = [
  ["src/app/library/layout.tsx", 'import "./library-original-background.css"'],
  ["src/app/messages/layout.tsx", 'import "./messages-original-background.css"'],
  ["src/app/u/[username]/page.tsx", 'import "./public-profile-original-background.css"'],
  ["src/app/the-floor/layout.tsx", 'import "./the-floor-original-background.css"'],
];

for (const [path, expected] of checks) {
  const text = fs.readFileSync(path, "utf8");
  if (!text.includes(expected)) {
    throw new Error(`${path} must load its original Loombus background override.`);
  }
}

const overrideFiles = [
  "src/app/library/library-original-background.css",
  "src/app/messages/messages-original-background.css",
  "src/app/u/[username]/public-profile-original-background.css",
  "src/app/the-floor/the-floor-original-background.css",
];

for (const path of overrideFiles) {
  const text = fs.readFileSync(path, "utf8");
  if (!text.includes("var(--loombus-page-bg)")) {
    throw new Error(`${path} must use the canonical Loombus page background token.`);
  }
  if (/#FEFBEC|--.*cream\s*:/.test(text)) {
    throw new Error(`${path} must not reintroduce a Cream page background.`);
  }
}

const library = fs.readFileSync("src/app/library/library-original-background.css", "utf8");
if (!library.includes("[data-library-editorial-home] > main")) {
  throw new Error("Library landing background override must remain route-scoped.");
}

const messages = fs.readFileSync("src/app/messages/messages-original-background.css", "utf8");
if (!messages.includes("--messages-editorial-page-bg: var(--loombus-page-bg)")) {
  throw new Error("Messages must keep its Editorial page variable mapped to the Loombus page background.");
}

const profile = fs.readFileSync("src/app/u/[username]/public-profile-original-background.css", "utf8");
if (!profile.includes(".public-profile-v2-page")) {
  throw new Error("Public profile background override must remain scoped to the profile page.");
}

const floor = fs.readFileSync("src/app/the-floor/the-floor-original-background.css", "utf8");
if (!floor.includes(".floor-terminal-shell")) {
  throw new Error("The Floor shell must remain mapped to the standard Loombus page background.");
}

console.log("Core surface background verification passed.");
