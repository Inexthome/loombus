import fs from "node:fs";

const bridgePath = "src/components/discussions-engagement-bridge.tsx";
const layoutPath = "src/app/discussions/layout.tsx";
const migrationPath = "supabase/migrations/20260903080000_discussions_engagement_phase_one.sql";

const bridge = fs.readFileSync(bridgePath, "utf8");
const layout = fs.readFileSync(layoutPath, "utf8");
const migration = fs.readFileSync(migrationPath, "utf8");

const requiredBridgeMarkers = [
  '"for_you"',
  '"active"',
  "Continue the conversation",
  "New since your last visit",
  "begin_discussions_feed_session",
  "followingIds",
  "savedIds",
  "participatedIds",
  "recentReplies",
  "previousVisitAt",
  "MODE_REQUEST_EVENT",
  "MODE_STATE_EVENT",
];

for (const marker of requiredBridgeMarkers) {
  if (!bridge.includes(marker)) {
    throw new Error(`Discussions engagement bridge is missing required marker: ${marker}`);
  }
}

if (!layout.includes("<DiscussionsEngagementBridge />")) {
  throw new Error("Discussions layout must mount DiscussionsEngagementBridge.");
}

const requiredMigrationMarkers = [
  "create table if not exists public.discussion_feed_visits",
  "alter table public.discussion_feed_visits enable row level security",
  'user_id = auth.uid()',
  "create or replace function public.begin_discussions_feed_session()",
  "interval '30 minutes'",
  "grant execute on function public.begin_discussions_feed_session() to authenticated",
];

for (const marker of requiredMigrationMarkers) {
  if (!migration.includes(marker)) {
    throw new Error(`Discussions engagement migration is missing required marker: ${marker}`);
  }
}

if (/viewCounts|discussion_views/.test(bridge)) {
  throw new Error("For You/Active ranking must not use raw view counts.");
}

console.log("Discussions Engagement Phase 1 verification passed.");
