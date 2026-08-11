# POLICY-ACCESSIBILITY 2026.08.10.1 Review Record

Status: reviewer approvals complete

Issue: #671

Document ID: `POLICY-ACCESSIBILITY`

Version: `2026.08.10.1`

Canonical route: `/accessibility`

Structured payload: `src/content/policies/POLICY-ACCESSIBILITY/2026.08.10.1.json`

Base effective version: `2026.07.18.1`

Base effective source revision: `git-blob:21b0c0eb9504012d8926dc73dcb88d5591a17780`

Candidate source revision: `sha256:e97bb10027f3895a55fb78dce32fee3ade2363ccc24690a40042737ab1f2edfe`

Restricted preview: `/admin/policy-content-preview`

Public activation authorized by this record: no

## Purpose

This successor exists because the current effective Accessibility page displays `Last reviewed: July 18, 2026`, while the completed Product Owner and Accessibility review sequence occurred on August 10, 2026.

The correction requested for this successor is limited to displaying `Last reviewed: August 10, 2026` on the current Accessibility policy after the successor is separately activated.

The already-effective version `2026.07.18.1` is not rewritten. It remains an immutable historical version and continues serving publicly until a later activation explicitly supersedes it.

## Exact metadata-only delta

Relative to effective version `2026.07.18.1`, candidate `2026.08.10.1` is permitted to differ only in:

1. version identity: `2026.07.18.1` -> `2026.08.10.1`;
2. displayed reviewed date: `July 18, 2026` -> `August 10, 2026`;
3. source-revision binding for this successor review target.

Policy wording, section order, section IDs, links, page metadata, title, description, accessibility commitments, support destination, and renderer contract must remain unchanged.

## Source-revision derivation

This successor is a metadata-only derivative of the immutable effective review target rather than a rewrite of the legacy route source.

The candidate revision is the SHA-256 digest of this exact descriptor:

`POLICY-ACCESSIBILITY|2026.08.10.1|reviewedDate=August 10, 2026|base=git-blob:21b0c0eb9504012d8926dc73dcb88d5591a17780`

Expected digest:

`e97bb10027f3895a55fb78dce32fee3ade2363ccc24690a40042737ab1f2edfe`

This gives the metadata-only successor an exact review identity while preserving the original effective source revision and historical payload unchanged.

## Current registry state

The family remains `registry_managed` because version `2026.07.18.1` is already effective.

For candidate `2026.08.10.1`:

- status: `approved`;
- `publicReady=false`;
- `effectiveAt=null`;
- `lastReviewedAt=2026-08-10T00:00:00.000Z`;
- Product Owner approval: approved;
- Accessibility approval: approved;
- successor metadata review dependency: non-blocking;
- successor review blocker: inactive;
- successor activation blocker: active.

The current effective version remains the sole public current version. The approved successor must not appear in public history or exact-version archive serving until a separate activation phase makes it effective.

## Restricted preview boundary

The restricted preview is allowed to display non-effective candidates within an already `registry_managed` family. It remains:

- administrator-authenticated;
- GET-only;
- read-only;
- private and no-store;
- non-indexable;
- statically allowlisted;
- unable to edit, approve, publish, notify, or switch the public route.

The preview endpoint rejects effective, superseded, and withdrawn versions. Global registry/archive routing may remain enabled because candidate eligibility is enforced at the requested version boundary.

## Completed manual review

Issue #671 comment `5248614787` records the explicit manual confirmation of the deployed restricted PR #889 preview for this exact successor source revision.

The requested manual scope was:

- confirm `Last reviewed: August 10, 2026` displays correctly;
- confirm the page otherwise visually matches the current Accessibility policy;
- confirm the Support and accessibility email links remain normal.

The Product Owner confirmed the preview after those checks. Automated governance separately proves that policy wording, section order and IDs, links, page metadata, title, description, support destination, and accessibility commitments are unchanged from the current effective payload after removing the three permitted successor metadata fields.

### Product Owner

State: approved

Approved by: `Inexthome`

Approved at: `2026-08-11T03:21:00.000Z`

Source revision: `sha256:e97bb10027f3895a55fb78dce32fee3ade2363ccc24690a40042737ab1f2edfe`

Evidence: Issue #671 comment `5248614787`.

Scope: the intended user-visible reviewed-date correction and unchanged policy content/links were confirmed on the restricted preview.

### Accessibility

State: approved

Approved by: `Inexthome`

Approved at: `2026-08-11T03:21:00.000Z`

Source revision: `sha256:e97bb10027f3895a55fb78dce32fee3ade2363ccc24690a40042737ab1f2edfe`

Evidence: Issue #671 comment `5248614787`, together with the successor equality verifier and the previously completed rendered Accessibility review for the unchanged renderer/content structure.

Scope: focused regression confirmation is sufficient for this metadata-only successor because the renderer, headings, lists, links, policy wording, and accessibility commitments are unchanged. Prior approval was not silently copied; a new approval record is bound to this exact successor revision.

## Review evidence rule

Approval is based on explicit human confirmation for this exact successor version/revision. It is not inferred from CI, Vercel, administrator status, the prior version's approvals, or the request to create the correction.

If the successor payload, source-revision descriptor, renderer contract, policy wording, links, sections, or reviewed-date value changes, these approvals must be reconsidered under the version-specific reapproval rule.

## Activation boundary

Even with both reviewer roles approved, this successor remains non-public until a separate activation decision:

- marks `2026.07.18.1` superseded;
- marks `2026.08.10.1` effective;
- sets `publicReady=true`;
- assigns an effective timestamp;
- clears the remaining activation blocker;
- verifies current route, history, and exact-version archive behavior.

No policy wording change, legal approval, member notice, or Issue #667/#670/#674 capability change is authorized by this review record.
