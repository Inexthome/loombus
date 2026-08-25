import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const expect = (s, f, c) => { if (!s.includes(f)) errors.push(`${c}: missing ${JSON.stringify(f)}`); };
const assert = (v, m) => { if (!v) errors.push(m); };

const resolver = read("src/lib/policy-content-resolver.ts");
const history = read("src/lib/policy-content-history.ts");
const payloadRegistry = read("src/lib/policy-content-payload-registry.ts");
const registry = JSON.parse(read("src/lib/policy-content-registry.data.json"));

expect(resolver, "export function projectPolicyFamilyPublicLifecycle", "resolver");
expect(resolver, 'version.status === "scheduled"', "resolver");
expect(resolver, "multiple_due_successors_for_predecessor", "resolver");
expect(resolver, "due_scheduled_chain_disconnected", "resolver");
expect(resolver, "evaluatePolicyVersionPublicationEligibility", "resolver");
expect(history, "projectPolicyFamilyPublicLifecycle", "history");

for (const family of registry.documentFamilies ?? []) {
  for (const version of family.registryManagedVersions ?? []) {
    if (version.status !== "scheduled") continue;
    assert(payloadRegistry.includes(`\"${family.documentId}:${version.version}\"`), `scheduled ${family.documentId}:${version.version} must be payload-registered`);
    assert(payloadRegistry.includes(version.payloadPath), `scheduled ${family.documentId}:${version.version} payload path must be registered`);
  }
}

const clone = (v) => JSON.parse(JSON.stringify(v));
function reasons(family, version, nowMs) {
  const r = [];
  if (!version.publicReady) r.push("public_ready_false");
  if (version.audience !== "public") r.push("audience_not_public");
  if (version.status !== "effective") r.push("status_not_effective");
  const t = Date.parse(version.effectiveAt ?? "");
  if (!version.effectiveAt) r.push("effective_at_missing");
  else if (Number.isNaN(t)) r.push("effective_at_invalid");
  else if (t > nowMs) r.push("effective_at_in_future");
  for (const role of version.requiredReviewers ?? []) {
    const a = (version.approvals ?? []).find((x) => x.reviewerRole === role);
    if (!a) r.push("required_approval_missing");
    else if (a.state !== "approved") r.push("required_approval_not_approved");
    else if (a.sourceRevision !== version.sourceRevision) r.push("approval_source_revision_mismatch");
  }
  if ((version.publicationBlockers ?? []).some((b) => b.active)) r.push("active_publication_blocker");
  return [...new Set(r)];
}
function project(family, nowIso) {
  const nowMs = Date.parse(nowIso);
  const versions = clone(family.registryManagedVersions);
  const stored = versions.filter((v) => v.status === "effective" && reasons(family, v, nowMs).length === 0);
  if (stored.length !== 1) return { current: null, versions, activated: [], reasons: [stored.length ? "multiple_stored_public_effective_versions" : "no_stored_public_effective_version"] };
  let current = stored[0];
  const due = versions.filter((v) => v.status === "scheduled" && !Number.isNaN(Date.parse(v.effectiveAt ?? "")) && Date.parse(v.effectiveAt) <= nowMs).sort((a,b) => Date.parse(a.effectiveAt)-Date.parse(b.effectiveAt));
  const activated = []; const blocked = [];
  while (due.length) {
    const successors = due.filter((v) => v.supersedesVersion === current.version);
    if (!successors.length) { blocked.push("due_scheduled_chain_disconnected"); break; }
    if (successors.length > 1) { blocked.push("multiple_due_successors_for_predecessor"); break; }
    const candidate = successors[0];
    const rr = reasons(family, {...candidate, status:"effective"}, nowMs);
    if (rr.length) { blocked.push(...rr); break; }
    versions.find((v)=>v.version===current.version).status = "superseded";
    versions.find((v)=>v.version===candidate.version).status = "effective";
    current = versions.find((v)=>v.version===candidate.version);
    activated.push(candidate.version);
    due.splice(due.indexOf(candidate),1);
  }
  return {current, versions, activated, reasons:[...new Set(blocked)]};
}
function v(value,status,effectiveAt,supersedesVersion=null) {
  const sourceRevision=`sha256:${value}`;
  return {documentId:"POLICY-FIXTURE",version:value,canonicalRoute:"/fixture",status,publicReady:true,audience:"public",effectiveAt,sourceRevision,requiredReviewers:["Product Owner"],approvals:[{reviewerRole:"Product Owner",state:"approved",sourceRevision}],publicationBlockers:[{blockerId:"fixture",active:false}],supersedesVersion};
}
const family=(...versions)=>({documentId:"POLICY-FIXTURE",canonicalRoute:"/fixture",registryManagedVersions:versions});
const base=v("2026.01.01.1","effective","2026-01-01T00:00:00.000Z");
const next=v("2026.09.01.1","scheduled","2026-09-01T00:00:00.000Z",base.version);
let p=project(family(base,next),"2026-08-31T23:59:59.000Z");
assert(p.current?.version===base.version,"future schedule published early");
p=project(family(base,next),"2026-09-01T00:00:00.000Z");
assert(p.current?.version===next.version,"valid due schedule did not activate");
assert(p.versions.find(x=>x.version===base.version)?.status==="superseded","predecessor not projected superseded");
const approval=clone(next); approval.approvals[0].state="changes_requested";
p=project(family(base,approval),"2026-09-01T00:00:00.000Z");
assert(p.current?.version===base.version && p.reasons.includes("required_approval_not_approved"),"approval drift did not fail closed");
const source=clone(next); source.approvals[0].sourceRevision="sha256:old";
p=project(family(base,source),"2026-09-01T00:00:00.000Z");
assert(p.current?.version===base.version && p.reasons.includes("approval_source_revision_mismatch"),"source drift did not fail closed");
const blocker=clone(next); blocker.publicationBlockers[0].active=true;
p=project(family(base,blocker),"2026-09-01T00:00:00.000Z");
assert(p.current?.version===base.version && p.reasons.includes("active_publication_blocker"),"blocker did not fail closed");
const competing=v("2026.09.01.2","scheduled","2026-09-01T00:00:00.000Z",base.version);
p=project(family(base,next,competing),"2026-09-01T00:00:00.000Z");
assert(p.current?.version===base.version && p.reasons.includes("multiple_due_successors_for_predecessor"),"ambiguous due successors did not fail closed");
const later=v("2026.10.01.1","scheduled","2026-10-01T00:00:00.000Z",next.version);
p=project(family(base,next,later),"2026-10-01T00:00:00.000Z");
assert(p.current?.version===later.version && p.activated.length===2,"elapsed chained schedules did not project sequentially");

if (errors.length) { console.error("Scheduled effective-date runtime verification FAILED:\n"+errors.map(e=>`- ${e}`).join("\n")); process.exit(1); }
console.log("Scheduled effective-date runtime verification PASSED");
