# Loombus V2 Screenshot Shell Build Plan

This plan resets V2 direction around the approved screenshots.

## Product direction

V2 is not a separate backend product. V2 is the new Loombus shell and user experience built over the working V1 engine.

The screenshots are the visual source of truth for:

- V2 Home
- V2 Discussions
- V2 Discussion Detail
- V2 Create
- V2 Rooms
- V2 Messages

## Implementation rule

Use existing V1 data and working systems wherever possible:

- `discussions`
- `replies`
- `discussion_views`
- `bookmarks`
- `profiles`
- `messages`
- notifications
- saved folders
- AI tools
- reports/moderation

Only create new tables when the screenshot feature requires something V1 does not support.

## Current correction

`/v2/discussions` should be a screenshot-style discussion feed powered by real V1 discussion data. It should not be limited to isolated `loombus_v2_discussions` preview records.

The V2 preview storage table can remain as an internal sandbox, but it is not the main V2 shell path.

## Build sequence

1. V2 Discussions shell using real V1 discussion data.
2. V2 Discussion Detail shell using real V1 discussion, replies, saves, views, and AI tools.
3. V2 Create shell using the existing V1 create engine and validation.
4. V2 Home shell polish to match the dashboard screenshot.
5. V2 Messages shell using existing message data.
6. V2 Rooms shell as a new feature area or staged placeholder.
7. Shared V2 top navigation and mobile bottom navigation.
8. Full internal test pass before any public route switch.

## Release rule

Do not switch `/create`, `/discussions`, `/discussions/[id]`, or public navigation to V2 until Saint has tested the complete V2 shell and approved release.
