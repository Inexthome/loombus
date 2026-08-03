#!/usr/bin/env bash
# Live production check for the AI analyze route fix
# (src/app/api/floor/theses/[thesisId]/analyze/route.ts):
#   - hasActiveFloorAccess gate
#   - claim-before-generate race protection (unique index on
#     floor_thesis_analyses(thesis_id))
#
# This makes ONE real Anthropic call on the first successful request (the
# thesis you point it at must not already have an analysis). The second,
# duplicate request is expected to 409 at the claim-insert step, BEFORE
# the model is called -- so it should not cost anything extra. Nothing is
# cleaned up automatically: the thesis will have a real analysis attached
# afterward, same as if a real member had requested one.
#
# Usage:
#   SITE_URL=https://your-domain.com \
#   AUTH_TOKEN=<a real user's Supabase access_token, Floor access active> \
#   THESIS_ID=<a thesis id owned by that user, with no analysis yet> \
#   ./scripts/verification/test-floor-analyze-route.sh
#
# Optional, to also check the access gate itself:
#   AUTH_TOKEN_NO_ACCESS=<a signed-in user's token WITHOUT active Floor access>
#
# Getting AUTH_TOKEN: sign in to the app in a browser, open devtools ->
# Application/Storage -> find the Supabase auth token in localStorage
# (sb-<project-ref>-auth-token), and copy its access_token field. It's
# short-lived -- grab a fresh one if this reports 401s unexpectedly.

set -euo pipefail

: "${SITE_URL:?Set SITE_URL, e.g. https://your-domain.com}"
: "${AUTH_TOKEN:?Set AUTH_TOKEN to a real user access_token from Supabase auth}"
: "${THESIS_ID:?Set THESIS_ID to a thesis owned by that user with no existing analysis}"

ENDPOINT="$SITE_URL/api/floor/theses/$THESIS_ID/analyze"

pass=0
fail=0

check() {
  local label="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "PASS  $label (got $actual)"
    pass=$((pass + 1))
  else
    echo "FAIL  $label (expected $expected, got $actual)"
    fail=$((fail + 1))
  fi
}

echo "== First analyze request (expect 201, one real model call) =="
first_response=$(curl -s -w '\n%{http_code}' -X POST "$ENDPOINT" \
  -H "Authorization: Bearer $AUTH_TOKEN" -H "Content-Type: application/json")
first_status=$(echo "$first_response" | tail -n1)
first_body=$(echo "$first_response" | sed '$d')
echo "$first_body"
check "first request succeeds" "201" "$first_status"

echo
echo "== Second analyze request on the SAME thesis (expect 409, no extra model call) =="
second_response=$(curl -s -w '\n%{http_code}' -X POST "$ENDPOINT" \
  -H "Authorization: Bearer $AUTH_TOKEN" -H "Content-Type: application/json")
second_status=$(echo "$second_response" | tail -n1)
second_body=$(echo "$second_response" | sed '$d')
echo "$second_body"
check "duplicate request is rejected" "409" "$second_status"

if [ "${AUTH_TOKEN_NO_ACCESS:-}" != "" ]; then
  echo
  echo "== Request without active Floor access (expect 403) =="
  no_access_response=$(curl -s -w '\n%{http_code}' -X POST "$ENDPOINT" \
    -H "Authorization: Bearer $AUTH_TOKEN_NO_ACCESS" -H "Content-Type: application/json")
  no_access_status=$(echo "$no_access_response" | tail -n1)
  echo "$no_access_response" | sed '$d'
  check "membership gate blocks non-member" "403" "$no_access_status"
else
  echo
  echo "SKIP  membership gate check (set AUTH_TOKEN_NO_ACCESS to include it)"
fi

echo
echo "== Summary: $pass passed, $fail failed =="
[ "$fail" -eq 0 ]
