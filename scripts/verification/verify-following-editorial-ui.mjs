import fs from "node:fs";

const clientPath = "src/app/following/following-v2-client-page.js";
const cssPath = "src/app/following/following-v2-shell.css";
const client = fs.readFileSync(clientPath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");

function requireText(text, value, message) {
  if (!text.includes(value)) throw new Error(message);
}

function forbid(text, pattern, message) {
  if (pattern.test(text)) throw new Error(message);
}

requireText(css, "background: var(--loombus-page-bg);", "Following must use the Editorial page background.");
requireText(css, "border-bottom: 1px solid var(--loombus-border);", "Following must use divider-led Editorial structure.");
requireText(css, "min-height: 44px;", "Following must preserve accessible control targets.");
requireText(css, ":focus-visible", "Following must preserve keyboard focus treatment.");
requireText(css, "@media (prefers-reduced-motion: reduce)", "Following must preserve reduced-motion accessibility.");
requireText(client, 'f.from("user_blocks")', "Following block/privacy filtering changed unexpectedly.");
requireText(client, 'f.from("follows")', "Following relationship query changed unexpectedly.");
requireText(client, 'f.from("discussions")', "Following discussion query changed unexpectedly.");
requireText(client, '.is("deleted_at",null)', "Following deleted-content exclusion changed unexpectedly.");
requireText(client, 'href:"/people"', "Following People destination changed unexpectedly.");
requireText(client, 'href:"/discussions"', "Following Discussions destination changed unexpectedly.");
requireText(client, 'href:"/premium"', "Following Premium destination changed unexpectedly.");

forbid(css, /border-radius:\s*999px/, "Following still contains legacy pill controls.");
forbid(css, /box-shadow\s*:/, "Following still contains decorative card shadows.");
forbid(css, /border-radius:\s*1\.4rem/, "Following still contains legacy rounded card chrome.");
forbid(css, /transform:\s*translateY/, "Following still uses decorative card lift interactions.");

console.log("Following Editorial UI verification passed.");
