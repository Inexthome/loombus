# POLICY-ACCESSIBILITY 2026.08.10.1 Activation Record

Status: activation authorized, pending merge and production verification

Issue: #671

Document ID: `POLICY-ACCESSIBILITY`

Successor version: `2026.08.10.1`

Superseded version: `2026.07.18.1`

Canonical route: `/accessibility`

Successor source revision: `sha256:e97bb10027f3895a55fb78dce32fee3ade2363ccc24690a40042737ab1f2edfe`

Review evidence: Issue #671 comment `5248614787`

Activation authorization: Issue #671 comment `5248695077`

Authorized effective timestamp: `2026-08-11T03:36:00.000Z`

## Authorized transition

The Product Owner explicitly authorized the reviewed Accessibility successor to become effective immediately.

The controlled activation is limited to these registry lifecycle changes:

1. `2026.07.18.1` changes from `effective` to `superseded`.
2. `2026.08.10.1` changes from `approved` to `effective`.
3. Successor `publicReady` changes from `false` to `true`.
4. Successor `effectiveAt` becomes `2026-08-11T03:36:00.000Z`.
5. `accessibility_successor_activation_not_authorized` becomes inactive and cites Issue #671 comment `5248695077`.

## Content boundary

No policy wording is changed by this activation.

Relative to the immutable historical version `2026.07.18.1`, successor `2026.08.10.1` differs only in:

- version identity;
- displayed reviewed date, from `July 18, 2026` to `August 10, 2026`;
- successor source-revision binding.

The July 18 payload, source revision, approvals, original effective timestamp, and exact archive identity remain unchanged.

## Public routing requirement

After activation:

- `/accessibility` must resolve only `2026.08.10.1` as the current effective version;
- `/policies/history/POLICY-ACCESSIBILITY` must expose both the current effective successor and the superseded July version;
- `/policies/archive/POLICY-ACCESSIBILITY/2026.08.10.1` must resolve the exact current version;
- `/policies/archive/POLICY-ACCESSIBILITY/2026.07.18.1` must continue resolving the exact superseded historical version;
- multiple publication-eligible effective versions must continue to fail closed;
- review/approved-only versions must remain excluded from public current/history/archive serving.

## Preview boundary

The restricted preview remains administrator-authenticated, GET-only, read-only, private/no-store, non-indexable, and static-allowlisted.

Because `2026.08.10.1` becomes effective, the candidate preview status boundary must reject it as a previewable non-effective candidate. The preview mechanism does not become a second public-serving path.

## Approval boundary

This activation preserves the recorded Product Owner and Accessibility approvals for the exact successor source revision. It does not create legal approval, qualified-counsel approval, member notice authorization, or any new Issue #667/#670/#674 capability.

## Deployment boundary

This record is not proof of production activation by itself. Production is complete only after the activation PR is merged, Vercel reports success for the merge commit, and post-deploy smoke verification confirms the canonical route, history route, and both exact-version archive routes.
