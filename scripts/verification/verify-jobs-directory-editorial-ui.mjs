import fs from "node:fs";

const path = "src/components/jobs-directory-page.tsx";
const source = fs.readFileSync(path, "utf8");

const required = [
  "var(--loombus-page-bg)",
  "border-b border-[color:var(--loombus-border)]",
  "text-[color:var(--loombus-gold)]",
  "fetch(`/api/jobs?${params.toString()}`",
  "href=\"/jobs/manage\"",
  "href=\"/businesses\"",
  "jobCompensationLabel(job)",
  "jobLocationLabel(job)",
  "employmentTypeLabel(job.employmentType)",
  "workplaceTypeLabel(job.workplaceType)",
];

for (const marker of required) {
  if (!source.includes(marker)) {
    throw new Error(`Jobs Editorial verifier missing required marker: ${marker}`);
  }
}

const forbidden = [
  "rounded-[1.75rem]",
  "rounded-[1.5rem]",
  "rounded-full border px-4 py-2.5",
  "shadow-xl",
  "shadow-2xl",
  "shadow-lg",
];

for (const marker of forbidden) {
  if (source.includes(marker)) {
    throw new Error(`Jobs Editorial verifier found legacy presentation marker: ${marker}`);
  }
}

console.log("Jobs directory Editorial UI verification passed.");
