# AI account-deletion disposition

Status: engineering disposition defined; no AI deletion handler or provider deletion workflow is approved.

Issue: #668

Evidence date: 2026-08-05

## Scope

This phase covers member-linked AI prompts, grounded source payloads, generated outputs, summaries, analyses, traces, provenance, logs, caches, and provider copies across Loombus AI features.

It does not approve a retention period, legal basis, provider deletion request, first-party mutation, source-record mutation, or account-deletion worker dispatch.

## Reviewed feature families

- Ask Loombus AI responses grounded in Everything Search results
- Discussion summaries and other source-linked AI derivatives
- The Floor thesis red-team analyses stored in `floor_thesis_analyses`
- Research Desk drafts generated through the OpenAI Responses API and web search
- administrator-only Research Desk generation and approval provenance
- moderation and safety model calls
- member helpfulness metadata stored separately in `ai_output_ratings`

The reviewed repository evidence shows feature-specific persistence rather than one canonical platform-wide prompt, output, or trace table. This does not prove that prompts, outputs, traces, logs, or provider copies are absent.

## Disposition model

AI data cannot be dispositioned as one undifferentiated resource. Each feature must identify:

1. the member or administrator linkage
2. the owning source record and every grounded source included in the request
3. the first-party prompt, output, summary, analysis, trace, provenance, cache, and log records
4. the provider, model, project, request identifier, web-search dependency, and subprocessor path
5. the moderation, safety, fraud, dispute, research-approval, audit, recipient-continuity, and legal-hold requirements
6. the required delete, anonymize, retain, detach, or provider-delete outcome
7. the verification query, provider evidence, unresolved copies, and exception record

## Source-linked derivatives

Stored AI derivatives must follow the owning source disposition rather than being deleted independently without context.

Examples include:

- a Floor red-team analysis linked to a thesis
- a Discussion summary linked to a Discussion
- a Research Desk draft and provenance linked to an approved or archived report
- an Ask Loombus AI response grounded in Search documents that themselves derive from profile, Discussion, Room, or commerce records

The owning source may need to remain available for thread integrity, recipient continuity, moderation, safety, fraud, dispute, institutional research approval, audit, or legal hold. When the source is deleted or anonymized under an approved path, every AI derivative and downstream Search or cache copy must be verified separately.

## First-party records

The reviewed implementation includes at least these distinct first-party categories:

| Category | Example | Current boundary |
|---|---|---|
| Stored AI output | `floor_thesis_analyses` | Linked to a Floor thesis; service-authored; no automatic deletion approved |
| Source-linked derivative | `discussion_summaries` and other summaries | Owning source, visibility, moderation, Search, cache, and legal-hold decisions apply |
| Generation provenance | Research Desk model, prompt-version, generating-admin, approving-admin evidence | Administrator-only audit and publication evidence may require retention |
| Product feedback | `ai_output_ratings` | Separately gated deletion handler deletes only the member rating, not the rated output or provider copy |
| Runtime request and response data | feature-specific route payloads and generated responses | Persistence, logs, caching, observability, and incident copies require inventory |

Deleting a rating, hiding a response, removing access, or deleting one first-party row is not proof that all associated data was deleted.

## Provider boundary

Repository evidence identifies OpenAI and Anthropic call paths. Provider-side retention, deletion APIs, project settings, training controls, abuse-monitoring retention, web-search processing, backups, subprocessors, and contractual obligations have not been verified by this phase.

A provider deletion outcome requires evidence tied to the correct provider project, request or object scope, account, date, and response. A successful API response alone is insufficient if the scope, logs, safety copies, backups, or subprocessors remain unclear.

## Required verification sequence

1. Inventory every production AI feature and call path.
2. Identify the first-party source, prompt, output, derivative, trace, provenance, cache, log, and rating records.
3. Resolve the owning source and public-attribution disposition.
4. Resolve safety, moderation, fraud, dispute, audit, research approval, recipient-continuity, security, and legal-hold exceptions.
5. Apply only the approved first-party disposition.
6. Verify Search, grounded-source sets, summaries, caches, logs, exports, backups, and replicas separately.
7. Apply provider deletion only through a verified provider control.
8. Record verification evidence and unresolved copies in the account-deletion disposition.

## Safety boundary

Migration `20260805040000_account_deletion_ai_disposition.sql` adds registry metadata only.

It does not:

- delete, anonymize, detach, rewrite, archive, or hide an AI prompt, output, summary, analysis, trace, provenance record, or rating
- mutate an owning Discussion, Reply, Floor thesis, Research Desk report, Search document, Room record, profile, or commerce record
- call OpenAI, Anthropic, a web-search provider, or another vendor deletion API
- clear application, CDN, browser, database, log, analytics, backup, or replica data
- add an account-deletion worker dispatch
- change `ACCOUNT_DELETION_DESTRUCTIVE_HANDLERS_ENABLED`

Deployment alone cannot modify AI data or provider copies.
