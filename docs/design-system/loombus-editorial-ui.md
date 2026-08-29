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

## Color and Theme Palette

The Loombus Editorial UI uses the **Loombus Gold and Cream palette** as part of the canonical product identity.

### Canonical brand colors

- **Loombus Gold:** `#CBAB5B`
- **Loombus Cream:** `#FEFBEC`

These values are authoritative for new Editorial UI work. Do not substitute visually similar gold or cream values when implementing a new page or refactoring a page into this system.

### Loombus Gold usage

Loombus Gold is an accent and action color, not a large-surface background color.

Use `#CBAB5B` primarily for:

- primary actions
- active tab indicators
- selected or focused emphasis
- important status accents
- restrained links or interactive highlights where appropriate
- brand details that need clear Loombus identity

Do not flood large page regions or long reading surfaces with gold. Content must remain visually dominant.

When gold is used as a filled primary action, text and icon contrast must remain accessible.

### Loombus Cream usage

Loombus Cream `#FEFBEC` is the canonical warm editorial background for **Light** theme pages where the Editorial UI calls for the Loombus paper-like reading/composition surface.

It is especially appropriate for:

- focused creation pages
- reading-heavy editorial pages
- structured discussion and knowledge surfaces
- continuous flat workflows where a warm page background reinforces the editorial character

Cream should not automatically replace every surface token. Discrete cards, inputs, overlays, and nested surfaces should continue to use the appropriate Loombus surface and border tokens unless the page specification requires otherwise.

## Theme Modes

Every Loombus Editorial UI implementation must support **Light, Dark, and System** appearance modes.

### Light

In Light mode:

- use **Loombus Cream `#FEFBEC`** as the preferred editorial page background where appropriate
- use dark, high-contrast Loombus text tokens for readable content
- use `#CBAB5B` for primary actions and restrained active-state accents
- keep major working surfaces visually calm; avoid converting the cream background into a high-contrast dashboard of white cards
- preserve thin borders and subtle surface separation

### Dark

In Dark mode:

- use the established Loombus dark page and surface tokens rather than forcing Cream onto the page
- retain **Loombus Gold `#CBAB5B`** as the brand accent, adjusting surrounding text/surface treatment only as necessary for contrast
- use dark-theme Loombus text, muted-text, border, page, and surface tokens
- preserve the same information hierarchy, density, divider rhythm, and action hierarchy as Light mode
- do not create a separate visual system merely because the theme is dark

### System

System mode must follow the operating system/browser color-scheme preference:

- when the system preference is light, apply the Editorial UI Light behavior, including Cream where appropriate
- when the system preference is dark, apply the Editorial UI Dark behavior
- System must not be treated as a third independent palette
- theme changes should not alter functionality, information architecture, or page hierarchy

### Theme implementation rule

Prefer shared Loombus CSS/theme tokens for text, borders, surfaces, and state colors. The canonical Gold and Cream values may be expressed through centralized design tokens rather than repeated hard-coded values.

If existing theme tokens conflict with the canonical Editorial UI values for a newly redesigned surface, align or introduce the appropriate centralized token rather than scattering page-specific color overrides.

A page redesigned using the Loombus Editorial UI is not complete until Light, Dark, and System appearances have been checked.

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

## Loombus Info Tooltip

The **Loombus Info Tooltip** is the canonical inline explanation pattern for unfamiliar, Loombus-specific, technical, or potentially ambiguous terminology.

It uses a small information icon, such as `ⓘ`, immediately adjacent to the term or label it explains. The tooltip provides contextual help without permanently adding instructional copy to the page.

Appropriate examples include:

- Reality Lens ⓘ
- Purpose Lane ⓘ
- Discussion Mode ⓘ
- Evidence ⓘ
- other Loombus-specific concepts whose meaning may not be immediately obvious

Do **not** add Info Tooltips to familiar labels or actions that are already self-explanatory, such as Title, Cancel, Save, Clear, or Publish. The pattern must reduce uncertainty rather than create icon clutter.

### Interaction

The same explanation must be available across input methods:

