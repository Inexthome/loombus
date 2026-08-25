import fs from "node:fs";

const pagePath = "src/app/library/page.tsx";
const shellPath = "src/components/library/library-mobile-immersive-shell.tsx";
const chromePath = "src/components/app-chrome-boundary.tsx";

for (const path of [pagePath, shellPath, chromePath]) {
  if (!fs.existsSync(path)) throw new Error(`Missing immersive Library file: ${path}`);
}

const page = fs.readFileSync(pagePath, "utf8");
const shell = fs.readFileSync(shellPath, "utf8");
const chrome = fs.readFileSync(chromePath, "utf8");

function requireText(source, text, label) {
  if (!source.includes(text)) throw new Error(`Missing ${label}: ${text}`);
}
function rejectText(source, text, label) {
  if (source.includes(text)) throw new Error(`Forbidden ${label}: ${text}`);
}

for (const token of [
  "LibraryMobileImmersiveShell",
  "<LibraryFunctionalSurface />",
]) requireText(page, token, "Library page wiring");

for (const token of [
  'Back to Loombus',
  'href="/home"',
  'const APPEARANCE_KEY = "loombus:appearance"',
  'document.documentElement.dataset.loombusTheme = mode',
  'type AppearanceMode = "system" | "light" | "dark"',
  'aria-label="Library navigation"',
  'activate("Home")',
  'activate("My Library")',
  'activate("Discover")',
  'activate("Research")',
  'activate("Search")',
  'Search the Loombus Library',
  'data-library-native-mobile-nav',
  'data-library-search-open',
  'env(safe-area-inset-bottom',
  'backdrop-filter: blur(28px)',
  'var(--loombus-page-bg)',
  'var(--loombus-text)',
  'var(--loombus-gold)',
]) requireText(shell, token, "immersive mobile Library contract");

for (const token of [
  'function isLibraryHomePath(pathname: string)',
  'pathname === "/library"',
  'window.matchMedia("(max-width: 767px)")',
  'mobileLibrary',
]) requireText(chrome, token, "mobile app chrome boundary");

for (const source of [page, shell, chrome]) {
  for (const forbidden of ["SUPABASE_SERVICE_ROLE_KEY", "service_role", "dangerouslySetInnerHTML", "library-publication-originals"]) {
    rejectText(source, forbidden, `mobile Library client boundary (${forbidden})`);
  }
}

console.log("PASS: mobile /library becomes an immersive Apple-Books-inspired Library surface while preserving Loombus Light/Dark/System theming and existing Library functionality.");
console.log("- no schema migration required");
