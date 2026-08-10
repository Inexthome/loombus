import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const registryPath = path.join(root, "src/lib/policy-content-registry.data.json");
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const errors = [];

const documentTypes = new Set([
  "legal",
  "policy",
  "safety",
  "help",
  "room_governance",
  "transparency",
]);
const categories = new Set([
  "account",
  "privacy",
  "security",
  "content",
  "community",
  "messaging",
  "rooms",
  "ai",
  "search",
  "commerce",
  "jobs",
  "services",
  "marketplace",
  "billing",
  "accessibility",
  "developer",
  "legal_requests",
  "child_safety",
  "moderation",
  "appeals",
  "transparency",
]);
const audiences = new Set([
  "public",
  "members",
  "room_owners",
  "creators",
  "businesses",
  "developers",
  "administrators",
  "internal_only",
]);
const statuses = new Set([
  "internal_draft",
  "review",
  "approved",
  "scheduled",
  "effective",
  "superseded",
  "withdrawn",
]);
const approvalStates = new Set([
  "pending",
  "approved",
  "changes_requested",
  "not_required",
]);
const migrationStates = new Set([
  "legacy_public_route",
  "registry_candidate",
  "registry_managed",
]);
const versionPattern = /^\d{4}\.\d{2}\.\d{2}\.\d+$/;

function addError(message) {
  errors.push(message);
}

function requireOwn(object, key, context) {
  if (!Object.prototype.hasOwnProperty.call(object, key)) {
    addError(`${context}: missing required key ${key}`);
  }
}

function requireString(value, context) {
  if (typeof value !== "string" || value.trim() === "") {
    addError(`${context}: expected non-empty string`);
    return false;
  }
  return true;
}

function requireArray(value, context) {
  if (!Array.isArray(value)) {
    addError(`${context}: expected array`);
    return false;
  }
  return true;
}

function parseTimestamp(value) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

function requiredApprovalsComplete(version) {
  const problems = [];
  for (const reviewerRole of version.requiredReviewers ?? []) {
    const approval = (version.approvals ?? []).find(
      (candidate) => candidate.reviewerRole === reviewerRole,
    );
    if (!approval) {
      problems.push(`missing approval for ${reviewerRole}`);
      continue;
    }
    if (approval.state !== "approved") {
      problems.push(`${reviewerRole} is ${approval.state}`);
      continue;
    }
    if (approval.sourceRevision !== version.sourceRevision) {
      problems.push(`${reviewerRole} approval revision mismatch`);
    }
  }
  return problems;
}

function publicationErrors(version, family, now = Date.now()) {
  const problems = [];
  if (version.documentId !== family.documentId) problems.push("document_id_mismatch");
  if (version.canonicalRoute !== family.canonicalRoute) problems.push("canonical_route_mismatch");
  if (!versionPattern.test(version.version ?? "")) problems.push("version_format_invalid");
  if (typeof version.sourceRevision !== "string" || !version.sourceRevision.trim()) {
    problems.push("source_revision_missing");
  }
  if (version.publicReady !== true) problems.push("public_ready_false");
  if (version.audience !== "public") problems.push("audience_not_public");
  if (version.status !== "effective") problems.push("status_not_effective");
  const effectiveAt = parseTimestamp(version.effectiveAt);
  if (effectiveAt === null) problems.push("effective_at_missing_or_invalid");
  else if (effectiveAt > now) problems.push("effective_at_in_future");
  if ((version.publicationBlockers ?? []).some((blocker) => blocker.active === true)) {
    problems.push("active_publication_blocker");
  }
  problems.push(...requiredApprovalsComplete(version));
  return problems;
}

function validateApproval(approval, context) {
  const keys = [
    "reviewerRole",
    "state",
    "approvedBy",
    "approvedAt",
    "sourceRevision",
    "noteReference",
    "reapprovalRequiredAfterChange",
  ];
  for (const key of keys) requireOwn(approval, key, context);
  requireString(approval.reviewerRole, `${context}.reviewerRole`);
  if (!approvalStates.has(approval.state)) addError(`${context}: invalid approval state ${approval.state}`);
  requireString(approval.sourceRevision, `${context}.sourceRevision`);
  if (typeof approval.reapprovalRequiredAfterChange !== "boolean") {
    addError(`${context}.reapprovalRequiredAfterChange: expected boolean`);
  }
}

function validateRelatedLinks(links, context) {
  if (!requireArray(links, context)) return;
  for (const [index, link] of links.entries()) {
    requireString(link?.label, `${context}[${index}].label`);
    requireString(link?.href, `${context}[${index}].href`);
  }
}

