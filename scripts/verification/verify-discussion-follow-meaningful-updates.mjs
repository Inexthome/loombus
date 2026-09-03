import fs from "node:fs";

const migrationPath = "supabase/migrations/20260903090000_discussion_follow_meaningful_updates.sql";
const followBridgePath = "src/components/discussion-follow-bridge.tsx";
const updatesBridgePath = "src/components/discussion-follow-updates-bridge.tsx";
const detailLayoutPath = "src/app/discussions/[id]/layout.tsx";
const feedLayoutPath = "src/app/discussions/layout.tsx";
const notificationsPath = "src/app/notifications/client-page.tsx";

for (const path of [migrationPath, followBridgePath, updatesBridgePath, detailLayoutPath, feedLayoutPath, notificationsPath]) {
  if (!fs.existsSync(path)) throw new Error(`Missing required file: ${path}`);
}

const migration = fs.readFileSync(migrationPath, "utf8");
const followBridge = fs.readFileSync(followBridgePath, "utf8");
const updatesBridge = fs.readFileSync(updatesBridgePath, "utf8");
const detailLayout = fs.readFileSync(detailLayoutPath, "utf8");
const feedLayout = fs.readFileSync(feedLayoutPath, "utf8");
const notifications = fs.readFileSync(notificationsPath, "utf8");

function requireText(source, text, message) {
  if (!source.includes(text)) throw new Error(message);
}

requireText(migration, "create table if not exists public.discussion_follows", "Discussion follows must be durable.");
requireText(migration, "notification_level in ('major', 'all_replies')", "Discussion follows must support restrained and all-reply notification levels.");
requireText(migration, "now() - interval '6 hours'", "Major reply notifications must be throttled to avoid noisy threads.");
requireText(migration, "'followed_discussion'", "Meaningful discussion updates must use the native followed_discussion notification type.");
requireText(migration, "'discussion'", "Discussion-follow notifications must target native discussion routes.");
requireText(migration, "after insert on public.replies", "New replies must drive followed discussion notifications.");
requireText(migration, "after update of discussion_status on public.discussions", "Resolution/reopen changes must drive followed discussion notifications.");
requireText(migration, "user_id = auth.uid()", "Discussion follow preferences must remain member-private under RLS.");

requireText(followBridge, '"Major updates only"', "Follow UI must default toward restrained notifications.");
requireText(followBridge, '"All replies"', "Follow UI must offer explicit all-reply notifications.");
requireText(followBridge, '"Status changes"', "Follow UI must expose resolution/reopen preferences.");
requireText(followBridge, '.from("discussion_follows")', "Follow UI must persist durable follow preferences.");
requireText(detailLayout, "<DiscussionFollowBridge />", "Discussion detail must mount the follow control.");

requireText(updatesBridge, '.eq("type", "followed_discussion")', "Your updates must consume native followed discussion notifications.");
requireText(updatesBridge, 'data-discussions-engagement-mount', "Follow updates must consolidate into the existing Your updates surface.");
requireText(feedLayout, "<DiscussionFollowUpdatesBridge />", "Discussions feed must mount followed discussion updates.");

requireText(notifications, '"followed_discussion"', "Native Notifications must recognize followed discussion notifications.");
requireText(notifications, 'notification.target_type === "discussion"', "Native Notifications must route followed updates to discussion detail.");

if (migration.includes("discussion_views")) {
  throw new Error("Discussion follow notifications must never be driven by raw views.");
}

console.log("Discussion Follow + meaningful update notifications contract verified.");
