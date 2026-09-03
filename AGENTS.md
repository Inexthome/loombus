<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Loombus Editorial UI — mandatory default

Loombus Editorial UI is the default visual and interaction language for all new or materially redesigned Loombus web surfaces, including `/admin`.

Before creating page-level layout or styling:

1. Inspect the nearest existing Editorial route and reuse its frame, typography hierarchy, spacing, dividers, controls, states, appearance variables, and responsive behavior.
2. Reuse an existing Editorial suite frame when the route belongs to that suite. Do not create a standalone card/dashboard shell when an Editorial frame already exists.
3. Prefer divider-led information architecture, restrained Loombus Gold (`#CBAB5B`), standard Loombus appearance variables, editorial mastheads, compact status treatments, and flat operational sections over decorative cards, gradients, oversized rounded panels, or generic dashboard styling.
4. Preserve Light/Dark/System parity, keyboard focus visibility, reduced-motion behavior, mobile layout, and existing Loombus semantics.
5. When adding a route to an Editorial suite, update that suite's verification script and GitHub Actions path coverage in the same change so CI fails if the route stops using the Editorial frame.
6. A non-Editorial presentation requires an explicit product requirement. Absence of a design instruction is not permission to invent another visual system.

For Admin member/support/commerce/communications work, start from `src/app/admin/admin-member-commerce-editorial-frame.tsx` and `src/app/admin/member-commerce-editorial.css` before adding route-specific CSS.