const requiredVersionKeys = [
  "documentId",
  "version",
  "slug",
  "canonicalRoute",
  "title",
  "summary",
  "documentType",
  "category",
  "audience",
  "status",
  "publicReady",
  "effectiveAt",
  "lastReviewedAt",
  "owner",
  "requiredReviewers",
  "approvals",
  "productDependencies",
  "publicationBlockers",
  "relatedSettings",
  "relatedReports",
  "relatedAppeals",
  "relatedSupport",
  "relatedEmergencyActions",
  "relatedArticles",
  "searchKeywords",
  "jurisdiction",
  "locale",
  "sourceRevision",
  "changeNote",
  "supersedesVersion",
  "replacementDocumentId",
  "withdrawalReason",
  "payloadPath",
];

if (registry.schemaVersion !== "policy_content.v1") {
  addError(`registry: expected schemaVersion policy_content.v1, got ${registry.schemaVersion}`);
}
if (registry.registryRoutingEnabled !== false) {
  addError("registry: Phase B requires registryRoutingEnabled=false; public route switchover is not authorized");
}
if (registry.archiveRoutingEnabled !== false) {
  addError("registry: Phase B requires archiveRoutingEnabled=false; public archive routing is not authorized");
}
requireString(registry.defaultLocale, "registry.defaultLocale");
requireString(registry.defaultJurisdiction, "registry.defaultJurisdiction");
requireArray(registry.documentFamilies, "registry.documentFamilies");
requireArray(registry.migrationSources, "registry.migrationSources");

const documentIds = new Set();
const canonicalRoutes = new Set();
const allVersionsByDocument = new Map();
const relatedArticleReferences = [];

