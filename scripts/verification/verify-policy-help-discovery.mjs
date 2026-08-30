import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];

const files = {
  registry: "src/lib/policy-content-registry.data.json",
  discovery: "src/lib/policy-content-public-discovery.ts",
  supportPage: "src/app/support/page.tsx",
  discoveryClient: "src/app/support/policy-help-discovery-client.tsx",
  discoveryCss: "src/app/support/policy-help-discovery.css",
};

function read(relativePath) {
  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute)) {
    errors.push(`missing required file: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolute, "utf8");
}

function expect(source, fragment, context) {
  if (!source.includes(fragment)) {
    errors.push(`${context}: missing ${JSON.stringify(fragment)}`);
  }
}

function reject(source, fragment, context) {
  if (source.includes(fragment)) {
    errors.push(`${context}: forbidden ${JSON.stringify(fragment)}`);
  }
}

const discovery = read(files.discovery);
const supportPage = read(files.supportPage);
const client = read(files.discoveryClient);
const css = read(files.discoveryCss);
const registry = JSON.parse(read(files.registry) || "{}");

expect(discovery, 'import "server-only";', "public discovery adapter");
expect(discovery, "resolvePolicyCurrentVersionFromRegistry", "public discovery adapter");
expect(discovery, 'family.migrationState !== "registry_managed"', "public discovery adapter");
expect(discovery, 'family.migrationState !== "legacy_public_route"', "public discovery adapter");
expect(discovery, "PLATFORM_ROUTE_REGISTRY.find", "public discovery adapter");
reject(discovery, 'migrationState === "registry_candidate"', "public discovery adapter");
reject(discovery, "approvals:", "public discovery adapter");
reject(discovery, "publicationBlockers:", "public discovery adapter");
reject(discovery, "changeNote:", "public discovery adapter");

expect(supportPage, "getPublicPolicyDiscoveryEntries()", "Support page");
expect(supportPage, "<PolicyHelpDiscoveryClient policyEntries={policyEntries} />", "Support page");
expect(supportPage, '<div className="support-policy-contact-only">', "Support page");
expect(supportPage, "<SupportV2Client />", "Support page");

expect(client, 'aria-label="Common support needs"', "discovery client");
expect(client, 'aria-label="Policy categories"', "discovery client");
expect(client, "supportDestinations", "discovery client");
expect(client, "aria-pressed={category === item}", "discovery client");
expect(client, "filteredPolicyEntries", "discovery client");
expect(client, "Current public documents", "discovery client");
expect(client, 'type="search"', "discovery client");
expect(client, 'href="/support?category=general#support-request-title"', "discovery client");
expect(client, 'href="/support?category=bug#support-request-title"', "discovery client");
reject(client, "PUBLIC_HELP_AREAS", "discovery client");
reject(client, "PUBLIC_HELP_ARTICLES", "discovery client");
reject(client, "fetch(", "discovery client");
reject(client, "localStorage", "discovery client");
reject(client, "sessionStorage", "discovery client");
reject(client, "analytics", "discovery client");
reject(client, "<main", "discovery client");

expect(css, ".support-policy-category-nav", "discovery CSS");
expect(css, ".support-policy-category-button:focus-visible", "discovery CSS");
expect(css, '@media (max-width: 640px)', "discovery CSS");
expect(css, "overflow-x: auto", "discovery CSS");
expect(css, ".support-policy-contact-only .support-v2-hero", "discovery CSS");
expect(css, ".support-policy-contact-only .support-v2-section", "discovery CSS");

const accessibility = registry.documentFamilies?.find(
  (family) => family.documentId === "POLICY-ACCESSIBILITY",
);
if (!accessibility) {
  errors.push("registry: POLICY-ACCESSIBILITY family missing");
} else {
  if (accessibility.migrationState !== "registry_managed") {
    errors.push("registry: Accessibility must remain registry_managed");
  }
  const effective = (accessibility.registryManagedVersions ?? []).filter(
    (version) => version.status === "effective" && version.publicReady === true,
  );
  if (effective.length !== 1 || effective[0]?.version !== "2026.08.10.1") {
    errors.push("registry: expected exactly one current public Accessibility version 2026.08.10.1");
  }
  const superseded = (accessibility.registryManagedVersions ?? []).find(
    (version) => version.version === "2026.07.18.1",
  );
  if (superseded?.status !== "superseded") {
    errors.push("registry: historical Accessibility predecessor must remain superseded");
  }
}

for (const source of registry.migrationSources ?? []) {
  if (source.defaultAudience === "internal_only" && source.publicRoutingEnabled !== false) {
    errors.push(`registry: internal migration source ${source.sourceId} must remain non-public`);
  }
}

if (errors.length) {
  console.error("Policy and Help discovery verification FAILED:\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Policy and Help discovery verification PASSED");
console.log("- Support discovery is intentionally policy-focused after legacy Help catalog retirement");
console.log("- registry-managed discovery uses the current publication resolver");
console.log("- legacy discovery is limited to existing public route metadata");
console.log("- registry candidates and internal migration sources are not current public discovery inputs");
console.log("- common support destinations and policy category controls remain semantic and keyboard-focusable");
console.log("- structured support request workflow remains present");
