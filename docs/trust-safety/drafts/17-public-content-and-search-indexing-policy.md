---
title: Public Content and Search Indexing Policy
document_id: PS-001
status: internal-draft
public_ready: false
owner: Search Product and Privacy
legal_review: required
prepared: 2026-07-27
---

# Public Content and Search Indexing Policy

## Internal drafting notice

This is an internal policy draft. It requires verification of Search Everything, public routes, sitemaps, robots controls, person discoverability, Discussion audiences, source indexing, removal, stale-record repair, external search-engine exposure, and AI retrieval before publication.

## Purpose

Loombus helps people find Discussions, people, businesses, services, jobs, events, requests, Marketplace listings, Local results, and useful platform pages. Search should respect the difference between public, member-only, restricted, private, archived, removed, and unavailable information.

This policy should explain what may be searchable, who can search it, how source permissions remain authoritative, and what control members have over future content and profile discovery.

## Content categories

### Public content

Public content may be accessible without signing in and may be eligible for:

- Loombus Search Everything;
- public directories;
- Local Discovery;
- related-content systems;
- public sitemaps;
- indexing by external search engines;
- previews or links shared outside Loombus;
- grounded AI features where the relevant feature permits it.

Public status does not guarantee indexing, ranking, recommendation, or continued availability.

### Member-only content

Some information may be available only to signed-in Loombus members. The People directory is intended for authenticated members, not as an unrestricted public-web member directory.

Member-only content should not be placed in public sitemaps or exposed through public Search APIs.

### Restricted Discussions

Discussion audiences may include Followers, Connections, selected or custom audiences, Only me, and related restrictions. Database policies protect eligible Discussion records and related data.

Restricted Discussions should not appear to unauthorized people in Search, related content, metrics, summaries, notifications, or AI context.

Restricted Discussions are currently text-only because Discussion media uses public Storage URLs. Loombus must not claim private attachment support for restricted Discussions until private media delivery is implemented.

### Private Rooms

Private Room content, files, calendars, operations, and member workspaces should not be indexed into public Search Everything or exposed to external search engines.

Authorized Room search may index or query Room content within the membership and role boundary. Customer Support cases must preserve author, staff, and explicit participant isolation.

### Private messages and saved content

Private messages, saved items, private drafts, account settings, billing records, and personal histories should not appear in public search or grounded public Search AI.

## Source-owned eligibility

Search records are derived from source records. The source's status and authorization remain authoritative.

A record should not remain searchable when the owning source becomes:

- removed;
- archived or inactive where the module excludes it;
- expired;
- sold or completed where the module excludes it;
- private or restricted;
- associated with an unavailable or blocked account;
- outside the source's publication rules.

Search repair and rebuild operations should regenerate derived records from source-owned eligibility rather than independently changing the source.

## Profile discoverability

Members may control whether they appear in People and person Search. Disabling discoverability removes the account from normal directory and Search results, but it does not necessarily erase a direct member link, prior public content, mentions, lawful records, or administrator access.

A private account and an undiscoverable account are different:

- **Private account** controls new follower approval and normal profile access.
- **Discoverability** controls appearance in People and Search.

Public guidance should not describe either setting as complete invisibility.

## Discussion audience settings

The Future Discussion visibility setting applies when a new Discussion is created. Changing it later does not retroactively change existing Discussions.

Relationship-based audiences may change as follows, blocks, or connections change. Members should understand that an audience based on current relationships is dynamic.

## External search engines

Public Loombus pages may be crawled or indexed by external search engines. Loombus can publish sitemaps, robots directives, canonical links, and removal signals, but it cannot guarantee how quickly an external engine updates or removes a cached result.

Deleting or restricting Loombus content may not immediately remove:

- search-engine caches;
- screenshots;
- browser caches;
- links or copies shared by other people;
- lawful archives;
- third-party records outside Loombus control.

The final public policy should provide realistic instructions for requesting source removal from Loombus and, where necessary, contacting the external search provider.

## Search ranking

Search ranking may use factors such as:

- query relevance;
- source type;
- freshness;
- location or remote compatibility;
- availability or lifecycle state;
- structured metadata;
- permissions and account standing;
- safety eligibility;
- source-specific quality signals.

Loombus should disclose the main categories without exposing formulas that enable manipulation or security evasion.

Search ranking should not be described as a determination of truth, professional quality, legality, safety, or endorsement.

## Local Discovery

Local Discovery uses public source records and approximate location anchors. Public responses should not reveal stored latitude or longitude.

Members should understand:

- distance may be approximate;
- business locations may be inherited by connected records;
- remote and local availability are separate signals;
- location does not verify ownership, licensing, safety, or quality;
- personal residential points should not be exposed.

## Search Everything and Ask Loombus AI

Search Everything may return multiple source types. Access-controlled results must be filtered according to the viewer's permissions.

Ask Loombus AI, where available, should use only authorized source context and should provide grounded links or citations. It may still be inaccurate or incomplete.

The current grounded AI boundary excludes private Room and saved-item content. That boundary must be reverified across production providers and code before public release.

## Search integrity

Members may not manipulate Search through:

- keyword stuffing;
- misleading titles, categories, locations, or tags;
- duplicate records;
- fake engagement;
- coordinated queries or clicks;
- hidden redirects;
- impersonation;
- deceptive business or professional claims;
- automation that violates platform rules.

Loombus may remove derived records, repair indexes, restrict eligibility, or enforce against the source account without changing lawful source content unnecessarily.

## Removal and correction

The proper correction path depends on the source:

- edit or delete the owning Discussion or profile where permitted;
- update the Business, Service, Job, Event, Request, or listing through its management workflow;
- change account discoverability for person Search;
- change future Discussion visibility for future posts;
- report an unauthorized or unsafe record;
- request index repair when the source state and Search state disagree.

Search administrators should not alter source facts from the Search operations console. They should rebuild or repair the derived record from the authoritative source.

## Blocking and search

Blocks should prevent supported person and content discovery between affected accounts where the product contract specifies it. Blocking does not necessarily remove public content from all unrelated viewers, external search engines, legal records, or administrator tools.

## Retention

Search indexes are derived data, but retention and deletion must still be defined. The platform-wide retention schedule should address:

- removed and stale search records;
- query and click logs;
- recent searches stored on device;
- AI prompts and grounded results;
- index repair history;
- administrator audit records;
- external search-engine caches outside Loombus control.

The complete schedule is not yet established.

## Possible enforcement

Loombus may:

- exclude or remove content from Search or recommendations;
- repair or rebuild derived records;
- restrict duplicate or deceptive sources;
- remove misleading metadata;
- suspend Search, listing, or account privileges;
- preserve integrity and audit records.

## Publication blockers

Before publication, Loombus must:

1. inventory every indexed source and visibility rule;
2. verify person discoverability and block filtering;
3. verify restricted Discussion and private Room exclusion;
4. confirm public sitemaps, robots, and canonical behavior;
5. document grounded AI sources and provider flows;
6. define query, click, index, and AI retention;
7. establish stale and orphan repair operations;
8. create external search-removal guidance;
9. complete privacy, Search, AI, legal, and accessibility review.