import fs from "node:fs";

const reviewPath = "src/components/marketplace-admin-review.tsx";
const managerPath = "src/components/marketplace-manager-page.tsx";

const review = fs.readFileSync(reviewPath, "utf8");
const manager = fs.readFileSync(managerPath, "utf8");

function requireText(text, value, message) {
  if (!text.includes(value)) throw new Error(message);
}

function forbid(text, pattern, message) {
  if (pattern.test(text)) throw new Error(message);
}

requireText(review, "data-marketplace-moderation-editorial", "Marketplace moderation must expose its Editorial scope.");
requireText(review, "border-y border-[var(--loombus-border-muted)]", "Marketplace moderation summary must use divider-led Editorial structure.");
requireText(review, "divide-y divide-[var(--loombus-border-muted)]", "Marketplace moderation queues must use continuous divider-led rows.");
requireText(review, "motion-reduce:transition-none", "Marketplace moderation must preserve reduced-motion behavior.");
requireText(review, 'moderate(listing.id, "approve")', "Marketplace approve behavior changed unexpectedly.");
requireText(review, 'moderate(listing.id, "reject")', "Marketplace request-changes behavior changed unexpectedly.");
requireText(review, 'moderate(listing.id, "suspend")', "Marketplace suspend behavior changed unexpectedly.");
requireText(review, 'moderate(listing.id, "remove")', "Marketplace remove behavior changed unexpectedly.");
requireText(review, 'reviewReport(report, "resolve")', "Marketplace report resolution behavior changed unexpectedly.");
requireText(review, 'reviewReport(report, "dismiss")', "Marketplace report dismissal behavior changed unexpectedly.");
requireText(review, 'href={`/marketplace/${listing.slug}`}', "Marketplace public-record destination changed unexpectedly.");
requireText(review, "moderationNotes[listing.id]", "Marketplace moderation notes were removed unexpectedly.");
requireText(review, "reportNotes[report.id]", "Marketplace report notes were removed unexpectedly.");
requireText(manager, 'action: "moderate"', "Marketplace moderation API contract changed unexpectedly.");
requireText(manager, 'action: "review_report"', "Marketplace report-review API contract changed unexpectedly.");
requireText(manager, 'label: "Moderation"', "Marketplace moderation tab changed unexpectedly.");

forbid(review, /AdminMetricCard|AdminQueueSection/, "Marketplace moderation must not use dashboard metric/queue card primitives.");
forbid(review, /rounded-\[1\.55rem\]|shadow-(?:sm|md|lg|xl|2xl)/, "Marketplace moderation still contains legacy raised dashboard cards.");
forbid(review, /bg-\[var\(--loombus-page-bg\)\] p-7 text-center/, "Marketplace moderation empty states should remain flat in the editorial flow.");

console.log("Marketplace moderation Editorial UI verification passed.");
