import fs from "node:fs";

const pagePath = "src/app/topics/page.tsx";
const clientPath = "src/app/topics/signal-directory-client.tsx";
const cardPath = "src/app/topics/signal-directory-card.tsx";
const detailPath = "src/app/topics/signal-directory-detail.tsx";
const dataPath = "src/app/topics/use-signal-directory-data.ts";
const cssPath = "src/app/topics/topics-editorial.css";

const page = fs.readFileSync(pagePath, "utf8");
const client = fs.readFileSync(clientPath, "utf8");
const card = fs.readFileSync(cardPath, "utf8");
const detail = fs.readFileSync(detailPath, "utf8");
const data = fs.readFileSync(dataPath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");

function requireText(text, value, message) {
  if (!text.includes(value)) throw new Error(message);
}

function forbid(text, pattern, message) {
  if (pattern.test(text)) throw new Error(message);
}

requireText(page, 'import "./topics-editorial.css"', "Topics must load its Editorial theme surface.");
requireText(page, "<SignalDirectoryClient />", "Topics route composition changed unexpectedly.");
requireText(client, "data-loombus-topics-editorial", "Topics must expose the Editorial route scope.");
requireText(client, "border-b border-[color:var(--loombus-border)]", "Topics must use divider-led Editorial structure.");
requireText(client, "border-b-2", "Topics dimensions must use text-led tabs with an active underline.");
requireText(client, "var(--loombus-gold)", "Topics must retain restrained Loombus Gold action signals.");
requireText(client, "motion-reduce:transition-none", "Topics must preserve reduced-motion behavior.");
requireText(client, 'window.history.replaceState(null, "", `/topics?${params.toString()}`)', "Topics URL-state behavior changed unexpectedly.");
requireText(client, "data.toggleTopicFollow(topic)", "Topics follow behavior was removed unexpectedly.");
requireText(card, "onFollow(item.value)", "Topic follow control changed unexpectedly.");
requireText(card, 'href={`/discussions/${item.latestDiscussion.id}`}', "Latest-discussion destination changed unexpectedly.");
requireText(detail, 'href={`/discussions/${discussion.id}`}', "Selected-topic discussion destination changed unexpectedly.");
requireText(data, 'fetch("/api/topic-follows"', "Topic-follow API contract changed unexpectedly.");
requireText(data, '.from("user_blocks")', "Blocked-user visibility filtering changed unexpectedly.");
requireText(data, '.is("deleted_at", null)', "Deleted discussion filtering changed unexpectedly.");
requireText(css, "#FEFBEC", "Topics Light/System Editorial surface must use Loombus Cream.");
requireText(css, "#CBAB5B", "Topics focus treatment must use canonical Loombus Gold.");

forbid(client, /rounded-\[2rem\]|rounded-3xl|shadow-sm/, "Topics still contains legacy dashboard containers.");
forbid(card, /rounded-\[1\.75rem\]|shadow-(?:sm|md|lg|xl|2xl)|hover:-translate-y/, "Topics entries still use legacy raised dashboard cards.");
forbid(detail, /rounded-\[2rem\]|shadow-(?:sm|md|lg|xl|2xl)/, "Topics selected detail still uses legacy raised panel styling.");

console.log("Topics Editorial UI verification passed.");
