import fs from "node:fs";

const paths = {
  page: "src/app/people/page.tsx",
  client: "src/app/people/people-editorial-client.tsx",
  styles: "src/app/people/people-editorial.css",
  requests: "src/app/people/people-follow-requests-panel.tsx",
};

const legacyPaths = [
  "src/app/people/client-page.tsx",
  "src/app/people/people-v2-client.tsx",
  "src/app/people/people-card-identity-cleanup.css",
  "src/app/people/people-directory-grid.css",
];

const files = Object.fromEntries(
  Object.entries(paths).map(([key, path]) => [key, fs.readFileSync(path, "utf8")])
);

function requireText(source, needle, label) {
  if (!source.includes(needle)) throw new Error(`Missing ${label}: ${needle}`);
}

function forbidText(source, needle, label) {
  if (source.includes(needle)) throw new Error(`Unexpected ${label}: ${needle}`);
}

for (const legacyPath of legacyPaths) {
  if (fs.existsSync(legacyPath)) throw new Error(`Legacy People implementation still exists: ${legacyPath}`);
}

requireText(files.page, 'PeopleEditorialClient', "Editorial client route");
requireText(files.page, './people-editorial.css', "consolidated People Editorial styles");
forbidText(files.page, 'PeopleV2Client', "legacy People client route");
forbidText(files.page, 'people-directory-grid.css', "retired grid override import");

requireText(files.client, 'data-people-editorial="directory"', "Editorial directory scope");
requireText(files.client, 'bg-[var(--loombus-page-bg)]', "Loombus page background");
requireText(files.client, 'aria-label="People directory views"', "directory view tabs");
requireText(files.client, 'aria-label="People directory results"', "directory result list");
requireText(files.client, 'role="table"', "People grid semantic source");
requireText(files.client, 'aria-label="People directory table"', "People grid accessibility label");
requireText(files.client, '/api/people/directory?', "directory API");
requireText(files.client, '/api/follows/toggle', "follow action");
requireText(files.client, '/api/messages/conversations', "mutual messaging action");
requireText(files.client, 'privateAccount', "private account handling");
requireText(files.client, 'adminVisibility', "admin visibility disclosure");
requireText(files.client, 'border-b-2 border-[var(--loombus-gold)]', "Gold editorial emphasis");
forbidText(files.client, 'member.bio?.trim() || (member.privateAccount', "bio rendered in member listing");
forbidText(files.client, 'shadow-sm', "card shadow");
forbidText(files.client, 'rounded-[2rem]', "dashboard hero card");
forbidText(files.client, 'sm:grid-cols-2 xl:grid-cols-3', "legacy member card grid");
forbidText(files.client, '#FEFBEC', "forced Cream background");
forbidText(files.client, '#fefbec', "forced Cream background");

requireText(files.styles, 'grid-template-columns: repeat(3, minmax(0, 1fr))', "three-across desktop People layout");
requireText(files.styles, '@media (max-width: 959px)', "tablet People breakpoint");
requireText(files.styles, 'grid-template-columns: repeat(2, minmax(0, 1fr))', "two-across tablet People layout");
requireText(files.styles, '@media (max-width: 639px)', "mobile People breakpoint");
requireText(files.styles, 'grid-template-columns: minmax(0, 1fr)', "single-column mobile People layout");
requireText(files.styles, 'min-width: 0', "mobile-safe People width reset");
requireText(files.styles, 'overflow-x: visible', "no forced horizontal People scrolling");

requireText(files.requests, '/api/follows/requests?scope=all', "follow request loading");
requireText(files.requests, 'action: "accept" | "decline"', "request decision actions");
requireText(files.requests, '/api/follows/toggle', "sent request cancellation");
requireText(files.requests, 'role="tablist"', "request tabs");
requireText(files.requests, 'divide-y divide-[var(--loombus-border)]', "request editorial rows");
forbidText(files.requests, 'rounded-[1.75rem]', "request panel card shell");
forbidText(files.requests, 'bg-[var(--loombus-surface)] p-4', "request card surface");

console.log("People Editorial UI verification passed.");
