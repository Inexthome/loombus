# Loombus Editorial UI

## Purpose

The **Loombus Editorial UI** is the canonical interaction and visual language for focused Loombus pages where users read, write, review, classify, discuss, research, or make structured decisions.

It is designed to feel like an editorial workspace rather than a generic dashboard. The interface should emphasize ideas, text, evidence, hierarchy, and action clarity while reducing ornamental UI chrome.

When a task says **“Use the Loombus Editorial UI”**, this document is the governing design specification unless a page has a documented exception.

## Canonical References

Use the current implementations of these routes as the primary visual and behavioral references:

- `/create`
- `/discussions/[id]`

`/create` is the strongest reference for flat composition flows, field rhythm, integrated tools, and restrained actions.

`/discussions/[id]` is the strongest reference for editorial reading hierarchy, structured metadata, discussion surfaces, reply composition, and interaction density.

Do not copy either page mechanically. Apply the system principles to the target page while preserving that page's own information architecture and functionality.

## Core Design Principles

### 1. Editorial before dashboard

Pages should read as structured editorial documents and workspaces, not collections of unrelated widgets.

Prefer:

- clear reading order
- strong typographic hierarchy
- thin dividers
- flat sections
- deliberate whitespace
- restrained controls
- one dominant working surface

Avoid defaulting to:

- grids of large dashboard cards
- excessive boxed modules
- multiple competing primary actions
- decorative shadows on every section
- oversized empty space
- heavy visual chrome around simple content

### 2. Structure through hierarchy, not decoration

Use typography, spacing, alignment, and dividers as the first tools for creating structure.

Cards are allowed only when the content is genuinely a discrete object that benefits from containment. Do not wrap every field or section in a rounded card simply to separate it visually.

### 3. Signal over noise

Every visible element should help the user understand, compose, evaluate, or act on the content.

Secondary controls should be visually quieter than the content they support.

If several controls have equal visual weight but unequal importance, reduce the weight of the secondary controls.

### 4. One primary task per surface

Each page should make its primary job obvious.

Examples:

- `/create`: compose and publish a discussion
- `/discussions/[id]`: read and participate in a discussion

Supporting actions should remain accessible without competing with the primary task.

## Page Architecture

### Working width

Use a focused editorial column for primary work rather than allowing forms and text to stretch across the full viewport.

The width should support comfortable reading and composition. Wide desktop layouts may include contextual rails, but the main content should remain visually dominant.

### Section flow

Prefer a continuous vertical sequence:

1. page header
2. compact metadata/classification
3. primary fields or content
4. main working surface
5. evidence/supporting material
6. secondary actions
7. primary completion action

Do not break this sequence into unrelated dashboard panels unless the task genuinely requires parallel workspaces.

### Dividers

Thin borders using the Loombus border token are the default separation mechanism between adjacent sections.

Use dividers consistently to create rhythm without adding visual mass.

## Typography

### Page titles

Page titles should be prominent but not oversized merely for spectacle.

Use strong hierarchy and tight tracking where appropriate.

### Section labels

Section labels should be compact, clear, and usually stronger than supporting text.

Avoid making every label extra-bold. Reserve the heaviest weight for moments that need emphasis.

### Body copy

Editorial content should prioritize readability:

- comfortable line height
- controlled line length
- strong contrast
- minimal interference from surrounding controls

### Secondary text

Descriptions, counts, timestamps, helper copy, and status text should use muted Loombus text tokens and lower visual weight.

## Color

Use existing Loombus theme tokens wherever possible.

Gold is an accent, not a fill color for the entire interface.

Use Loombus gold primarily for:

- active states
- selected emphasis
- important status accents
- primary actions
- focused interactive details

Do not flood large surfaces with gold.

Light mode may use the established warm editorial page background used by `/create` where appropriate. Dark mode should use the normal Loombus dark page and surface tokens.

## Surfaces

### Flat sections

Flat sections are preferred for forms, settings within a flow, metadata, and composition tools.

Use borders and spacing rather than a separate raised container for each row.

### Cards

Cards are appropriate when representing a discrete entity or object, such as:

- a discussion post
- a reply
- an attachment preview
- a result or record that must stand independently

When cards are used, their radius, shadow, and padding should match the restrained Loombus discussion-detail system rather than generic dashboard styling.

### Shadows

Shadows should be rare and purposeful. They may distinguish major floating or discrete surfaces, but should not appear on every field, row, or control.

## Form and Field Treatment

### Field rows

Fields should normally appear as part of the page flow rather than individual cards.

A standard field row should use:

- compact label
- optional marker where needed
- simple input treatment
- thin divider or underline
- muted helper copy

### Required fields

Use a restrained required indicator. Do not overemphasize required status unless validation has failed.

### Optional fields

Mark optional fields clearly but quietly.

### Inputs

Inputs should not default to large rounded boxes when a flat editorial field works better.

Focus states must remain visible and accessible.

## Classification and Metadata Controls

Topic, mode, lens, category, filter, and similar controls should be compact.

Prefer short inline controls, pills, or low-height selectors near the relevant content.

Avoid converting a small metadata choice into a large segmented dashboard strip.

If a selector opens additional options, the trigger should remain visually restrained and the resulting panel should preserve clear hierarchy.

## Integrated Working Surfaces

When several tools operate on the same piece of content, they should usually live inside one working surface rather than separate full-size panels.

The `/create` composer is the canonical example:

- Write
- Review
- Check Quality
- Improve structure

These are different modes of the same composition task, not four unrelated products.

Use this principle for other pages when appropriate.

## Tabs

Tabs should be compact and text-led.

The active tab should be clear through text color and a restrained Loombus-gold indicator.

