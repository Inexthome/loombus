import fs from "node:fs";

const page = fs.readFileSync("src/app/age-gate/page.tsx", "utf8");

function requireText(source, needle, label) {
  if (!source.includes(needle)) throw new Error(`Missing ${label}: ${needle}`);
}

function forbidText(source, needle, label) {
  if (source.includes(needle)) throw new Error(`Forbidden ${label}: ${needle}`);
}

for (const [needle, label] of [
  ['window.location.replace("/login")', "age-gate auth redirect"],
  ['fetch("/api/profile/age-gate"', "age-gate submission contract"],
  ['getAgeBandFromDateOfBirth(dateOfBirth)', "client age-band eligibility check"],
  ['ageBand === "under_13"', "under-13 eligibility protection"],
  ['await signOutCurrentDevice()', "ineligible-account sign-out"],
  ['dateOfBirth,', "age-gate payload"],
  ['window.location.replace(next)', "safe post-verification navigation"],
  ['<DateOfBirthSelect', "date-of-birth control"],
  ['data-loombus-age-gate', "Age Gate route marker"],
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

console.log("Age Gate Editorial UI verification passed.");
