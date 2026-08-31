import fs from "node:fs";

const directoryPath = "src/components/services-directory-page.tsx";
const savedPath = "src/components/services-saved-page.tsx";
const directoryPagePath = "src/app/services/page.tsx";
const savedPagePath = "src/app/services/saved/page.tsx";
const cssPath = "src/app/services/services-editorial.css";

const directory = fs.readFileSync(directoryPath, "utf8");
const saved = fs.readFileSync(savedPath, "utf8");
const directoryPage = fs.readFileSync(directoryPagePath, "utf8");
const savedPage = fs.readFileSync(savedPagePath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");

function requireText(text, value, message) {
  if (!text.includes(value)) throw new Error(message);
}

function forbid(text, pattern, message) {
  if (pattern.test(text)) throw new Error(message);
}

for (const [name, source] of [["directory", directory], ["saved", saved]]) {
  requireText(source, "border-b border-[color:var(--loombus-border)]", `${name} must use divider-led Editorial structure.`);
  requireText(source, "border-b-2", `${name} must use compact Editorial tab indicators.`);
  requireText(source, "motion-reduce:transition-none", `${name} must preserve reduced-motion behavior.`);
  forbid(source, /rounded-\[1\.(?:4|75)rem\]/, `${name} still contains legacy large rounded cards.`);
  forbid(source, /shadow-(?:sm|lg|xl|2xl)/, `${name} still contains decorative shadows.`);
}

requireText(directory, 'fetch(`/api/services?${params.toString()}`', "Services directory API contract changed unexpectedly.");
requireText(directory, 'href="/services/saved"', "Saved Services destination changed unexpectedly.");
requireText(directory, 'href="/services/manage"', "Service management destination changed unexpectedly.");
requireText(directory, 'href={`/services/${service.slug}`}', "Service detail destination changed unexpectedly.");
requireText(directory, 'setCategory("all")', "Service clear-filter behavior changed unexpectedly.");
requireText(directory, 'setMode("all")', "Service location-mode clear behavior changed unexpectedly.");

requireText(saved, 'providerServicesAuthorizedFetch("/api/services?saved=1"', "Saved Services loading contract changed unexpectedly.");
requireText(saved, 'action: "unsave"', "Saved Services removal contract changed unexpectedly.");
requireText(saved, 'setServices((current) => current.filter((service) => service.id !== serviceId))', "Saved Services local removal behavior changed unexpectedly.");
requireText(saved, 'href={`/services/${service.slug}`}', "Saved Service detail destination changed unexpectedly.");
requireText(saved, 'view === "available"', "Saved Services availability filter changed unexpectedly.");
requireText(saved, 'view === "unavailable"', "Saved Services unavailable filter changed unexpectedly.");

requireText(directoryPage, 'import "./services-editorial.css";', "Services route must load the Editorial theme layer.");
requireText(savedPage, 'import "../services-editorial.css";', "Saved Services route must load the Editorial theme layer.");
requireText(css, "#fefbec", "Services Editorial Light/System surface must use canonical Loombus Cream.");
requireText(css, 'html[data-loombus-theme="system"]', "Services Editorial styling must support System appearance.");

console.log("Services Editorial UI verification passed.");
