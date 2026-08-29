import fs from "node:fs";

const route = fs.readFileSync("src/app/requests/page.tsx", "utf8");
const directory = fs.readFileSync("src/components/requests-directory-page.tsx", "utf8");

function requireText(source, text, message) {
  if (!source.includes(text)) throw new Error(message);
}

function forbidText(source, text, message) {
  if (source.includes(text)) throw new Error(message);
}

requireText(route, "RequestsDirectoryPage", "Requests route must render the directory component.");
requireText(directory, 'data-requests-editorial="directory"', "Requests Editorial marker missing.");
requireText(directory, "var(--loombus-page-bg)", "Requests must preserve the Loombus page background.");
requireText(directory, "var(--loombus-gold)", "Requests must retain restrained Gold Editorial accents.");
requireText(directory, "border-b-2", "Requests type navigation must use underline active state.");
requireText(directory, '`/api/requests?${params.toString()}`', "Public Requests API contract missing.");

for (const contract of [
  'params.set("q"',
  'params.set("type"',
  'params.set("category"',
  'params.set("urgency"',
  'params.set("location"',
  'href="/requests/manage"',
  'href="/requests/saved"',
  'href="/requests/safety"',
  'href="/services"',
  'href="/rooms"',
]) {
  requireText(directory, contract, `Requests behavior or destination missing: ${contract}`);
}

for (const legacy of [
  "shadow-xl",
  "shadow-2xl",
  "shadow-lg",
  "xl:sticky",
  "xl:grid-cols-[minmax(0,1fr)_21rem]",
  "rounded-[1.75rem]",
  "radial-gradient",
]) {
  forbidText(directory, legacy, `Requests directory still contains legacy dashboard styling: ${legacy}`);
}

requireText(directory, 'className="group grid gap-4 border-b', "Requests records must remain divider-led.");
requireText(directory, "sm:grid-cols-3", "Request signals must remain responsive.");
requireText(directory, "lg:grid-cols-4", "Request filters must remain responsive.");

console.log("Requests directory Editorial UI verification passed.");
