# AI account-deletion disposition

Status: engineering disposition defined; no AI deletion handler or provider deletion workflow is approved.

Issue: #668

Evidence date: 2026-08-08

## Scope

This phase covers member-linked AI prompts, grounded source payloads, generated outputs, summaries, analyses, traces, provenance, logs, caches, and provider copies across Loombus AI features.

It does not approve a retention period, legal basis, provider deletion request, first-party mutation, source-record mutation, or account-deletion worker dispatch.

## Reviewed feature families

- Ask Loombus AI responses grounded in Everything Search results
- Discussion summaries and other source-linked AI derivatives
- The Floor thesis red-team analyses stored in `floor_thesis_analyses`
- Research Desk drafts generated through the OpenAI Responses API and web search
- administrator-only Research Desk generation and approval provenance
- moderation and safety model calls, including covered private-message safety review
- private-message AI writing assist
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
| Source-linked derivative | `discussion_summaries` and `discussion_ai_outputs` | Owning source, visibility, moderation, Search, cache, and legal-hold decisions apply |
| Generation provenance | Research Desk model, provider, prompt-version, generating-admin, approving-admin evidence | Administrator-only audit and publication evidence may require retention |
| Product feedback | `ai_output_ratings` | Separately gated deletion handler deletes only the member rating, not the rated output or provider copy |
| Runtime usage metadata | `ai_usage_events` | Provider/model/feature/target/success/cache/token/cost/error metadata; not intended as a prompt/output-body store |
| Safety evidence | rule/AI safety events | Bounded content previews can be retained for warn/block events, including private-message mode |
| Runtime request and response data | feature-specific route payloads and generated responses | Persistence, logs, caching, observability, and incident copies require inventory |

Deleting a rating, hiding a response, removing access, or deleting one first-party row is not proof that all associated data was deleted.

## Provider boundary

### Active provider

Issue #669 standardizes active external LLM processing on OpenAI. New production requests must not use Anthropic after the migration is deployed.

Owner-supplied OpenAI API Platform evidence verified on 2026-08-08 establishes:

- project: `Loombus Production`
- geography: `Global`
- project Data retention UI: `None`
- API call logging: enabled per call
- model-feedback sharing: disabled
- evaluation/fine-tuning sharing: disabled
- API input/output sharing: disabled
- production `OPENAI_API_KEY`: active; last-used evidence observed 2026-08-07
- Zero Data Retention: not shown, therefore not claimed
- Modified Abuse Monitoring: not shown, therefore not claimed

`Data retention: None` is not treated as Zero Data Retention.

The Issue #669 hardening explicitly sends `store: false` on the audited high-sensitivity/Responses paths including Research Desk, grounded Search AI, private-message AI assist, safety review, Discussion Summary, Conversation Intelligence, and The Floor analysis. This controls application-state storage for those requests; it does not by itself prove absence of provider security/abuse-monitoring logs, backups, subprocessors, or legally required retention.

Provider-side deletion APIs/workflows, DPA/addendum status, provider backup/subprocessor deletion, and exact provider human abuse-review treatment remain unverified unless separate evidence is recorded.

### Legacy Anthropic data

Anthropic was previously used for Discussion Summary fallback, safety fallback, and The Floor thesis red-team analysis. Issue #669 retires those call paths. Historical Anthropic-attributed outputs, usage records, logs, provider copies, or backups may still exist and must retain truthful historical provider attribution.

Retiring a provider credential does not establish deletion of historical provider-held data.

## Private and restricted content

A blanket statement that private messages never reach an AI provider would be false.

- Explicit private-message AI writing assist sends the member's unsent draft to OpenAI and returns the rewrite to that member.
- Covered private-message sends run the centralized safety policy, which can send message text to OpenAI after deterministic rule checks.
- AI warn/block safety events can retain bounded previews in first-party safety/audit history.
- Anthropic fallback is removed from the private-message safety path by Issue #669.

Discussion AI routes use the authenticated caller's database context. If the caller is permitted by RLS to read a restricted Discussion, its text may be processed by an explicitly invoked Discussion AI feature. The audited routes do not send Discussion attachment binaries, images, PDF bytes, or video bytes.

Grounded Search AI excludes saved results and member/private visibility results before building model context. Saved items can exist in first-party Everything Search while remaining ineligible for Ask Loombus AI processing.

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