for (const [familyIndex, family] of (registry.documentFamilies ?? []).entries()) {
  const context = `documentFamilies[${familyIndex}]`;
  requireString(family.documentId, `${context}.documentId`);
  requireString(family.canonicalRoute, `${context}.canonicalRoute`);
  requireString(family.currentSourcePath, `${context}.currentSourcePath`);
  if (!documentTypes.has(family.documentType)) addError(`${context}: invalid documentType ${family.documentType}`);
  if (!categories.has(family.category)) addError(`${context}: invalid category ${family.category}`);
  if (!migrationStates.has(family.migrationState)) addError(`${context}: invalid migrationState ${family.migrationState}`);
  if (!family.canonicalRoute?.startsWith("/")) addError(`${context}: canonicalRoute must start with /`);
  if (documentIds.has(family.documentId)) addError(`${context}: duplicate documentId ${family.documentId}`);
  documentIds.add(family.documentId);
  if (canonicalRoutes.has(family.canonicalRoute)) addError(`${context}: duplicate canonicalRoute ${family.canonicalRoute}`);
  canonicalRoutes.add(family.canonicalRoute);

  const sourcePath = path.join(root, family.currentSourcePath ?? "");
  if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) {
    addError(`${context}: currentSourcePath does not resolve to a file: ${family.currentSourcePath}`);
  }

  if (!requireArray(family.registryManagedVersions, `${context}.registryManagedVersions`)) continue;
  const versions = new Set();
  allVersionsByDocument.set(family.documentId, family.registryManagedVersions);

  for (const [versionIndex, version] of family.registryManagedVersions.entries()) {
    const versionContext = `${context}.registryManagedVersions[${versionIndex}]`;
    for (const key of requiredVersionKeys) requireOwn(version, key, versionContext);

    requireString(version.documentId, `${versionContext}.documentId`);
    requireString(version.version, `${versionContext}.version`);
    requireString(version.slug, `${versionContext}.slug`);
    requireString(version.canonicalRoute, `${versionContext}.canonicalRoute`);
    requireString(version.title, `${versionContext}.title`);
    requireString(version.summary, `${versionContext}.summary`);
    requireString(version.owner, `${versionContext}.owner`);
    requireString(version.jurisdiction, `${versionContext}.jurisdiction`);
    requireString(version.locale, `${versionContext}.locale`);
    requireString(version.sourceRevision, `${versionContext}.sourceRevision`);
    requireString(version.payloadPath, `${versionContext}.payloadPath`);

    if (version.documentId !== family.documentId) addError(`${versionContext}: documentId must match family`);
    if (version.canonicalRoute !== family.canonicalRoute) addError(`${versionContext}: canonicalRoute must match family`);
    if (!versionPattern.test(version.version ?? "")) addError(`${versionContext}: invalid version format ${version.version}`);
    if (versions.has(version.version)) addError(`${versionContext}: duplicate version ${version.version}`);
    versions.add(version.version);
    if (!documentTypes.has(version.documentType)) addError(`${versionContext}: invalid documentType ${version.documentType}`);
    if (!categories.has(version.category)) addError(`${versionContext}: invalid category ${version.category}`);
    if (!audiences.has(version.audience)) addError(`${versionContext}: invalid audience ${version.audience}`);
    if (!statuses.has(version.status)) addError(`${versionContext}: invalid status ${version.status}`);
    if (typeof version.publicReady !== "boolean") addError(`${versionContext}.publicReady: expected boolean`);

    requireArray(version.requiredReviewers, `${versionContext}.requiredReviewers`);
    requireArray(version.approvals, `${versionContext}.approvals`);
    requireArray(version.productDependencies, `${versionContext}.productDependencies`);
    requireArray(version.publicationBlockers, `${versionContext}.publicationBlockers`);
    requireArray(version.relatedArticles, `${versionContext}.relatedArticles`);
    requireArray(version.searchKeywords, `${versionContext}.searchKeywords`);
    validateRelatedLinks(version.relatedSettings, `${versionContext}.relatedSettings`);
    validateRelatedLinks(version.relatedReports, `${versionContext}.relatedReports`);
    validateRelatedLinks(version.relatedAppeals, `${versionContext}.relatedAppeals`);
    validateRelatedLinks(version.relatedSupport, `${versionContext}.relatedSupport`);
    validateRelatedLinks(version.relatedEmergencyActions, `${versionContext}.relatedEmergencyActions`);

    for (const [approvalIndex, approval] of (version.approvals ?? []).entries()) {
      validateApproval(approval, `${versionContext}.approvals[${approvalIndex}]`);
    }
    for (const articleId of version.relatedArticles ?? []) {
      relatedArticleReferences.push({ articleId, context: versionContext });
    }

    const payloadPath = path.join(root, version.payloadPath ?? "");
    if (!fs.existsSync(payloadPath) || !fs.statSync(payloadPath).isFile()) {
      addError(`${versionContext}: payloadPath does not resolve to a file: ${version.payloadPath}`);
    }

    const effectiveAt = version.effectiveAt === null ? null : parseTimestamp(version.effectiveAt);
    if (version.effectiveAt !== null && effectiveAt === null) addError(`${versionContext}: invalid effectiveAt`);
    if (version.lastReviewedAt !== null && parseTimestamp(version.lastReviewedAt) === null) {
      addError(`${versionContext}: invalid lastReviewedAt`);
    }

    if (version.status === "effective") {
      const gateErrors = publicationErrors(version, family);
      if (gateErrors.length > 0) addError(`${versionContext}: effective version is publication-ineligible: ${gateErrors.join(", ")}`);
    }
    if (version.status === "scheduled") {
      if (version.publicReady !== true) addError(`${versionContext}: scheduled version must have publicReady=true`);
      if (version.audience !== "public") addError(`${versionContext}: scheduled version must have public audience`);
      if (effectiveAt === null || effectiveAt <= Date.now()) addError(`${versionContext}: scheduled version requires a future effectiveAt`);
      if ((version.publicationBlockers ?? []).some((blocker) => blocker.active === true)) {
        addError(`${versionContext}: scheduled version has an active publication blocker`);
      }
      const approvalProblems = requiredApprovalsComplete(version);
      if (approvalProblems.length > 0) addError(`${versionContext}: scheduled version approval failure: ${approvalProblems.join(", ")}`);
    }
    if (version.status === "effective" && effectiveAt !== null && effectiveAt > Date.now()) {
      addError(`${versionContext}: effective version cannot have future effectiveAt`);
    }
    if (version.status === "effective" && version.publicReady === false) {
      addError(`${versionContext}: effective version cannot have publicReady=false`);
    }
    if (version.status === "effective" && version.audience === "internal_only") {
      addError(`${versionContext}: internal-only content cannot be effective on a public route`);
    }
    if (version.supersedesVersion !== null && version.supersedesVersion === version.version) {
      addError(`${versionContext}: version cannot supersede itself`);
    }
  }

  for (const version of family.registryManagedVersions) {
    if (version.supersedesVersion !== null && !versions.has(version.supersedesVersion)) {
      addError(`${context}: ${version.version} supersedes unknown version ${version.supersedesVersion}`);
    }
    if (version.status === "superseded") {
      const hasSuccessor = family.registryManagedVersions.some(
        (candidate) => candidate.supersedesVersion === version.version,
      );
      if (!hasSuccessor && version.replacementDocumentId === null) {
        addError(`${context}: superseded version ${version.version} has no successor or replacement document`);
      }
    }
  }
}

for (const { articleId, context } of relatedArticleReferences) {
  if (!documentIds.has(articleId)) addError(`${context}: relatedArticles references unknown documentId ${articleId}`);
}

