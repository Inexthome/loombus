import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];

const paths = {
  previewClient:
    "src/app/admin/policy-content-preview/policy-content-preview-client.tsx",
  structuredRenderer:
    "src/components/policy-content/structured-policy-renderer.tsx",
  publicPolicyPage: "src/components/public-policy-page.tsx",
};

function read(relativePath) {
  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    errors.push(`missing required file: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolute, "utf8");
}

function expect(source, fragment, context) {
  if (!source.includes(fragment)) {
    errors.push(`${context}: missing expected fragment ${JSON.stringify(fragment)}`);
  }
}

function reject(source, fragment, context) {
  if (source.includes(fragment)) {
    errors.push(`${context}: forbidden fragment present ${JSON.stringify(fragment)}`);
  }
}

const previewClient = read(paths.previewClient);
const structuredRenderer = read(paths.structuredRenderer);
const publicPolicyPage = read(paths.publicPolicyPage);

for (const [context, source] of [
  ["preview client", previewClient],
  ["structured policy renderer", structuredRenderer],
  ["public policy page", publicPolicyPage],
]) {
  expect(source, "focus-visible:outline-none", context);
  expect(source, "focus-visible:ring-2", context);
  expect(source, "focus-visible:ring-[var(--loombus-gold)]", context);
  expect(source, "focus-visible:ring-offset-2", context);
  expect(source, "focus-visible:ring-offset-[var(--loombus-bg)]", context);
  reject(source, 'tabIndex={-1}', context);
  reject(source, 'tabindex="-1"', context);
}

expect(previewClient, 'href="/admin/platform"', "preview client");
expect(publicPolicyPage, "href={backHref}", "public policy page");
expect(structuredRenderer, '"underline underline-offset-4', "structured policy renderer");
expect(structuredRenderer, "<Link key={key} href={inline.href}", "structured policy renderer");
expect(structuredRenderer, "<a key={key} href={inline.href}", "structured policy renderer");

if (errors.length > 0) {
  console.error("Policy keyboard focus verification FAILED:\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Policy keyboard focus verification PASSED");
console.log("- preview return control has explicit visible keyboard focus");
console.log("- shared policy back link has explicit visible keyboard focus");
console.log("- structured policy links are visibly underlined and focus-ringed");
console.log("- reviewed policy links are not removed from sequential tab order");