- **Desktop pointer:** show on hover.
- **Keyboard:** show when the info trigger receives focus and allow normal keyboard navigation.
- **Touch/mobile:** show on tap; do not rely on hover behavior.
- The user must be able to dismiss a persistent/tapped tooltip without triggering the underlying field or action.

Hover is an enhancement, not the only access mechanism.

### Content

Tooltip copy should normally be one or two concise sentences. Explain what the term means or why it matters in the current workflow.

Do not use a tooltip for long instructions, policy text, tutorials, multi-step guidance, or content that users must read before proceeding. Use visible helper text, a panel, modal, or dedicated help surface for those cases.

Tooltip language should be plain, direct, and specific to the Loombus concept being explained.

### Visual treatment

The trigger should remain subordinate to the label:

- use a small information icon rather than a large button
- align it naturally with the label text
- use muted text/icon treatment at rest
- use **Loombus Gold `#CBAB5B`** as a restrained hover, focus, or active accent where appropriate
- use the appropriate Light/Dark surface, text, border, and shadow tokens for the tooltip bubble
- keep the bubble compact and readable
- avoid excessive radius, decorative effects, or oversized callouts

In Light mode the tooltip must remain legible against Loombus Cream `#FEFBEC`; in Dark mode it must use the established dark surface system. System mode follows the corresponding Light or Dark behavior.

### Accessibility

The information trigger must be a real keyboard-focusable interactive element rather than an icon with hover-only CSS.

Implementations should:

- give the trigger an accessible name such as `More information about Reality Lens`
- associate the trigger and tooltip content with appropriate accessible semantics
- expose the explanation on keyboard focus
- preserve visible focus treatment
- support Escape to dismiss when the tooltip remains open
- avoid placing essential information exclusively inside the tooltip
- maintain a practical touch target even when the visible icon is visually small

### Component rule

Prefer one shared reusable component, conventionally named `InfoTooltip`, rather than implementing separate tooltip behavior page by page.

A page adopting the Loombus Editorial UI should reuse the shared Info Tooltip pattern whenever contextual definitions are needed. Do not create competing info-icon styles or interaction models on individual routes.

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

Primary actions may use Loombus Gold `#CBAB5B` but should remain proportionate to the surrounding interface.

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
10. Verify desktop, mobile, **Light, Dark, and System**, keyboard navigation, loading states, empty states, validation, and error states.

Do not interpret “use the Loombus Editorial UI” as permission to delete features or simplify business logic. The instruction concerns visual and interaction architecture unless the task explicitly says otherwise.

## Implementation Rule for Future Chats and Agents

When instructed to redesign a route using the **Loombus Editorial UI**, the implementation agent should:

1. Read this document first.
2. Inspect the current `/create` implementation.
3. Inspect the relevant portions of `/discussions/[id]`.
4. Audit the target page's existing functionality.
5. Preserve functionality unless behavior changes are explicitly requested.
6. Apply the **Loombus Gold `#CBAB5B` and Cream `#FEFBEC` palette** through the Light, Dark, and System theme rules in this specification.
7. Reuse the **Loombus Info Tooltip** for unfamiliar or Loombus-specific terminology where concise contextual explanation improves comprehension.
8. Apply this system based on the target page's purpose rather than blindly copying markup.
9. Report any intentional departures from this specification.

## Standard Prompt

The preferred instruction for future work is:

> Redesign `<route>` using the **Loombus Editorial UI**. Read `docs/design-system/loombus-editorial-ui.md` first, use the current `/create` and `/discussions/[id]` implementations as canonical references, preserve existing functionality unless explicitly instructed otherwise, apply the canonical Loombus Gold (`#CBAB5B`) and Cream (`#FEFBEC`) palette with Light, Dark, and System support, use the Loombus Info Tooltip for unfamiliar or Loombus-specific terminology where contextual definitions are useful, and apply the system to the page's own information architecture.

## Version

**Loombus Editorial UI — v1**

This specification should evolve when the canonical Loombus interaction language changes. Update this document when a significant design-system decision becomes part of the new baseline.
