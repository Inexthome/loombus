---
title: AI and Automated Systems Notice
document_id: AI-001
status: internal-target-draft
public_ready: false
owner: AI Product, Privacy, and Trust and Safety
legal_review: required
engineering_dependency: complete AI provider and data-flow inventory
prepared: 2026-07-27
implementation_evidence_updated: 2026-08-08
---

# AI and Automated Systems Notice

## Internal drafting notice

This document is an internal target disclosure. It must not be published until Loombus has completed a provider-by-provider data-flow inventory, verified production configurations, defined retention and training treatment, documented private-content boundaries, and established a process for correcting high-impact automated decisions.

Authoritative engineering evidence for the current implementation is maintained in:

- `docs/trust-safety/implementation/ai-system-registry.json`
- `docs/trust-safety/implementation/ai-automated-systems-inventory.md`

The registry and engineering inventory do not replace legal/privacy review of this public-facing notice.

## Current verified implementation facts

As of the 2026-08-08 Issue #669 audit and migration:

- active external LLM processing is being standardized on **OpenAI only**;
- Anthropic is retired from new Summary fallback, safety fallback, and The Floor red-team generation; historical Anthropic-attributed records may remain and must keep truthful provenance;
- the inspected OpenAI production project is `Loombus Production`, geography `Global`;
- OpenAI model-feedback, evaluation/fine-tuning, and API input/output sharing controls are disabled;
- API call logging is enabled per call;
- the project Data retention UI shows `None`, which is **not** treated as evidence of Zero Data Retention;
- Zero Data Retention and Modified Abuse Monitoring were not shown and are not claimed;
- covered private-message text can reach OpenAI through explicit writing assist and automatic send-time safety review;
- grounded Search AI explicitly excludes saved results and member/private visibility results from model context;
- audited provider-backed routes use text/structured-text context rather than Discussion attachment binaries, image bytes, PDF bytes, or video bytes;
- the centralized AI safety path is an automatic content-level decision and fails closed if provider classification is unavailable;
- The Floor call-resolution automation remains human-confirmed before a public outcome is stamped.

These facts can support drafting but must still survive deployed-environment verification and legal/privacy review before publication.

## Purpose

Loombus uses or may use AI and automated systems to help members write, understand Discussions, find information, reduce repetitive noise, identify safety concerns, detect duplicates, rank or recommend content, and support platform operations.

These systems can be useful, but they can also be incomplete, inaccurate, biased, delayed, or misunderstood. AI output is not a guarantee of truth, professional advice, safety, neutrality, or policy compliance.

This notice should explain what systems do, what information they use, what limitations apply, and what controls or review paths are available.

## Systems in scope

The final public notice should inventory, at minimum:

- AI-assisted writing and drafting;
- pre-publication and send-time safety review;
- Discussion Summary;
- Key Takeaways;
- What Changed;
- Disagreement Map;
- Conversation Map;
- Related Ideas;
- Conversation Intelligence and State of the Discussion presentation;
- Search Everything ranking and retrieval;
- Ask Loombus AI or grounded Search AI;
- Signal score and Featured Signal selection;
- recommendations and related-content systems;
- duplicate text and record screening;
- exact stored-byte media fingerprinting;
- automated account, fraud, spam, or safety signals;
- Intelligent Matching;
- The Floor research and call-resolution automation;
- administrator research and diagnostics tools.

The notice must distinguish machine-generated output from rules-based automation and deterministic scoring.

## What AI outputs mean

AI-generated summaries, maps, recommendations, and writing suggestions are derived interpretations. They may:

- omit important context;
- overstate agreement or disagreement;
- misattribute a claim;
- fail to recognize sarcasm, culture, identity, or specialized language;
- rely on incomplete or outdated sources;
- generate unsupported statements;
- reflect bias in models, prompts, data, or product design;
- produce different results at different times.

Members should review original Discussions, Replies, records, and cited sources before relying on an AI output.

## Grounded Search AI

Where Ask Loombus AI uses selected Search results, the response should identify the supporting Loombus sources and avoid implying that all relevant information was found.

The current implementation excludes saved-item results and member/private visibility results from grounded Search AI context before model processing. Saved items can remain available in first-party Everything Search while being ineligible for AI grounding. Private/member-scoped Room material is excluded by the same AI-context visibility boundary. This code contract must still be exercised against the deployed environment before publication.

Ask Loombus AI organizes supplied Loombus search results. It must not be described as independently searching the open web. Research Desk is a separate administrator workflow that can use OpenAI web search.

The public notice should explain:

