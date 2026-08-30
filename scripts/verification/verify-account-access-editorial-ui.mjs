import fs from "node:fs";

const page = fs.readFileSync("src/app/account-access/page.tsx", "utf8");

function requireText(source, needle, label) {
  if (!source.includes(needle)) throw new Error(`Missing ${label}: ${needle}`);
}

function forbidText(source, needle, label) {
  if (source.includes(needle)) throw new Error(`Forbidden ${label}: ${needle}`);
}

for (const [needle, label] of [
  ['STATUS_COPY', "account-access status copy"],
  ['searchParams.get("status")', "status query handling"],
  ['!["deletion_requested", "profile_unavailable"].includes(status)', "decision-history visibility rule"],
  ['href="/account/enforcement"', "decision-history route"],
  ['href="/support"', "support route"],
  ['href="/"', "return route"],
  ['data-loombus-account-access', "account-access route marker"],
  ['bg-[color:var(--loombus-page-bg)]', "Loombus Editorial page background"],
  ['border-b border-[color:var(--loombus-border)]', "divider-led structure"],
  ['text-[color:var(--loombus-gold)]', "restrained Gold treatment"],
  ['min-h-11', "accessible control target"],
  ['lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]', "responsive Editorial layout"],
]) requireText(page, needle, label);

for (const forbidden of [
  "bg-black",
  "bg-zinc-950",
  "rounded-3xl",
  "rounded-2xl",
  "rounded-full",
  "shadow-2xl",
  "linear-gradient",
  "radial-gradient",
]) forbidText(page, forbidden, "legacy card/pill/shadow treatment");

console.log("Account Access Editorial UI verification passed.");
