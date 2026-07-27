---
title: AI and Automated Systems Notice
document_id: AI-001
status: internal-target-draft
public_ready: false
owner: AI Product, Privacy, and Trust and Safety
legal_review: required
engineering_dependency: complete AI provider and data-flow inventory
prepared: 2026-07-27
---

# AI and Automated Systems Notice

## Internal drafting notice

This document is an internal target disclosure. It must not be published until Loombus has completed a provider-by-provider data-flow inventory, verified production configurations, defined retention and training treatment, documented private-content boundaries, and established a process for correcting high-impact automated decisions.

## Purpose

Loombus uses or may use AI and automated systems to help members write, understand Discussions, find information, reduce repetitive noise, identify safety concerns, detect duplicates, rank or recommend content, and support platform operations.

These systems can be useful, but they can also be incomplete, inaccurate, biased, delayed, or misunderstood. AI output is not a guarantee of truth, professional advice, safety, neutrality, or policy compliance.

This notice should explain what systems do, what information they use, what limitations apply, and what controls or review paths are available.

## Systems in scope

The final public notice should inventory, at minimum:

- AI-assisted writing and drafting;
- pre-publication safety review;
- Discussion Summary;
- Key Takeaways;
- What Changed;
- Disagreement Map;
- Conversation Map;
- Related Ideas;
- State of the Discussion;
- Search Everything ranking and retrieval;
- Ask Loombus AI or grounded Search AI;
- Signal score and Featured Signal selection;
- recommendations and related-content systems;
- duplicate text and record screening;
- exact stored-byte media fingerprinting;
- automated account, fraud, spam, or safety signals;
- Intelligent Matching;
- administrator diagnostics and prioritization.

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

Where Ask Loombus AI is designed to use selected Search results, the response should identify the supporting Loombus sources and avoid implying that all relevant information was found.

The current product contract excludes private Room and saved-item content from grounded Search AI context. This boundary must be reverified in production before publication.

The public notice should explain:

- which source types may be included;
- whether public, restricted, or personal content can be used;
- how permissions are checked;
- whether external web sources are used;
- how citations are selected;
- that citations do not prove accuracy;
- what happens when no reliable source is available.

## Private and restricted content

Loombus must not make broad claims that private content is never processed by AI until every feature and provider flow is inventoried.

The final inventory should state, for each feature:

- whether private messages are processed;
- whether private Room content is processed;
- whether restricted Discussions are processed;
- whether attachments, images, PDFs, or Video Context are processed;
- whether prompts and outputs are stored;
- whether provider personnel may access data;
- whether data is used to train provider or Loombus models;
- whether members can opt out;
- how long data and logs are retained.

Any private-content processing must follow access controls and be disclosed accurately.

## Third-party providers

The final notice should name or categorize material AI service providers where required and explain:

- purpose of processing;
- data categories sent;
- processing location where relevant;
- retention settings;
- model-training settings;
- contractual restrictions;
- security review;
- subprocessor treatment;
- change-management process.

No provider should be described from memory or assumption. Production account settings and contracts must be checked.

## Signal score and Featured Signal

Signal systems should be explained without turning them into popularity scores or claims of objective quality.

The final documentation should identify:

- the factors used;
- factors intentionally excluded;
- whether replies, evidence, structure, freshness, safety, or activity affect the result;
- whether follower count, paid status, sponsorship, or raw popularity affect the result;
- anti-manipulation controls;
- update frequency;
- known limitations;
- whether a member can contest or report a result.

A numeric score should not be presented as a factual measurement of truth, intelligence, morality, or professional quality.

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

## Intelligent Matching

Intelligent Matching connects compatible Requests and Services through deterministic and stored scoring factors. It should not be described as professional vetting, guaranteed suitability, safety verification, or a promise that a transaction will succeed.

The notice should explain:

- match direction;
- high-level compatibility factors;
- location and remote treatment;
- confidence limitations;
- member preferences;
- save, dismiss, and feedback controls;
- that source records remain authoritative;
- that members must independently evaluate providers and opportunities.

## Safety and moderation automation

Automated systems may identify content or activity for warning, restriction, or human review. They may not understand context correctly.

The final notice should state:

- which decisions are fully automated, if any;
- which systems only create signals;
- when human review occurs;
- which high-impact decisions require human confirmation;
- what notice is provided;
- how a member can request review;
- how false positives and restoration are handled;
- how detection data is retained.

A complete universal appeals workflow is not yet implemented. The notice must not imply otherwise.

## Duplicate and media systems

Loombus duplicate systems include exact request idempotency, high-confidence record similarity, and exact stored-byte media fingerprints for selected public-platform media.

These systems do not establish:

- copyright ownership;
- plagiarism;
- original authorship;
- deceptive intent;
- perceptual similarity across edits or transcoding;
- legal liability.

Private Room media is excluded from the existing public-platform exact-media review contract.

## AI-assisted member content

Members remain responsible for content they publish, even when Loombus or another tool assisted with drafting. An AI suggestion is not approval.

Members should disclose synthetic or manipulated media where required by the AI-Generated and Manipulated Media standard. They must not use AI for impersonation, fraud, sexual exploitation, threats, doxxing, spam, or enforcement evasion.

## Professional and high-impact decisions

AI output should not replace qualified medical, legal, financial, emergency, mental-health, employment, educational, or other professional judgment.

Loombus should not use automated systems as the sole basis for high-impact decisions about a person where law or fairness requires additional review. The final policy must identify any such uses accurately.

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

1. inventory every production AI and automated system;
2. identify every provider and configuration;
3. map input, output, storage, retention, access, and training treatment;
4. verify private-message, Room, restricted-Discussion, and attachment boundaries;
5. document ranking, Signal, recommendation, and matching factors at an appropriate level;
6. distinguish automated decisions from review signals;
7. create correction and contesting pathways;
8. define teen treatment;
9. complete privacy, security, safety, product, accessibility, and legal review;
10. establish a change process for provider or model updates.