- which source types may be included;
- whether public, restricted, or personal content can be used;
- how permissions are checked;
- whether external web sources are used by the particular feature;
- how citations are selected;
- that citations do not prove accuracy;
- what happens when no reliable source is available.

## Private and restricted content

Loombus must not claim that private messages are categorically excluded from AI processing.

Current verified private-message processing includes:

- **AI writing assist**: when an eligible member explicitly invokes writing assistance, the unsent private-message draft is sent to OpenAI and the rewrite is returned to that member. The member chooses whether to use or send it.
- **send-time safety review**: covered private-message text runs deterministic safety checks and then the centralized OpenAI classifier before storage/sending. AI warn/block safety events can retain a bounded preview in Loombus safety/audit history.

The active Anthropic fallback is removed from the safety path. If OpenAI classification is unavailable, the Issue #669 implementation fails closed rather than silently allowing covered content through.

Discussion AI routes use the authenticated caller's data-access context. If the caller can read a restricted Discussion through applicable access controls/RLS, that Discussion text may be processed when the member explicitly invokes a Discussion AI feature. This is permission-bound processing, not a public-only guarantee.

The current provider-backed routes audited for Issue #669 do not send Discussion attachment binaries, images, PDF bytes, or Video Context bytes to the LLM. A future media-capable AI feature would require a registry and policy update before this statement could remain accurate.

The final inventory should state, for each feature:

- whether private messages are processed;
- whether private Room content is processed;
- whether restricted Discussions are processed;
- whether attachments, images, PDFs, or Video Context are processed;
- whether prompts and outputs are stored by Loombus;
- which provider-side logging/storage controls apply;
- whether provider personnel may access data under applicable abuse, support, or security processes;
- whether data is shared for provider model improvement;
- whether members can opt out or avoid the feature;
- how long first-party data and logs are retained.

Any private-content processing must follow access controls and be disclosed accurately.

## Third-party providers

The active external LLM provider in the Issue #669 target architecture is OpenAI. Anthropic is a legacy provider for historical requests and is not intended to receive new production requests after the migration is deployed.

Verified OpenAI account-side settings should be described narrowly:

- `Loombus Production` project;
- `Global` geography;
- feedback/evaluation/input-output sharing disabled;
- API call logging enabled per call;
- project Data retention UI `None`;
- no verified ZDR or Modified Abuse Monitoring configuration.

The public notice must not state or imply that `None` means Zero Data Retention. It also must not claim provider-side deletion, backup deletion, human-review exclusion, DPA terms, or subprocessor treatment without separate supporting evidence.

Material provider disclosures should explain:

- purpose of processing;
- data categories sent;
- processing location where relevant;
- verified retention/logging settings;
- model-improvement/data-sharing settings;
- contractual restrictions where verified;
- security review;
- subprocessor treatment where verified;
- change-management process.

No provider should be described from memory or assumption. Production account settings and contracts must be checked.

## Signal score and Featured Signal

Signal systems should be explained without turning them into popularity scores or claims of objective quality.

The current audited discussion Signal Score formula is:

`replies * 3 + bookmarks * 5 + views`

It is an activity/signal measure. It is not a factual measurement of truth, intelligence, morality, expertise, or professional quality.

The final documentation should identify:

- the factors used;
- factors intentionally excluded;
- where the score affects presentation or ranking;
- anti-manipulation controls;
- update frequency;
- known limitations;
- whether a member can contest or report a result.

Paid status or sponsorship must not be described as a Signal factor unless the implementation actually changes to include it.

## Recommendations and ranking

Recommendations may consider relevance, topic, relationships, recency, location, availability, activity, safety eligibility, and member choices, depending on the feature.

Loombus should disclose the main categories of signals rather than exposing security-sensitive formulas that would enable manipulation.

Members should be able to understand:

- why an item may appear;
- how to hide, save, dismiss, block, or report it;
- whether paid placement exists;
- whether private data affects the result;
- whether teens receive different treatment;
- how account and content restrictions affect eligibility.

Everything Search ranking is deterministic. An external LLM is involved only when an eligible member separately invokes Ask Loombus AI.

## Intelligent Matching

Intelligent Matching connects compatible Requests and Services through deterministic and stored scoring factors. It should not be described as professional vetting, guaranteed suitability, safety verification, or a promise that a transaction will succeed.

The current audited factors include category, text overlap, service mode, location, budget, timing, member preferences/rules, account standing, and block relationships.

The notice should explain:

- match direction;
- high-level compatibility factors;
- location and remote treatment;
- confidence limitations;
- member preferences;
- pause/threshold/rule controls;
- save, dismiss, restore, and feedback controls;
- that source records remain authoritative;
- that members must independently evaluate providers and opportunities.

This system is classified as signal-only, not an automatic professional or eligibility determination.

## Safety and moderation automation

Automated systems may identify content or activity for warning, restriction, or human review. They may not understand context correctly.

Current centralized covered-content safety uses deterministic rules followed by an OpenAI text classifier. It can automatically allow, warn, or block content at the content-send/publication layer. Provider-classification unavailability fails closed in the Issue #669 target implementation. This does not mean the classifier automatically suspends or terminates accounts.

The final notice should state:

- which decisions are fully automated;
- which systems only create signals;
- when human review occurs;
- which high-impact decisions require human confirmation;
- what notice is provided;
- how a member can request review where available;
- how false positives and restoration are handled;
- how detection data is retained.

A complete universal appeals workflow is not yet implemented. The notice must not imply otherwise.

## Duplicate and media systems

Loombus duplicate systems include exact request idempotency, deterministic record similarity, and exact stored-byte media fingerprints for selected public-platform media.

These systems do not establish:

- copyright ownership;
- plagiarism;
- original authorship;
- deceptive intent;
- perceptual similarity across edits or transcoding;
- legal liability.

Private Room media is excluded from the existing public-platform exact-media review contract.

## The Floor automated systems

### Thesis red-team analysis

The Floor thesis analysis is an assistive critique, not an investment rating. The Issue #669 migration moves this generation from Anthropic to OpenAI. The output schema contains only a steelman, red-team critique, and blind spots and does not provide a rating/recommendation field. The prompt also prohibits buy/sell/hold recommendations and price targets.

### Research Assistant

The currently audited Floor Research Assistant is deterministic synthesis of member-published thesis/call records rather than a separate LLM investment-rating system.

### Calls resolver

The scheduled resolver uses Twelve Data market prices to create a candidate outcome proposal. It does not directly stamp the public falsifiable-call outcome. An administrator must approve, override, or reject the proposal.

Decision class: human-confirmed.

## AI-assisted member content

Members remain responsible for content they publish, even when Loombus or another tool assisted with drafting. An AI suggestion is not approval.

Members should disclose synthetic or manipulated media where required by the AI-Generated and Manipulated Media standard. They must not use AI for impersonation, fraud, sexual exploitation, threats, doxxing, spam, or enforcement evasion.

## Professional and high-impact decisions

AI output should not replace qualified medical, legal, financial, emergency, mental-health, employment, educational, or other professional judgment.

Loombus should not use automated systems as the sole basis for high-impact decisions about a person where law or fairness requires additional review. The final policy must identify any such uses accurately.

The current inventory classifies:

- content safety allow/warn/block as an **automatic content-level decision**;
- The Floor market-call resolution as **human-confirmed**;
- Signal Score, Conversation Intelligence candidate ranking, Intelligent Matching, and similar relevance/scoring systems as **signal-only** or automatic ranking rather than authoritative personal judgments.

## Member feedback and correction

The mature product should provide ways to:

- report an incorrect or unsafe AI output;
- correct source content through the source-owned workflow;
- contest eligible automated restrictions;
- provide relevance feedback;
- dismiss or hide recommendations;
- understand whether a result is generated, ranked, or selected automatically.

Feedback does not guarantee an immediate model or ranking change.

## Security and manipulation

Members may not probe, exploit, reverse engineer, poison, or manipulate AI and automated systems to:

- expose private information;
- bypass access controls;
- generate prohibited content;
- manipulate ranking or Signal;
- obtain system prompts, secrets, credentials, or protected logic;
- automate fraud, harassment, spam, or account abuse.

Good-faith security research should use an approved reporting channel when one exists.

## Publication blockers

Before publication, Loombus must:

1. complete and validate every production AI and automated-system registry entry;
2. verify every active provider and production configuration;
3. map input, output, first-party storage, provider logging/retention, access, and model-improvement treatment;
4. exercise private-message, Room, restricted-Discussion, saved-item, and attachment boundaries in the deployed environment;
5. document ranking, Signal, recommendation, and matching factors at an appropriate level;
6. distinguish automated decisions from review signals and human-confirmed decisions;
7. document available correction/contesting pathways without implying a universal appeal system;
8. define teen treatment;
9. complete privacy, security, safety, product, accessibility, and legal review;
10. establish and operate the registry/CI change process for provider, model, prompt, and material data-flow updates;
11. verify any contractual/DPA, provider deletion, backup, human-review, or subprocessor statement before making it public.
