# Load Test Plan

Loombus does not need heavy load testing yet, but it needs a safe plan.

## Do not stress production blindly

Do not run aggressive load tests against production unless:
- a test window is planned;
- Vercel/Supabase limits are understood;
- admin health is monitored;
- rollback path is ready;
- test traffic is clearly identified.

## Early launch smoke test

Use lightweight checks:
- homepage loads;
- `/discussions` loads;
- known discussion detail loads;
- `/signup` and `/login` load;
- `/premium` loads;
- `/contact` loads;
- protected APIs return 401/405 as expected;
- admin pages return 200 but require admin session for data.

## Future load test tools

Candidates:
- k6
- Artillery
- Playwright smoke scripts
- Vercel logs/analytics
- Supabase reports

## Test targets before wider launch

- 25 concurrent anonymous readers;
- 10 concurrent logged-in readers;
- 5 concurrent discussion/reply actions;
- AI endpoints with strict low-volume tests only;
- contact/support form low-volume spam simulation;
- protected API unauthenticated rejection checks.

## Pass criteria

- no database errors;
- no deployment crash;
- no auth deadlocks;
- no stuck loading pages;
- no unexpected 500s;
- protected APIs remain protected;
- admin health remains readable.