Avoid oversized pill tabs or heavy filled navigation unless required by a different established Loombus pattern.

Tabs should not create unnecessary layout jumps.

## Actions and Buttons

### Primary actions

Use one obvious primary action for the page's main completion step.

Examples:

- Publish
- Save changes
- Submit
- Continue

Primary actions may use Loombus gold but should remain proportionate to the surrounding interface.

### Secondary actions

Secondary actions should generally be quieter:

- text buttons
- icon + text controls
- subtle bordered controls
- inline footer actions

Examples from `/create` include Save draft, Clear, and Add files / evidence.

### Destructive actions

Destructive actions should be visually distinguishable when necessary but should not dominate until the user enters a destructive flow.

### Disabled controls

Do not leave an important control appearing mysteriously unwired. If an action cannot proceed because of policy or state, prefer a responsive control that explains the restriction when appropriate rather than a silent dead-end.

## Composer Pattern

For text-heavy creation or response surfaces:

- keep the content editor central
- keep supporting tools adjacent or integrated
- use readable line height
- avoid excessive editor chrome
- keep helper text restrained
- expose evidence/attachment actions near the composition flow
- preserve drafts where the product supports them

The composer should feel like a place to think and write, not a generic textarea embedded in a dashboard.

## Evidence and Attachments

Evidence should be treated as part of the intellectual workflow, not merely generic file upload chrome.

Use clear labels such as **Add files / evidence** when that reflects the purpose of the attachment.

Staged evidence should appear close to the working surface and before the final completion action when practical.

Attachment rows should be compact, readable, removable, and consistent with discussion-detail attachment treatment.

## Review and Quality Tools

Review, quality checks, AI assistance, structure improvement, summaries, or other analysis tools should not automatically become separate dashboard cards.

If they operate on the same content, keep them inside the same editorial work context whenever possible.

Results should emphasize:

- what is ready
- what needs attention
- what changed
- what the user can do next

Do not overwhelm the user with decorative AI UI.

## Modals and Panels

Use overlays for focused selections or secondary workflows that should not permanently consume page space.

Examples:

- choosing a topic
- choosing a discussion mode
- viewing draft guidance

Panels should:

- have a clear title
- have an obvious close action
- use Loombus surface and border tokens
- work on mobile as bottom-oriented sheets where appropriate
- avoid excessive nested cards

## Mobile Behavior

The Loombus Editorial UI must remain fully functional on mobile.

On narrow screens:

- reduce padding before reducing readability
- allow compact horizontal controls to scroll when necessary
- stack footer actions when space requires it
- preserve a full-width primary action when beneficial
- maintain minimum touch targets
- respect safe areas
- avoid horizontal page overflow

Do not reproduce desktop density by shrinking text to unusable sizes.

## Accessibility

Every implementation using the Loombus Editorial UI should preserve:

- semantic headings
- visible keyboard focus
- keyboard-operable controls
- adequate contrast
- descriptive labels
- accessible modal behavior
- appropriate ARIA only where native semantics are insufficient
- minimum practical touch targets
- reduced-motion behavior where motion exists

Accessibility is part of the design system, not a later polish pass.

## Interaction Feedback

Users should receive clear feedback for:

- saving
- loading
- autosaving
- validation
- upload staging
- upload failure
- publishing/submitting
- completion
- policy restrictions

Feedback should be concise and placed near the relevant workflow.

Avoid silent failures and controls that appear to do nothing.

## What the Loombus Editorial UI Is Not

The following are not the default Loombus Editorial UI pattern:

- a generic SaaS admin dashboard
- a grid of oversized cards for every field
- heavy glassmorphism
- excessive gradients
- large decorative shadows everywhere
- excessive border radii
- giant CTA strips
- multiple equally dominant actions
- ornamental AI panels detached from the user's work
- excessive whitespace that increases scrolling without improving comprehension
- visual complexity added only to make a page look "designed"

## Migration Guidance for Existing Pages

When redesigning an existing Loombus page into the Loombus Editorial UI:

1. Audit the current page before changing it.
2. Preserve working business logic unless the task explicitly includes behavior changes.
3. Identify the page's single primary job.
4. Establish a clear editorial reading/action order.
5. Remove unnecessary card wrappers and dashboard chrome.
6. Flatten related fields and controls into coherent sections.
7. Consolidate tools that operate on the same content.
8. Reduce secondary action weight.
9. Keep one clear primary completion action.
10. Verify desktop, mobile, light mode, dark mode, keyboard navigation, loading states, empty states, validation, and error states.

Do not interpret “use the Loombus Editorial UI” as permission to delete features or simplify business logic. The instruction concerns visual and interaction architecture unless the task explicitly says otherwise.

## Implementation Rule for Future Chats and Agents

When instructed to redesign a route using the **Loombus Editorial UI**, the implementation agent should:

1. Read this document first.
2. Inspect the current `/create` implementation.
3. Inspect the relevant portions of `/discussions/[id]`.
4. Audit the target page's existing functionality.
5. Preserve functionality unless behavior changes are explicitly requested.
6. Apply this system based on the target page's purpose rather than blindly copying markup.
7. Report any intentional departures from this specification.

## Standard Prompt

The preferred instruction for future work is:

> Redesign `<route>` using the **Loombus Editorial UI**. Read `docs/design-system/loombus-editorial-ui.md` first, use the current `/create` and `/discussions/[id]` implementations as canonical references, preserve existing functionality unless explicitly instructed otherwise, and apply the system to the page's own information architecture.

## Version

**Loombus Editorial UI — v1**

This specification should evolve when the canonical Loombus interaction language changes. Update this document when a significant design-system decision becomes part of the new baseline.
