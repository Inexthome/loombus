# Issue #671 Phase K: Scheduled Effective-Date Runtime

## Purpose

Implement fail-closed runtime execution for future-dated policy versions without granting a background bot authority to rewrite approved repository records.

Baseline: current `main` at `b3e7ed4fa8ab357bd60af8ff111d2b025ebb213e`.

## Runtime model

The repository remains the durable audit source. A version may be stored as `scheduled` with a future `effectiveAt` timestamp.

Before that timestamp, the currently effective predecessor remains the only public current version.

At or after the timestamp, Loombus projects the scheduled version into the public lifecycle only when the exact transition still passes all publication checks. The projection is request-time behavior and does not silently rewrite `policy-content-registry.data.json`.

When a valid scheduled successor activates through projection, the successor is treated as `effective` for current serving and its exact predecessor is treated as `superseded` for archive/history serving.

## Revalidation at activation time

A due scheduled successor is normalized to the effective state only for validation and must still pass the existing publication gate: identity, canonical route, source revision, `publicReady`, public audience, elapsed effective date, required approvals, approval/source binding, and publication blockers.

The successor must name the exact projected current version in `supersedesVersion`.

## Fail-closed behavior

If the stored family has zero or multiple valid current effective versions, scheduled execution cannot create a replacement current version.

If more than one due scheduled successor targets the same predecessor, or a due scheduled record is disconnected from the predecessor chain, activation stops at the last valid current version.

If approval state changes, source binding drifts, `publicReady` is removed, audience changes, or a blocker becomes active before the scheduled time, the successor does not activate and the last valid current version remains live.

## Sequential scheduled versions

Multiple future versions can be scheduled as an explicit chain. If several scheduled timestamps have elapsed, the runtime walks them chronologically. Each successor must supersede the version immediately before it and independently pass the publication gate. A later failure leaves the last valid projected version current.

## Payload registration requirement

Any actual registry-managed `scheduled` version must already have its exact structured payload statically registered. The Phase K verifier checks both the exact `documentId:version` key and payload path in `policy-content-payload-registry.ts`.

## Archive and history behavior

Archive and public history resolution consume the same projected lifecycle. Before the scheduled time, the successor is not public historical content. After a valid timed transition, it is the effective version and the predecessor remains retrievable as superseded.

## Explicitly unchanged

This phase does not add or schedule a real policy version, modify registry data, alter Accessibility wording or approvals, add a cron writer, create a new publication approval path, change Supabase, or change Issue #667/#670/#674 authorities.

Change-note presentation and first-20-draft scaling remain separate following phases.

## Verification

The governance verifier covers before-due behavior, valid due activation, approval drift, source-binding drift, active blockers, ambiguous due successors, chained elapsed schedules, and static payload registration for any actual scheduled record.
