import fs from "node:fs";

const files = {
  page: fs.readFileSync("src/app/people/page.tsx", "utf8"),
  client: fs.readFileSync("src/app/people/people-editorial-client.tsx", "utf8"),
  requests: fs.readFileSync("src/app/people/people-follow-requests-panel.tsx", "utf8"),
};

function requireText(source, needle, label) {
  if (!source.includes(needle)) throw new Error(`Missing ${label}: ${needle}`);
}

function forbidText(source, needle, label) {
  if (source.includes(needle)) throw new Error(`Unexpected ${label}: ${needle}`);
}

requireText(files.page, 'PeopleEditorialClient', "Editorial client route");
forbidText(files.page, 'PeopleV2Client', "legacy People client route");
requireText(files.client, 'data-people-editorial="directory"', "Editorial directory scope");
requireText(files.client, 'bg-[var(--loombus-page-bg)]', "Loombus page background");
requireText(files.client, 'aria-label="People directory views"', "directory view tabs");
requireText(files.client, 'aria-label="People directory results"', "directory result list");
requireText(files.client, '/api/people/directory?', "directory API");
requireText(files.client, '/api/follows/toggle', "follow action");
requireText(files.client, '/api/messages/conversations', "mutual messaging action");
requireText(files.client, 'privateAccount', "private account handling");
requireText(files.client, 'adminVisibility', "admin visibility disclosure");
requireText(files.client, 'border-b-2 border-[var(--loombus-gold)]', "Gold editorial emphasis");
forbidText(files.client, 'shadow-sm', "card shadow");
forbidText(files.client, 'rounded-[2rem]', "dashboard hero card");
forbidText(files.client, 'sm:grid-cols-2 xl:grid-cols-3', "member card grid");
forbidText(files.client, '#FEFBEC', "forced Cream background");
forbidText(files.client, '#fefbec', "forced Cream background");

requireText(files.requests, '/api/follows/requests?scope=all', "follow request loading");
requireText(files.requests, 'action: "accept" | "decline"', "request decision actions");
requireText(files.requests, '/api/follows/toggle', "sent request cancellation");
requireText(files.requests, 'role="tablist"', "request tabs");
requireText(files.requests, 'divide-y divide-[var(--loombus-border)]', "request editorial rows");
forbidText(files.requests, 'rounded-[1.75rem]', "request panel card shell");
forbidText(files.requests, 'bg-[var(--loombus-surface)] p-4', "request card surface");

console.log("People Editorial UI verification passed.");
