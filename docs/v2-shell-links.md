# V2 shell link routing

This checkpoint routes selected V2 shell rail actions into gated V2 preview routes without replacing the public V1 experience.

## What it does

- Uses the existing `/v2` nested layout.
- Uses the small V2-only link router component.
- Intercepts only V2 shell rail links with matching labels and current V1 hrefs.
- Routes `aria-label="Discussions"` and `href="/discussions"` to `/v2/discussions`.
- Routes `aria-label="Create"` and `href="/create"` to `/v2/create`.

## Safety model

- Does not modify the public `/discussions` route.
- Does not modify the public `/create` route.
- Does not modify V1 public navigation.
- Does not enable `v2_rooms`.
- Does not change rollout percentage.
- Non-allowlisted users still cannot render `/v2`, `/v2/discussions`, or `/v2/create`.
- Existing explicit V1 links remain available for testing and fallback.

## Manual test plan

1. Open `/v2` as the allowlisted account.
2. Click the V2 shell rail Discussions icon.
3. Confirm it opens `/v2/discussions`.
4. Click the V2 shell rail Create icon.
5. Confirm it opens `/v2/create`.
6. Confirm `/discussions` still opens the V1 feed directly.
7. Confirm `/create` still opens the V1 composer directly.
8. Confirm signed-out or non-allowlisted users cannot render the V2 preview routes.

## Not included yet

- Replacing the V1 Discussions route.
- Replacing the V1 Create route.
- Adding a public V2 navigation entry.
- V2 discussion detail pages.
- V2 composer submission wiring.
