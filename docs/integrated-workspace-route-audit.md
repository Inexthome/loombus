# Integrated workspace route audit

This pass aligns the newer Loombus discovery, directory, transaction-boundary, and management routes with the established application shell without changing their data, API, moderation, scheduling, or publishing behavior.

## Included route families

- `/local` and nested routes
- `/businesses` and nested routes
- `/services` and nested routes
- `/jobs` and nested routes
- `/marketplace` and nested routes
- `/appointments` and nested routes
- `/events` and nested routes
- `/requests` and nested routes

Nested coverage intentionally includes detail pages, management workspaces, saved pages, and feature-specific safety pages.

## Route presentation modes

- `index`: public directory and discovery entry pages
- `workspace`: management, saved, and appointment workspaces
- `detail`: public business, service, job, listing, event, and request detail pages
- `safety`: feature-specific safety and transaction-boundary guidance

## Preserved behavior

- Light, Dark, and System theme variables
- Existing top and mobile navigation
- Existing filters, forms, cards, images, and detail layouts
- Existing Supabase and API behavior
- Existing moderation, reporting, safety, appointments, and marketplace transaction boundaries
- Existing route URLs and metadata

## Visual corrections

- Removes the detached marketing-page treatment from oversized introductory panels
- Normalizes heading scale and hierarchy
- Uses the Loombus page background, text, borders, focus states, and motion timing
- Preserves specialized card and content formats for each feature
- Applies separate styling rules for indexes, workspaces, details, and safety pages