for (const [sourceIndex, source] of (registry.migrationSources ?? []).entries()) {
  const context = `migrationSources[${sourceIndex}]`;
  requireString(source.sourceId, `${context}.sourceId`);
  requireString(source.directory, `${context}.directory`);
  requireString(source.filenamePattern, `${context}.filenamePattern`);
  if (!statuses.has(source.defaultStatus)) addError(`${context}: invalid defaultStatus ${source.defaultStatus}`);
  if (!audiences.has(source.defaultAudience)) addError(`${context}: invalid defaultAudience ${source.defaultAudience}`);
  if (!Number.isInteger(source.minimumDocuments) || source.minimumDocuments < 1) {
    addError(`${context}: minimumDocuments must be a positive integer`);
  }
  if (typeof source.forcePublicReadyFalse !== "boolean") addError(`${context}: forcePublicReadyFalse must be boolean`);
  if (source.registryImportEnabled !== false) addError(`${context}: Phase B migration imports must remain disabled`);
  if (source.publicRoutingEnabled !== false) addError(`${context}: Phase B public routing must remain disabled`);

  const directory = path.join(root, source.directory ?? "");
  if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
    addError(`${context}: migration directory does not exist: ${source.directory}`);
    continue;
  }
  let pattern;
  try {
    pattern = new RegExp(source.filenamePattern);
  } catch {
    addError(`${context}: invalid filenamePattern`);
    continue;
  }
  const matchedFiles = fs.readdirSync(directory).filter((name) => pattern.test(name)).sort();
  if (matchedFiles.length < source.minimumDocuments) {
    addError(`${context}: expected at least ${source.minimumDocuments} matching documents, found ${matchedFiles.length}`);
  }
  if (source.forcePublicReadyFalse) {
    for (const filename of matchedFiles) {
      const content = fs.readFileSync(path.join(directory, filename), "utf8");
      const frontMatter = content.match(/^---\s*\n([\s\S]*?)\n---/);
      if (frontMatter && /^public_ready:\s*true\s*$/m.test(frontMatter[1])) {
        addError(`${context}: internal migration source ${filename} declares public_ready: true`);
      }
    }
  }
}

// Contract fixtures prove the verifier itself fails closed on the highest-risk publication mistakes.
const fixtureFamily = {
  documentId: "TEST-DOCUMENT",
  canonicalRoute: "/test-document",
};
const fixtureRevision = "sha256:test-fixture";
const fixture = {
  documentId: fixtureFamily.documentId,
  version: "2026.08.10.1",
  canonicalRoute: fixtureFamily.canonicalRoute,
  publicReady: true,
  audience: "public",
  status: "effective",
  effectiveAt: new Date(Date.now() - 60_000).toISOString(),
  sourceRevision: fixtureRevision,
  requiredReviewers: ["Legal"],
  approvals: [
    {
      reviewerRole: "Legal",
      state: "approved",
      sourceRevision: fixtureRevision,
    },
  ],
  publicationBlockers: [],
};
if (publicationErrors(fixture, fixtureFamily).length !== 0) {
  addError("verifier fixture: known eligible version did not pass");
}
if (!publicationErrors({ ...fixture, publicReady: false }, fixtureFamily).includes("public_ready_false")) {
  addError("verifier fixture: public_ready=false did not fail closed");
}
if (!publicationErrors({ ...fixture, audience: "internal_only" }, fixtureFamily).includes("audience_not_public")) {
  addError("verifier fixture: internal-only audience did not fail closed");
}
if (!publicationErrors({ ...fixture, effectiveAt: new Date(Date.now() + 60_000).toISOString() }, fixtureFamily).includes("effective_at_in_future")) {
  addError("verifier fixture: future effective version did not fail closed");
}
const revisionMismatchFixture = {
  ...fixture,
  approvals: [{ reviewerRole: "Legal", state: "approved", sourceRevision: "different-revision" }],
};
if (!publicationErrors(revisionMismatchFixture, fixtureFamily).some((problem) => problem.includes("revision mismatch"))) {
  addError("verifier fixture: approval/source revision mismatch did not fail closed");
}

if (errors.length > 0) {
  console.error("Policy content registry verification FAILED:\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const draftSource = registry.migrationSources.find(
  (source) => source.sourceId === "trust_safety_first_20_drafts",
);
const draftCount = draftSource
  ? fs
      .readdirSync(path.join(root, draftSource.directory))
      .filter((name) => new RegExp(draftSource.filenamePattern).test(name)).length
  : 0;

console.log("Policy content registry verification PASSED");
console.log(`- document families: ${registry.documentFamilies.length}`);
console.log(`- registry-managed versions: ${[...allVersionsByDocument.values()].reduce((sum, versions) => sum + versions.length, 0)}`);
console.log(`- matching internal draft sources: ${draftCount}`);
console.log(`- public registry routing enabled: ${registry.registryRoutingEnabled}`);
console.log(`- public archive routing enabled: ${registry.archiveRoutingEnabled}`);
