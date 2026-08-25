# Issue #671 Phase M: first-20 draft scaling

## Purpose

Scale the existing `docs/trust-safety/drafts` source set into a deterministic, reviewable import plan without publishing, routing, or silently classifying any draft.

## Existing boundary preserved

The existing `trust_safety_first_20_drafts` migration source remains:

- `defaultStatus: internal_draft`
- `defaultAudience: internal_only`
- `forcePublicReadyFalse: true`
- `registryImportEnabled: false`
- `publicRoutingEnabled: false`

This phase does not change those flags.

## Deterministic import plan

`scripts/policy-content/build-first20-draft-import-plan.mjs` reads the registered migration source and the numbered draft files at execution time. For ordinals 01 through 20 it records only source facts that can be derived without policy interpretation:

- ordinal
- exact repository source path
- SHA-256 hash of the exact markdown source
- UTF-8 byte length
- first H1 title

Every planned record is forced to:

- `status: internal_draft`
- `audience: internal_only`
- `publicReady: false`
- `effectiveAt: null`
- `importAction: manual_identity_required`

The plan deliberately leaves `documentId`, `documentType`, `category`, and `owner` null. Those fields require explicit human assignment and review. The script does not infer legal/policy meaning from prose or filenames.

## No automatic import

The builder is planning tooling only. Running it without arguments prints the deterministic JSON plan to stdout. `--out=<path>` may be used to write a local review artifact, but nothing writes to the policy registry, payload registry, canonical routes, public search, or Supabase.

No generated plan is committed as authoritative policy metadata in this phase.

## Governance

`verify-policy-first20-draft-scaling.mjs` fails if:

- the first 20 numbered drafts are incomplete or ambiguous
- a numbered draft lacks an H1 title
- a source hash/path is malformed or duplicated
- a planned record becomes public-ready, effective, scheduled, or public-audience
- identity fields are inferred instead of requiring explicit assignment
- registry import or public routing is enabled
- the migration source loses its fail-closed defaults

The Policy content governance workflow runs this verification whenever the draft source set, builder, verifier, or policy governance workflow changes.

## Explicit non-goals

This phase does not:

- decide which draft maps to which final public policy/document ID
- rewrite or summarize draft wording
- create structured public payloads
- approve any draft
- create counsel approval
- publish or schedule any draft
- enable registry import
- enable public routing
- change current policy pages or version history
- change Supabase

## Next step after merge

The next migration step should be explicit identity assignment and one-at-a-time candidate conversion under the existing review/publication gates. A draft remains internal until its exact source revision, document identity, structured payload, required reviewers, approvals, blockers, and publication state are separately reviewed and satisfied.
