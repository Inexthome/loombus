import fs from "node:fs";

const path = "src/components/job-profile-page.tsx";
const source = fs.readFileSync(path, "utf8");

const required = [
  "var(--loombus-page-bg)",
  "fetch(`/api/jobs?slug=${encodeURIComponent(slug)}`",
  "supabase.auth.getSession()",
  "fetch(\"/api/jobs\"",
  "action: \"report\"",
  "Authorization: `Bearer ${token}`",
  "window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`",
  "job.applicationUrl",
  "job.applicationEmail",
  "job.businessSlug",
  "Loombus does not process this application or make hiring decisions.",
];

for (const marker of required) {
  if (!source.includes(marker)) {
    throw new Error(`Job profile Editorial verifier missing required marker: ${marker}`);
  }
}

const forbidden = [
  "rounded-[1.75rem]",
  "rounded-[1.4rem]",
  "rounded-full",
  "shadow-xl",
  "shadow-2xl",
  "shadow-sm",
];

for (const marker of forbidden) {
  if (source.includes(marker)) {
    throw new Error(`Job profile Editorial verifier found legacy presentation marker: ${marker}`);
  }
}

console.log("Job profile Editorial UI verification passed.");
