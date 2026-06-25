# V2 shell link routing

This checkpoint routes the V2 shell rail's Discussions action into the V2 Discussions preview without replacing the public V1 discussion experience.

## What it does

- Adds a `/v2` nested layout.
- Adds a small V2-only link router component.
- Intercepts only the V2 shell rail link matching `aria-label="Discussions"` and `href="/discussions"`.
- Routes that action to `/v2/discussions`.

## Safety model

- Does not modify the public `/discussions` route.
- Does not modify V1 public navigation.
- Does not enable `v2_rooms`.
- Does not change rollout percentage.
- Non-allowlisted users still cannot render `/v2` or `/v2/discussions`.
- Existing explicit V1 links remain available for testing and fallback.

## Manual test plan

1. Open `/v2` as the allowlisted account.
2. Click the V2 shell rail Discussions icon.
3. Confirm it opens `/v2/discussions`.
4. Confirm `/discussions` still opens the V1 feed directly.
5. Confirm signed-out or non-allowlisted users cannot render the V2 preview.

## Not included yet

- Replacing the V1 Discussions route.
- Adding a public V2 navigation entry.
- V2 discussion detail pages.
- V2 composer wiring.
