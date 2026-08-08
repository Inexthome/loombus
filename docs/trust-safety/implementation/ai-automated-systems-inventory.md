# AI and automated systems inventory

Status: internal implementation evidence for Issue #669. This is not the public AI Notice.

Evidence date: 2026-08-08

Machine-readable source of truth: `docs/trust-safety/implementation/ai-system-registry.json`

Verification: `node scripts/verification/verify-ai-system-registry.mjs`

## Production provider posture

Loombus is standardizing active external LLM processing on **OpenAI only**. Anthropic is retired by Issue #669 from new production generation and fallback paths. Historical Anthropic-attributed outputs, provider copies, usage records, logs, and provenance may still exist and must not be relabeled as OpenAI.

Owner-supplied OpenAI API Platform evidence verified on 2026-08-08 establishes:

- production project: `Loombus Production`
- project geography: `Global`
- project Data retention UI: `None`
- API call logging: `Enabled per call`
- model-feedback sharing: disabled
- evaluation/fine-tuning sharing: disabled
- API input/output sharing: disabled
- `OPENAI_API_KEY`: active in the production project; last-used evidence observed 2026-08-07
- Zero Data Retention: not shown and therefore not claimed
- Modified Abuse Monitoring: not shown and therefore not claimed

`Data retention: None` is **not** evidence of Zero Data Retention. The public policy must not convert it into a ZDR claim.

The inspected account configuration also does not establish a provider deletion workflow, contractual DPA/addendum status, provider backup deletion, subprocessor treatment, or the exact circumstances of provider human abuse review. Those remain separate evidence requirements.

## Anthropic retirement

Issue #669 removes the three active Anthropic paths identified in the repository audit:

1. Discussion Summary fallback after OpenAI failure.
2. AI safety fallback after OpenAI failure.
3. The Floor thesis red-team analysis direct Claude call.

After this migration:

- Discussion Summary is OpenAI-only.
- AI safety is OpenAI-only and fails closed if provider classification is unavailable.
- The Floor red-team analysis uses OpenAI.
- `src/lib/anthropic-ai.ts` is removed.
- Admin Health no longer treats Anthropic as an active production provider.
- CI rejects new executable `api.anthropic.com`, `ANTHROPIC_API_KEY`, `ANTHROPIC_FALLBACK_MODEL`, or `@/lib/anthropic-ai` references under `src/`.

Anthropic credentials should be removed from Vercel only **after** the migration PR is merged, deployed, and production behavior is verified.

## Private-message treatment

A public statement that private messages are categorically excluded from AI processing would be false.

Private-message text can reach OpenAI in two bounded ways:

1. **Writing assist**: a Premium Plus member explicitly invokes AI assistance on an unsent message draft. The draft text is sent to OpenAI and the rewritten text is returned to the requesting member. The route does not intentionally persist the draft or rewrite body and now records metadata-only usage provenance in `ai_usage_events`.
2. **Safety review**: covered private-message sends run deterministic safety checks first, then the centralized OpenAI safety classifier. AI warn/block safety events can retain a bounded content preview in Loombus safety/audit history.

The Anthropic safety fallback is removed. Private-message safety input is now explicitly labeled `private_message` rather than being represented to the classifier as a generic reply.

## Restricted Discussion treatment

Discussion AI routes read the requested Discussion and replies through the authenticated caller's Supabase context. If RLS permits that caller to read a restricted Discussion, its text may be included in an explicitly invoked Discussion AI feature. This must be disclosed as permission-bound processing, not as a public-only guarantee.

The audited provider routes use text/structured-text context. They do not send Discussion attachment binaries, images, PDF bytes, or video bytes to the LLM in the current implementation.

## Grounded Search AI privacy boundary

Ask Loombus AI is a second stage after deterministic Everything Search. It does not independently browse the open web.

Before AI context is built:

- Everything Search applies viewer/account/permission and block filtering.
- teen-safety filtering runs.
- results with `visibility === "member"` or `visibility === "private"` are excluded.
- `type === "saved"` is also excluded explicitly as defense in depth, even if a future indexing change were to assign a saved item an incorrect broader visibility.

Saved-item search results may contain private notes in first-party search UI, but they are marked `private` and are not eligible for Ask Loombus AI grounding. Private/member-scoped Room material is also excluded from AI context by the visibility boundary.

This is a code-level verified contract. The release checklist for the consolidated #669 PR must also exercise it against the deployed preview/production configuration before the public AI Notice relies on it.

## OpenAI request-storage controls

Issue #669 explicitly sets `store: false` on the highest-sensitivity and Responses API paths audited in this phase, including:

- Research Desk Responses API + web search
- Ask Loombus AI
- Discussion Summary
- Conversation Intelligence
- private-message AI assist
- centralized AI safety review
- The Floor thesis red-team analysis

Other existing Chat Completions routes are inventoried individually and remain subject to the OpenAI organization/project logging and abuse-monitoring configuration described above. The drift check protects the critical contracts and the registry records each route's current storage-control status.

## Provider-backed systems

The registry contains the authoritative per-system fields. The active provider-backed families are:

- Research Desk AI draft generation
- Ask Loombus AI / grounded Search AI
- Discussion Summary
- Key Takeaways
- What Changed
- Disagreement Map
- Conversation Map
- Related Ideas
- Conversation Intelligence
- Reply Suggestions
- Discussion Quality Check
- Discussion Clarity Rewrite
- private-message AI writing assist
- centralized AI content safety review
- The Floor thesis red-team analysis

`State of the Discussion` is a product presentation layer over these discussion-intelligence outputs rather than evidence of an additional provider by itself. A new direct model call added under that label would require a new registry entry.

## First-party AI persistence

The audit found feature-specific persistence rather than one universal prompt/output/trace table:

| Record | Purpose | Content treatment |
|---|---|---|
| `discussion_summaries` | cached Discussion Summary | generated summary plus source hash/count/model metadata |
| `discussion_ai_outputs` | cached discussion intelligence outputs | generated output plus feature/model/source hash/count metadata |
| `ai_usage_events` | AI operational/usage provenance | provider, model, feature, target, success/cache/token/cost/error metadata; not intended as a prompt/output body store |
| `ai_output_ratings` | member feedback on supported AI outputs | member rating linked to output/feature |
| Research Desk publication/provenance records | human-reviewed research publication chain | model/provider/prompt version and approval evidence where implemented |
| `floor_thesis_analyses` | The Floor red-team analysis | steelman/red-team/blind-spots result linked to thesis |
| safety/audit events | moderation and safety evidence | bounded previews can be retained for warn/block events, including private-message mode |

There is no claim that provider logs, security copies, backups, or subprocessors are deleted merely because a first-party record is deleted.

## Automated systems that are not LLMs

The inventory deliberately distinguishes deterministic automation from AI model calls.

### Signal Score

Current audited discussion-card formula:

`replies * 3 + bookmarks * 5 + views`

It is a signal/activity measure, not a factual measurement of truth, intelligence, morality, expertise, or professional quality.

Decision class: **signal-only**.

### Conversation Intelligence candidate ranking

A security-invoker database function deterministically ranks visible replies using direct response activity and reaction signals before a bounded set is sent to OpenAI.

Decision class: **signal-only preselection**.

### Everything Search

Intent classification, relevance/ranking, permission filtering, and result assembly are deterministic. An external LLM is involved only after the member explicitly invokes Ask Loombus AI.

Decision class: **automatic ranking**, not a high-impact personal decision.

### Intelligent Matching

Request-Service matching is deterministic and considers category, text overlap, service mode, location, budget, timing, member preferences/rules, account standing, and block relationships. Members can pause matching, change thresholds/rules, save/dismiss/restore candidates, and submit feedback.

Decision class: **signal-only**. A match is not professional vetting or guaranteed suitability.

### Duplicate detection

Current duplicate systems use normalization/fingerprints, text similarity, and type-specific identity/location/media-path checks. They are not perceptual copyright detection and do not establish plagiarism, authorship, ownership, or deceptive intent.

Decision class: **signal-only / feature guard**, not a legal determination.

### The Floor Research Assistant

Current audited Research Assistant behavior is deterministic synthesis from member-published Floor thesis/call data, not a model-generated investment rating.

Decision class: **signal-only**.

### The Floor calls resolver

The scheduled resolver uses Twelve Data market prices to create a candidate correct/incorrect proposal. It does not stamp the public call outcome. An administrator must approve, override, or reject the proposal.

Decision class: **human-confirmed**.

## High-impact and automatic decision classification

The AI safety classifier can automatically prevent covered content from being published or sent. Deterministic safety rules run first. If OpenAI classification is unavailable, the Issue #669 implementation fails closed rather than silently allowing content. This is an automatic content-level decision, not an automatic account suspension/termination decision.

The Floor calls resolver is human-confirmed before a public accountability outcome changes.

Signal Score, matching, candidate ranking, and related deterministic rankings are signal-only or ranking systems and must not be described as authoritative judgments about a person.

## Change management

The machine-readable registry and CI check create an engineering gate for provider drift. The check:

- rejects active Anthropic source references;
- verifies critical OpenAI-only/privacy contracts;
- verifies saved/private Search AI exclusions;
- verifies explicit private-message/profile safety content types;
- verifies registry source paths;
- verifies active `OPENAI_*` variables are documented in `.env.example`.

Any new provider, new direct AI route, provider/model change, prompt contract change, change in private/restricted data treatment, or material automated-decision change requires:

1. registry update;
2. privacy/trust-and-safety review appropriate to the feature;
3. public AI Notice review if the disclosed behavior changes;
4. validation in the deployed environment before public claims are updated.

## Remaining non-engineering evidence gates

Issue #669 can establish the engineering inventory without pretending that every policy publication gate is complete. The following remain external/legal/operational evidence items unless separately supplied:

- OpenAI DPA or other contractual addendum status;
- provider-side deletion workflow and deletion verification;
- provider backup/subprocessor treatment beyond verified account settings;
- exact provider human abuse-review treatment under this account;
- legal review of the public AI and Automated Systems Notice;
- final production smoke verification of privacy boundaries after the consolidated PR is deployed.
