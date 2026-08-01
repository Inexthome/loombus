# The Floor shell audit

Date: 2026-08-01

## Audit scope

The audit covered every route below, the shared Floor components they render, all Floor API entry points, navigation reachability, nested company and analyst destinations, responsive behavior, and compatibility with Loombus Light, Dark, and System appearance.

## Route inventory

| Route | Capability preserved | New-shell placement |
| --- | --- | --- |
| `/the-floor` | Opening Bell, market snapshot, research feed, thesis composer, calls and outcomes | Overview |
| `/the-floor/dashboard` | Live research activity and research dashboard | Research Dashboard |
| `/the-floor/intelligence` | Market, macro, sector, and earnings research | Market Intelligence |
| `/the-floor/earnings` | Earnings calendar and linked Floor coverage | Earnings |
| `/the-floor/hub` | Watchlists, journal, research rooms, evidence | Research Hub |
| `/the-floor/rooms` | Collaborative research rooms | Research Rooms |
| `/the-floor/workspace` | Private structured research workspace | Workspace |
| `/the-floor/my-theses` | Thesis lifecycle and revision history | My Theses |
| `/the-floor/research-assistant` | AI research challenge and synthesis | AI Assistant |
| `/the-floor/discover` | Graph-powered discovery | Discover |
| `/the-floor/knowledge-graph` | Company, analyst, thesis, catalyst, risk, theme, and evidence graph | Knowledge Graph |
| `/the-floor/companies` | Company research directory | Companies |
| `/the-floor/company/[ticker]` | Company intelligence, cases, timeline, analysts, and discussion | Companies nested destination |
| `/the-floor/analysts` | Analyst directory | Analysts |
| `/the-floor/analyst/[memberId]` | Analyst profile, coverage, theses, and track record | Analysts nested destination |
| `/the-floor/network` | Companies, analysts, watched alerts, sessions, and replays | Network Center |
| `/the-floor/leaderboard` | Resolved-call track records | Leaderboard |
| `/the-floor/discussion` | Floor discussion feed and composer | Discussion |
| `/the-floor/academy` | Lessons, challenges, standards, and reputation education | Academy |
| `/the-floor/portfolio` | Private portfolio coverage and thesis alignment | Portfolio Intelligence |

## Findings corrected

1. The Floor used Loombus's general application chrome on nested pages, so it did not retain a distinct investing-platform identity.
2. Only the root route used `TheFloorExperience`; nested routes each opened as isolated page designs.
3. The root shell's Analysts link incorrectly routed to Academy.
4. Portfolio Intelligence, Market Intelligence, Earnings, Research Hub, Research Rooms, and Research Dashboard were not represented in the user's initial list but are active Floor capabilities and required preservation.
5. Individual company and analyst pages needed to inherit the same Floor context and active navigation state.
6. Post a thesis needed to remain persistently reachable from every Floor destination.
7. Large consumer-style cards and rounded surfaces weakened the financial-terminal character of nested tools.
8. Existing market provider limitations required explicit delayed/cached labeling and graceful unavailable states.

## Implemented shell system

- Dedicated Floor boundary that replaces general Loombus chrome only inside `/the-floor`.
- Persistent market-status tape with Eastern time, delayed-data disclosure, and available index data.
- Grouped navigation for market destinations and research tools without deleting or hiding any capability.
- Correct active state for company and analyst detail routes.
- Persistent Post a thesis action that opens the existing composer.
- Wide-screen market-watch and earnings rail.
- Responsive drawer navigation and compact mobile context header.
- Shared terminal-style surface treatment across every existing Floor component.
- Floor-specific tokens derived from Loombus appearance variables, including explicit Light and System-light adaptations.
- Existing research-only and no-house-rating disclosures retained.

## Preserved embedded capabilities

Calls, resolutions, outcomes, watchlists, research journals, collaborative items, evidence, live sessions, replays, thesis analysis, discussion replies, reputation standards, learning progress, company bull/bear cases, research timelines, and portfolio alignment remain in their existing data-backed components. The redesign changes presentation and navigation context, not the underlying feature contracts.
