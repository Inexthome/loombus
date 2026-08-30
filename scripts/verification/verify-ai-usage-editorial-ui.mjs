import fs from "node:fs";

const cssPath = "src/app/ai-usage/ai-usage-v2.css";
const pagePath = "src/app/ai-usage/page.tsx";
const css = fs.readFileSync(cssPath, "utf8");
const page = fs.readFileSync(pagePath, "utf8");

function requireText(text, value, message) {
  if (!text.includes(value)) throw new Error(message);
}

function forbid(text, pattern, message) {
  if (pattern.test(text)) throw new Error(message);
}

requireText(css, "background: var(--loombus-page-bg);", "AI Usage must use the Editorial page background.");
requireText(css, "border-bottom: 1px solid var(--loombus-border);", "AI Usage must use divider-led Editorial structure.");
requireText(css, "border-bottom-width: 2px;", "AI Usage primary actions must use a restrained Editorial Gold signal.");
requireText(css, "@media (prefers-reduced-motion: reduce)", "AI Usage must preserve reduced-motion accessibility.");
requireText(page, 'window.location.replace("/login?next=%2Fai-usage")', "AI Usage authentication redirect changed unexpectedly.");
requireText(page, 'fetch("/api/ai/usage"', "AI Usage API contract changed unexpectedly.");

forbid(css, /radial-gradient/i, "AI Usage still contains decorative radial treatment.");
forbid(css, /box-shadow\s*:/i, "AI Usage still contains decorative card shadows.");
forbid(css, /border-radius:\s*(?:999px|2rem|1\.65rem|1\.55rem|1\.35rem)/i, "AI Usage still contains legacy pill or large-card radii.");

console.log("AI Usage Editorial UI verification passed.");
