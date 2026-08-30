import fs from "node:fs";

const client = fs.readFileSync("src/app/account/age-safety/age-safety-client.tsx", "utf8");

function requireText(source, needle, label) {
  if (!source.includes(needle)) throw new Error(`Missing ${label}: ${needle}`);
}

function forbidText(source, needle, label) {
  if (source.includes(needle)) throw new Error(`Forbidden ${label}: ${needle}`);
}

for (const [needle, label] of [
  ['window.location.replace("/login?next=%2Faccount%2Fage-safety")', "age-safety auth redirect"],
  ['fetch("/api/profile/age-safety"', "age-safety read contract"],
  ['fetch("/api/profile/age-correction"', "age-correction submission contract"],
  ['body: JSON.stringify({ requestedDateOfBirth, reason: correctionReason })', "age-correction payload"],
  ['fetch("/api/safety/underage-report"', "underage-report submission contract"],
  ['reportedUserId,', "underage-report member id payload"],
  ['reason: underageReason,', "underage-report reason payload"],
  ['context: underageContext,', "underage-report context payload"],
  ['<DateOfBirthSelect', "date-of-birth correction control"],
  ['data-loombus-age-safety', "Age Safety route marker"],
  ['bg-[color:var(--loombus-page-bg)]', "Loombus Editorial page background"],
  ['border-b border-[color:var(--loombus-border)]', "divider-led structure"],
  ['text-[color:var(--loombus-gold)]', "restrained Gold treatment"],
  ['min-h-11', "accessible control target"],
  ['lg:grid-cols-[minmax(0,1.6fr)_minmax(18rem,0.8fr)]', "responsive Editorial layout"],
]) requireText(client, needle, label);

for (const forbidden of [
  "rounded-3xl",
  "rounded-2xl",
  "rounded-full",
  "shadow-sm",
  "shadow-xl",
  "linear-gradient",
  "radial-gradient",
]) forbidText(client, forbidden, "legacy card/pill/shadow treatment");

console.log("Age Safety Editorial UI verification passed.");
