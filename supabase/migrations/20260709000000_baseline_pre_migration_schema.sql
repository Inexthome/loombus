-- Baseline schema for tables/functions that predate this repo's migration
-- history. `supabase db reset` replays supabase/migrations/*.sql in order
-- against an empty database, but a large share of the platform's live
-- tables (profiles, discussions, replies, notifications, private_messages,
-- rooms, and a long tail of others) have no CREATE TABLE anywhere in this
-- folder -- the oldest migration here (20260710072000) already ALTERs
-- `rooms` as if it exists. These objects were evidently created directly
-- against the database (dashboard/SQL editor) before this project adopted
-- a tracked migrations workflow, so no migration file for their origin
-- ever existed to recover.
--
-- This file closes that gap by generating exactly what was missing: a
-- schema-only reconstruction of those tables (plus every function, and
-- every further table those functions/policies/triggers transitively
-- depend on) extracted directly from a live production schema dump and
-- filtered/reordered by a script, rather than hand-typed. Order is: bare
-- CREATE TABLE, then functions (topologically sorted by actual
-- function-calls-function references -- LANGUAGE sql functions are
-- validated against the catalog at CREATE TIME, unlike plpgsql, and
-- pg_dump's own order doesn't reflect this kind of dependency), then
-- PRIMARY KEY/UNIQUE constraints and unique indexes (an FK can target
-- either), then FOREIGN KEY constraints, then remaining
-- indexes/triggers/policies/grants.
--
-- One column was deliberately excluded (rooms.organization_id, plus its
-- FK and index) -- that one IS introduced by a real tracked migration
-- (20260720010000_activate_room_organization_console.sql) whose target
-- table (room_organizations) does not exist yet at this point in the
-- timeline; baselining it here would have either dangled a premature FK
-- or silently swallowed that migration's ADD COLUMN IF NOT EXISTS,
-- meaning the FK would never get added on replay.
--
-- IMPORTANT -- dev/CI only, never run against production:
-- Production already has every one of these objects. This migration is
-- for `supabase db reset`, fresh preview branches, and CI only. Running it
-- against a populated database will fail loudly (see the guard below)
-- rather than silently corrupting anything, but it should never be
-- attempted there -- there is nothing to apply.

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'profiles'
  ) then
    raise exception 'Baseline migration skipped: public.profiles already exists. This file recreates the pre-migration-history schema for empty databases only (supabase db reset, CI, fresh preview branches) -- never run it against a database that already has data.';
  end if;
end;
$$;

begin;

CREATE TABLE IF NOT EXISTS "public"."account_deletion_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "reason" "text",
    "status" "text" DEFAULT 'requested'::"text" NOT NULL,
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "admin_note" "text",
    CONSTRAINT "account_deletion_requests_admin_note_length" CHECK ((("admin_note" IS NULL) OR ("char_length"(TRIM(BOTH FROM "admin_note")) <= 2000))),
    CONSTRAINT "account_deletion_requests_reason_length" CHECK ((("reason" IS NULL) OR ("char_length"(TRIM(BOTH FROM "reason")) <= 2000))),
    CONSTRAINT "account_deletion_requests_status_check" CHECK (("status" = ANY (ARRAY['requested'::"text", 'reviewing'::"text", 'completed'::"text", 'cancelled'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."action_rate_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "action_key" "text" NOT NULL,
    "target_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "action_rate_events_action_key_check" CHECK (("action_key" = ANY (ARRAY['follow_toggle'::"text", 'block_toggle'::"text", 'report_create'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."ai_extra_credit_ledger" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pack_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "feature_key" "text",
    "target_type" "text",
    "target_id" "uuid",
    "credits_delta" integer NOT NULL,
    "reason" "text" NOT NULL,
    "ai_usage_event_id" "uuid",
    "stripe_checkout_session_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_extra_credit_ledger_delta_not_zero" CHECK (("credits_delta" <> 0)),
    CONSTRAINT "ai_extra_credit_ledger_reason_check" CHECK (("reason" = ANY (ARRAY['purchase'::"text", 'consume'::"text", 'refund'::"text", 'admin_adjustment'::"text", 'system_adjustment'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."ai_extra_credit_packs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "stripe_checkout_session_id" "text",
    "stripe_payment_intent_id" "text",
    "stripe_customer_id" "text",
    "purchased_credits" integer DEFAULT 25 NOT NULL,
    "remaining_credits" integer DEFAULT 25 NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "source" "text" DEFAULT 'stripe'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_extra_credit_packs_purchased_nonnegative" CHECK (("purchased_credits" >= 0)),
    CONSTRAINT "ai_extra_credit_packs_remaining_nonnegative" CHECK (("remaining_credits" >= 0)),
    CONSTRAINT "ai_extra_credit_packs_remaining_not_over_purchased" CHECK (("remaining_credits" <= "purchased_credits")),
    CONSTRAINT "ai_extra_credit_packs_source_check" CHECK (("source" = ANY (ARRAY['stripe'::"text", 'admin'::"text", 'system'::"text"]))),
    CONSTRAINT "ai_extra_credit_packs_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'depleted'::"text", 'refunded'::"text", 'void'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."ai_output_ratings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "discussion_id" "uuid" NOT NULL,
    "feature_key" "text" NOT NULL,
    "rating" "text" NOT NULL,
    "source_content_hash" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_output_ratings_feature_key_check" CHECK (("feature_key" = ANY (ARRAY['thread_summary'::"text", 'key_takeaways'::"text", 'what_changed'::"text", 'disagreement_map'::"text", 'conversation_map'::"text", 'related_ideas'::"text"]))),
    CONSTRAINT "ai_output_ratings_rating_check" CHECK (("rating" = ANY (ARRAY['helpful'::"text", 'not_helpful'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."ai_usage_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "feature_key" "text" NOT NULL,
    "target_type" "text",
    "target_id" "uuid",
    "provider" "text",
    "model_name" "text",
    "cached" boolean DEFAULT false NOT NULL,
    "success" boolean DEFAULT true NOT NULL,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "prompt_tokens" integer,
    "completion_tokens" integer,
    "total_tokens" integer,
    "estimated_cost_usd" numeric(12,8),
    CONSTRAINT "ai_usage_events_completion_tokens_nonnegative" CHECK ((("completion_tokens" IS NULL) OR ("completion_tokens" >= 0))),
    CONSTRAINT "ai_usage_events_estimated_cost_usd_nonnegative" CHECK ((("estimated_cost_usd" IS NULL) OR ("estimated_cost_usd" >= (0)::numeric))),
    CONSTRAINT "ai_usage_events_prompt_tokens_nonnegative" CHECK ((("prompt_tokens" IS NULL) OR ("prompt_tokens" >= 0))),
    CONSTRAINT "ai_usage_events_total_tokens_nonnegative" CHECK ((("total_tokens" IS NULL) OR ("total_tokens" >= 0)))
);

CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_id" "uuid",
    "action" "text" NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."bookmark_collections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "bookmark_collections_description_length" CHECK ((("description" IS NULL) OR ("char_length"("description") <= 240))),
    CONSTRAINT "bookmark_collections_name_length" CHECK ((("char_length"(TRIM(BOTH FROM "name")) >= 1) AND ("char_length"(TRIM(BOTH FROM "name")) <= 60)))
);

CREATE TABLE IF NOT EXISTS "public"."bookmarks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "discussion_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "collection_id" "uuid",
    "private_note" "text",
    "private_note_updated_at" timestamp with time zone,
    CONSTRAINT "bookmarks_private_note_length" CHECK ((("private_note" IS NULL) OR ("char_length"("private_note") <= 1000)))
);

CREATE TABLE IF NOT EXISTS "public"."discussion_ai_outputs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "discussion_id" "uuid" NOT NULL,
    "feature_key" "text" NOT NULL,
    "output_text" "text" NOT NULL,
    "model_name" "text",
    "source_reply_count" integer DEFAULT 0 NOT NULL,
    "source_content_hash" "text",
    "generated_by" "uuid",
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "discussion_ai_outputs_feature_key_check" CHECK (("feature_key" = ANY (ARRAY['key_takeaways'::"text", 'what_changed'::"text", 'disagreement_map'::"text", 'research_summary'::"text", 'writing_assist'::"text", 'moderation_assist'::"text", 'conversation_map'::"text", 'related_ideas'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."discussion_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "discussion_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "storage_bucket" "text" DEFAULT 'discussion-attachments'::"text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "public_url" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "mime_type" "text" NOT NULL,
    "file_size_bytes" bigint NOT NULL,
    "attachment_kind" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "video_duration_seconds" integer,
    CONSTRAINT "discussion_attachments_bucket_check" CHECK (("storage_bucket" = 'discussion-attachments'::"text")),
    CONSTRAINT "discussion_attachments_file_name_length_check" CHECK ((("char_length"(TRIM(BOTH FROM "file_name")) > 0) AND ("char_length"("file_name") <= 255))),
    CONSTRAINT "discussion_attachments_kind_check" CHECK (("attachment_kind" = ANY (ARRAY['image'::"text", 'pdf'::"text", 'video'::"text"]))),
    CONSTRAINT "discussion_attachments_kind_mime_alignment_check" CHECK (((("attachment_kind" = 'image'::"text") AND ("mime_type" = ANY (ARRAY['image/jpeg'::"text", 'image/png'::"text", 'image/webp'::"text", 'image/gif'::"text"]))) OR (("attachment_kind" = 'pdf'::"text") AND ("mime_type" = 'application/pdf'::"text")) OR (("attachment_kind" = 'video'::"text") AND ("mime_type" = ANY (ARRAY['video/mp4'::"text", 'video/quicktime'::"text", 'video/webm'::"text"]))))),
    CONSTRAINT "discussion_attachments_mime_type_check" CHECK (("mime_type" = ANY (ARRAY['image/jpeg'::"text", 'image/png'::"text", 'image/webp'::"text", 'image/gif'::"text", 'application/pdf'::"text", 'video/mp4'::"text", 'video/quicktime'::"text", 'video/webm'::"text"]))),
    CONSTRAINT "discussion_attachments_public_url_length_check" CHECK ((("char_length"(TRIM(BOTH FROM "public_url")) > 0) AND ("char_length"("public_url") <= 2048))),
    CONSTRAINT "discussion_attachments_size_check" CHECK ((("file_size_bytes" > 0) AND ((("attachment_kind" = 'video'::"text") AND ("file_size_bytes" <= 262144000)) OR (("attachment_kind" <> 'video'::"text") AND ("file_size_bytes" <= 10485760))))),
    CONSTRAINT "discussion_attachments_sort_order_check" CHECK ((("sort_order" >= 0) AND ("sort_order" <= 2))),
    CONSTRAINT "discussion_attachments_storage_path_owner_check" CHECK (("storage_path" ~~ (("user_id")::"text" || '/%'::"text"))),
    CONSTRAINT "discussion_attachments_video_duration_check" CHECK (((("attachment_kind" = 'video'::"text") AND ("video_duration_seconds" IS NOT NULL) AND ("video_duration_seconds" > 0) AND ("video_duration_seconds" <= 180)) OR (("attachment_kind" <> 'video'::"text") AND ("video_duration_seconds" IS NULL))))
);

CREATE TABLE IF NOT EXISTS "public"."discussion_audience_members" (
    "discussion_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "access_kind" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "discussion_audience_members_access_kind_check" CHECK (("access_kind" = ANY (ARRAY['include'::"text", 'exclude'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."discussion_drafts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" DEFAULT ''::"text" NOT NULL,
    "topic" "text" DEFAULT 'General'::"text" NOT NULL,
    "body" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reality_lens" "text",
    "purpose_lane" "text",
    CONSTRAINT "discussion_drafts_body_length" CHECK (("char_length"("body") <= 12000)),
    CONSTRAINT "discussion_drafts_purpose_lane_check" CHECK ((("purpose_lane" IS NULL) OR ("purpose_lane" = ANY (ARRAY['Learning'::"text", 'Mastery'::"text", 'Contribution'::"text", 'Community'::"text", 'Career transition'::"text", 'Human development'::"text", 'Local problem-solving'::"text", 'Life after automation'::"text"])))),
    CONSTRAINT "discussion_drafts_reality_lens_check" CHECK ((("reality_lens" IS NULL) OR ("reality_lens" = ANY (ARRAY['Loneliness'::"text", 'Hidden Financial Stress'::"text", 'Fear of Irrelevance'::"text", 'Psychological Exhaustion'::"text", 'Quiet Regret'::"text", 'Rebuilding Meaning'::"text", 'Entrepreneur Isolation'::"text", 'Reality Behind Success'::"text", 'AI and Human Purpose'::"text", 'Life Transition'::"text"])))),
    CONSTRAINT "discussion_drafts_title_length" CHECK (("char_length"("title") <= 160)),
    CONSTRAINT "discussion_drafts_topic_length" CHECK ((("char_length"("topic") >= 1) AND ("char_length"("topic") <= 80)))
);

CREATE TABLE IF NOT EXISTS "public"."discussion_summaries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "discussion_id" "uuid" NOT NULL,
    "summary" "text" NOT NULL,
    "model_name" "text",
    "source_reply_count" integer DEFAULT 0 NOT NULL,
    "source_content_hash" "text",
    "generated_by" "uuid",
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."discussion_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "discussion_id" "uuid" NOT NULL,
    "tag" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "discussion_tags_tag_format" CHECK (("tag" ~ '^[A-Za-z0-9][A-Za-z0-9 &+.#''-]{0,38}[A-Za-z0-9]$'::"text")),
    CONSTRAINT "discussion_tags_tag_length" CHECK ((("char_length"(TRIM(BOTH FROM "tag")) >= 2) AND ("char_length"(TRIM(BOTH FROM "tag")) <= 40)))
);

CREATE TABLE IF NOT EXISTS "public"."discussion_video_upload_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "discussion_id" "uuid",
    "attachment_id" "uuid",
    "tier" "text" NOT NULL,
    "video_duration_seconds" integer NOT NULL,
    "max_duration_seconds" integer NOT NULL,
    "file_size_bytes" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "discussion_video_upload_events_file_size_bytes_check" CHECK ((("file_size_bytes" > 0) AND ("file_size_bytes" <= 262144000))),
    CONSTRAINT "discussion_video_upload_events_max_duration_seconds_check" CHECK ((("max_duration_seconds" > 0) AND ("max_duration_seconds" <= 180))),
    CONSTRAINT "discussion_video_upload_events_tier_check" CHECK (("tier" = ANY (ARRAY['free'::"text", 'premium'::"text", 'premium_plus'::"text", 'admin'::"text"]))),
    CONSTRAINT "discussion_video_upload_events_video_duration_seconds_check" CHECK ((("video_duration_seconds" > 0) AND ("video_duration_seconds" <= 180)))
);

CREATE TABLE IF NOT EXISTS "public"."discussion_views" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "discussion_id" "uuid",
    "viewer_id" "uuid",
    "viewed_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "identity_visible" boolean DEFAULT true NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."discussions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "title" "text" NOT NULL,
    "topic" "text" NOT NULL,
    "body" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "deletion_reason" "text",
    "updated_at" timestamp with time zone,
    "edited_at" timestamp with time zone,
    "edited_by" "uuid",
    "edit_count" integer DEFAULT 0 NOT NULL,
    "discussion_status" "text" DEFAULT 'open'::"text" NOT NULL,
    "resolved_at" timestamp with time zone,
    "resolved_by" "uuid",
    "pinned_reply_id" "uuid",
    "pinned_at" timestamp with time zone,
    "pinned_by" "uuid",
    "reality_lens" "text",
    "purpose_lane" "text",
    "discussion_type" "text" DEFAULT 'open_discussion'::"text" NOT NULL,
    "discussion_metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "submission_fingerprint" "text",
    "audience_type" "text" DEFAULT 'public'::"text" NOT NULL,
    "audience_base" "text",
    CONSTRAINT "discussions_audience_base_check" CHECK (((("audience_type" = 'custom'::"text") AND ("audience_base" = ANY (ARRAY['public'::"text", 'followers'::"text", 'connections'::"text"]))) OR (("audience_type" <> 'custom'::"text") AND ("audience_base" IS NULL)))),
    CONSTRAINT "discussions_audience_type_check" CHECK (("audience_type" = ANY (ARRAY['public'::"text", 'followers'::"text", 'connections'::"text", 'exclude_selected'::"text", 'selected'::"text", 'only_me'::"text", 'custom'::"text"]))),
    CONSTRAINT "discussions_discussion_status_check" CHECK (("discussion_status" = ANY (ARRAY['open'::"text", 'resolved'::"text"]))),
    CONSTRAINT "discussions_discussion_type_check" CHECK (("discussion_type" = ANY (ARRAY['open_discussion'::"text", 'debate'::"text", 'research_question'::"text", 'problem_solving'::"text"]))),
    CONSTRAINT "discussions_edit_count_nonnegative" CHECK (("edit_count" >= 0)),
    CONSTRAINT "discussions_purpose_lane_check" CHECK ((("purpose_lane" IS NULL) OR ("purpose_lane" = ANY (ARRAY['Learning'::"text", 'Mastery'::"text", 'Contribution'::"text", 'Community'::"text", 'Career transition'::"text", 'Human development'::"text", 'Local problem-solving'::"text", 'Life after automation'::"text"])))),
    CONSTRAINT "discussions_reality_lens_check" CHECK ((("reality_lens" IS NULL) OR ("reality_lens" = ANY (ARRAY['Loneliness'::"text", 'Hidden Financial Stress'::"text", 'Fear of Irrelevance'::"text", 'Psychological Exhaustion'::"text", 'Quiet Regret'::"text", 'Rebuilding Meaning'::"text", 'Entrepreneur Isolation'::"text", 'Reality Behind Success'::"text", 'AI and Human Purpose'::"text", 'Life Transition'::"text"]))))
);

CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "username" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "bio" "text",
    "is_admin" boolean DEFAULT false,
    "avatar_url" "text",
    "creator_website_url" "text",
    "creator_support_url" "text",
    "creator_support_label" "text",
    "account_status" "text" DEFAULT 'active'::"text" NOT NULL,
    "enforcement_reason" "text",
    "enforcement_note" "text",
    "enforced_by" "uuid",
    "enforced_at" timestamp with time zone,
    "suspended_until" timestamp with time zone,
    "perspective_marker" "text",
    "identity_verification_status" "text" DEFAULT 'unverified'::"text" NOT NULL,
    "identity_verification_provider" "text",
    "identity_provider_subject" "text",
    "identity_verified_at" timestamp with time zone,
    "identity_verification_last_checked_at" timestamp with time zone,
    "legal_name_verified" boolean DEFAULT false NOT NULL,
    "identity_restriction_reason" "text",
    CONSTRAINT "profiles_account_status_check" CHECK (("account_status" = ANY (ARRAY['active'::"text", 'warned'::"text", 'suspended'::"text", 'banned'::"text", 'deactivated'::"text", 'deletion_requested'::"text"]))),
    CONSTRAINT "profiles_creator_support_label_length" CHECK ((("creator_support_label" IS NULL) OR ("char_length"(TRIM(BOTH FROM "creator_support_label")) <= 40))),
    CONSTRAINT "profiles_creator_support_url_format" CHECK ((("creator_support_url" IS NULL) OR (TRIM(BOTH FROM "creator_support_url") = ''::"text") OR (TRIM(BOTH FROM "creator_support_url") ~* '^https?://'::"text"))),
    CONSTRAINT "profiles_creator_support_url_length" CHECK ((("creator_support_url" IS NULL) OR ("char_length"(TRIM(BOTH FROM "creator_support_url")) <= 240))),
    CONSTRAINT "profiles_creator_website_url_format" CHECK ((("creator_website_url" IS NULL) OR (TRIM(BOTH FROM "creator_website_url") = ''::"text") OR (TRIM(BOTH FROM "creator_website_url") ~* '^https?://'::"text"))),
    CONSTRAINT "profiles_creator_website_url_length" CHECK ((("creator_website_url" IS NULL) OR ("char_length"(TRIM(BOTH FROM "creator_website_url")) <= 240))),
    CONSTRAINT "profiles_enforcement_note_length" CHECK ((("enforcement_note" IS NULL) OR ("char_length"(TRIM(BOTH FROM "enforcement_note")) <= 2000))),
    CONSTRAINT "profiles_enforcement_reason_length" CHECK ((("enforcement_reason" IS NULL) OR ("char_length"(TRIM(BOTH FROM "enforcement_reason")) <= 240))),
    CONSTRAINT "profiles_identity_restriction_reason_length" CHECK ((("identity_restriction_reason" IS NULL) OR ("char_length"("identity_restriction_reason") <= 500))),
    CONSTRAINT "profiles_identity_verification_provider_check" CHECK ((("identity_verification_provider" IS NULL) OR ("identity_verification_provider" = ANY (ARRAY['manual'::"text", 'idme'::"text"])))),
    CONSTRAINT "profiles_identity_verification_status_check" CHECK (("identity_verification_status" = ANY (ARRAY['unverified'::"text", 'pending'::"text", 'verified'::"text", 'failed'::"text", 'restricted'::"text"]))),
    CONSTRAINT "profiles_perspective_marker_check" CHECK ((("perspective_marker" IS NULL) OR ("perspective_marker" = ANY (ARRAY['Lived experience'::"text", 'Professional experience'::"text", 'Research-based'::"text", 'Builder / operator'::"text", 'Student / learner'::"text", 'Question / exploring'::"text"]))))
);

CREATE TABLE IF NOT EXISTS "public"."follows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "follower_id" "uuid",
    "following_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."labs_feature_request_votes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."labs_feature_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "status" "text" DEFAULT 'submitted'::"text" NOT NULL,
    "admin_note" "text",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "labs_feature_requests_admin_note_length" CHECK ((("admin_note" IS NULL) OR ("char_length"("admin_note") <= 2000))),
    CONSTRAINT "labs_feature_requests_description_length" CHECK ((("char_length"(TRIM(BOTH FROM "description")) >= 10) AND ("char_length"(TRIM(BOTH FROM "description")) <= 2000))),
    CONSTRAINT "labs_feature_requests_status_check" CHECK (("status" = ANY (ARRAY['submitted'::"text", 'reviewing'::"text", 'planned'::"text", 'shipped'::"text", 'declined'::"text"]))),
    CONSTRAINT "labs_feature_requests_title_length" CHECK ((("char_length"(TRIM(BOTH FROM "title")) >= 3) AND ("char_length"(TRIM(BOTH FROM "title")) <= 120)))
);

CREATE TABLE IF NOT EXISTS "public"."loombus_feature_flags" (
    "key" "text" NOT NULL,
    "enabled" boolean DEFAULT false NOT NULL,
    "rollout_percentage" integer DEFAULT 0 NOT NULL,
    "allowed_user_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "loombus_feature_flags_key_format" CHECK (("key" ~ '^[a-z0-9_:-]+$'::"text")),
    CONSTRAINT "loombus_feature_flags_rollout_percentage_check" CHECK ((("rollout_percentage" >= 0) AND ("rollout_percentage" <= 100)))
);

CREATE TABLE IF NOT EXISTS "public"."loombus_room_discussions" (
    "room_id" "uuid" NOT NULL,
    "discussion_id" "uuid" NOT NULL,
    "added_by" "uuid",
    "added_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."loombus_room_members" (
    "room_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "loombus_room_members_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'moderator'::"text", 'member'::"text"]))),
    CONSTRAINT "loombus_room_members_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'pending'::"text", 'blocked'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."loombus_rooms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "room_type" "text" DEFAULT 'community'::"text" NOT NULL,
    "visibility" "text" DEFAULT 'public'::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_by" "uuid",
    "member_count" integer DEFAULT 0 NOT NULL,
    "discussion_count" integer DEFAULT 0 NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "loombus_rooms_discussion_count_check" CHECK (("discussion_count" >= 0)),
    CONSTRAINT "loombus_rooms_member_count_check" CHECK (("member_count" >= 0)),
    CONSTRAINT "loombus_rooms_room_type_check" CHECK (("room_type" = ANY (ARRAY['community'::"text", 'expert'::"text", 'lab'::"text", 'local'::"text", 'private'::"text"]))),
    CONSTRAINT "loombus_rooms_slug_format" CHECK (("slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::"text")),
    CONSTRAINT "loombus_rooms_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'archived'::"text"]))),
    CONSTRAINT "loombus_rooms_visibility_check" CHECK (("visibility" = ANY (ARRAY['public'::"text", 'private'::"text", 'unlisted'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."loombus_shell_preferences" (
    "user_id" "uuid" NOT NULL,
    "layout_version" "text" DEFAULT 'v1'::"text" NOT NULL,
    "appearance_theme" "text" DEFAULT 'system'::"text" NOT NULL,
    "home_sections" "jsonb" DEFAULT '["needs_attention", "featured_signal", "recent_signals", "rooms"]'::"jsonb" NOT NULL,
    "compact_mode" boolean DEFAULT false NOT NULL,
    "last_seen_v2_prompt_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "loombus_shell_preferences_appearance_theme_check" CHECK (("appearance_theme" = ANY (ARRAY['system'::"text", 'dark_gold'::"text", 'light_blue'::"text"]))),
    CONSTRAINT "loombus_shell_preferences_layout_version_check" CHECK (("layout_version" = ANY (ARRAY['v1'::"text", 'v2'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."loombus_v2_create_drafts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" DEFAULT ''::"text" NOT NULL,
    "topic" "text" DEFAULT ''::"text" NOT NULL,
    "body" "text" DEFAULT ''::"text" NOT NULL,
    "tags" "text" DEFAULT ''::"text" NOT NULL,
    "mode" "text" DEFAULT 'open_discussion'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "loombus_v2_create_drafts_mode_check" CHECK (("mode" = ANY (ARRAY['open_discussion'::"text", 'debate'::"text", 'research_question'::"text", 'problem_solving'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."notification_preferences" (
    "user_id" "uuid" NOT NULL,
    "replies_enabled" boolean DEFAULT true NOT NULL,
    "follows_enabled" boolean DEFAULT true NOT NULL,
    "mentions_enabled" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "followed_discussions_enabled" boolean DEFAULT true NOT NULL,
    "followed_replies_enabled" boolean DEFAULT false NOT NULL,
    "email_digest_enabled" boolean DEFAULT false NOT NULL,
    "email_digest_frequency" "text" DEFAULT 'weekly'::"text" NOT NULL,
    "email_digest_last_sent_at" timestamp with time zone,
    "email_digest_unsubscribe_token" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "push_messages_enabled" boolean DEFAULT true NOT NULL,
    "push_replies_enabled" boolean DEFAULT true NOT NULL,
    "push_follows_enabled" boolean DEFAULT true NOT NULL,
    "push_admin_reports_enabled" boolean DEFAULT true NOT NULL,
    CONSTRAINT "notification_preferences_email_digest_frequency_check" CHECK (("email_digest_frequency" = ANY (ARRAY['daily'::"text", 'weekly'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "actor_id" "uuid",
    "type" "text" NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" "uuid",
    "message" "text" NOT NULL,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "room_id" "uuid"
);

CREATE TABLE IF NOT EXISTS "public"."paste_usage_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "feature_key" "text" NOT NULL,
    "character_count" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "paste_usage_events_character_count_check" CHECK ((("character_count" > 0) AND ("character_count" <= 100000))),
    CONSTRAINT "paste_usage_events_feature_key_check" CHECK (("feature_key" = ANY (ARRAY['discussion_body_paste'::"text", 'reply_body_paste'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."private_conversation_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_read_message_id" "uuid",
    "last_read_at" timestamp with time zone,
    "archived_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "muted_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "public"."private_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_message_at" timestamp with time zone,
    "is_system" boolean DEFAULT false NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."private_message_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "storage_bucket" "text" DEFAULT 'message-attachments'::"text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "public_url" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "mime_type" "text" NOT NULL,
    "file_size_bytes" integer NOT NULL,
    "attachment_kind" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "private_message_attachments_kind_check" CHECK (("attachment_kind" = ANY (ARRAY['image'::"text", 'pdf'::"text"]))),
    CONSTRAINT "private_message_attachments_size_check" CHECK ((("file_size_bytes" > 0) AND ("file_size_bytes" <= 10485760))),
    CONSTRAINT "private_message_attachments_sort_order_check" CHECK ((("sort_order" >= 0) AND ("sort_order" <= 2)))
);

CREATE TABLE IF NOT EXISTS "public"."private_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "message_type" "text" DEFAULT 'text'::"text" NOT NULL,
    "body" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "edited_at" timestamp with time zone,
    "deleted_by_sender" boolean DEFAULT false NOT NULL,
    "reported_count" integer DEFAULT 0 NOT NULL,
    "read_by_recipient_at" timestamp with time zone,
    CONSTRAINT "private_messages_body_length_check" CHECK ((("char_length"(TRIM(BOTH FROM "body")) >= 1) AND ("char_length"(TRIM(BOTH FROM "body")) <= 4000))),
    CONSTRAINT "private_messages_reported_count_check" CHECK (("reported_count" >= 0)),
    CONSTRAINT "private_messages_type_check" CHECK (("message_type" = 'text'::"text"))
);

CREATE TABLE IF NOT EXISTS "public"."profile_sensitive" (
    "id" "uuid" NOT NULL,
    "date_of_birth" "date",
    "age_band" "text",
    "teen_safety_mode" boolean DEFAULT false NOT NULL,
    "guardian_required" boolean DEFAULT false NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."replies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "discussion_id" "uuid",
    "user_id" "uuid",
    "body" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "deletion_reason" "text",
    "updated_at" timestamp with time zone,
    "edited_at" timestamp with time zone,
    "edited_by" "uuid",
    "edit_count" integer DEFAULT 0 NOT NULL,
    "referenced_reply_id" "uuid",
    "quoted_excerpt" "text",
    "submission_fingerprint" "text",
    CONSTRAINT "replies_edit_count_nonnegative" CHECK (("edit_count" >= 0)),
    CONSTRAINT "replies_no_self_reference" CHECK ((("referenced_reply_id" IS NULL) OR ("referenced_reply_id" <> "id"))),
    CONSTRAINT "replies_quoted_excerpt_length" CHECK ((("quoted_excerpt" IS NULL) OR ("char_length"("quoted_excerpt") <= 500)))
);

CREATE TABLE IF NOT EXISTS "public"."reply_reactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reply_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "reaction_type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "reply_reactions_type_check" CHECK (("reaction_type" = ANY (ARRAY['helpful'::"text", 'insightful'::"text", 'well_reasoned'::"text", 'changed_my_view'::"text", 'needs_evidence'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reporter_id" "uuid",
    "discussion_id" "uuid",
    "reason" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'new'::"text",
    "reply_id" "uuid",
    "reported_profile_id" "uuid",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "resolution_note" "text",
    "status_updated_by" "uuid",
    "status_updated_at" timestamp with time zone,
    "actioned_by" "uuid",
    "actioned_at" timestamp with time zone,
    CONSTRAINT "reports_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'reviewing'::"text", 'dismissed'::"text", 'actioned'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."room_activity_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid" NOT NULL,
    "actor_id" "uuid",
    "event_type" "text" NOT NULL,
    "entity_table" "text" NOT NULL,
    "entity_id" "text" DEFAULT ''::"text" NOT NULL,
    "summary" "text" DEFAULT ''::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "room_activity_log_entity_id_check" CHECK (("char_length"("entity_id") <= 160)),
    CONSTRAINT "room_activity_log_entity_table_check" CHECK ((("char_length"("entity_table") >= 1) AND ("char_length"("entity_table") <= 120))),
    CONSTRAINT "room_activity_log_event_type_check" CHECK ((("char_length"("event_type") >= 1) AND ("char_length"("event_type") <= 120))),
    CONSTRAINT "room_activity_log_summary_check" CHECK (("char_length"("summary") <= 500))
);

CREATE TABLE IF NOT EXISTS "public"."room_directory_contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "role_title" "text" DEFAULT ''::"text" NOT NULL,
    "organization" "text" DEFAULT ''::"text" NOT NULL,
    "email" "text" DEFAULT ''::"text" NOT NULL,
    "phone" "text" DEFAULT ''::"text" NOT NULL,
    "website" "text" DEFAULT ''::"text" NOT NULL,
    "notes" "text" DEFAULT ''::"text" NOT NULL,
    "contact_type" "text" DEFAULT 'general'::"text" NOT NULL,
    "is_pinned" boolean DEFAULT false NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "room_directory_contacts_contact_type_check" CHECK (("contact_type" = ANY (ARRAY['general'::"text", 'board'::"text", 'management'::"text", 'maintenance'::"text", 'staff'::"text", 'vendor'::"text", 'emergency'::"text", 'other'::"text"]))),
    CONSTRAINT "room_directory_contacts_email_check" CHECK (("char_length"("email") <= 320)),
    CONSTRAINT "room_directory_contacts_name_check" CHECK ((("char_length"("name") >= 1) AND ("char_length"("name") <= 160))),
    CONSTRAINT "room_directory_contacts_notes_check" CHECK (("char_length"("notes") <= 4000)),
    CONSTRAINT "room_directory_contacts_organization_check" CHECK (("char_length"("organization") <= 160)),
    CONSTRAINT "room_directory_contacts_phone_check" CHECK (("char_length"("phone") <= 80)),
    CONSTRAINT "room_directory_contacts_role_title_check" CHECK (("char_length"("role_title") <= 160)),
    CONSTRAINT "room_directory_contacts_website_check" CHECK (("char_length"("website") <= 500))
);

CREATE TABLE IF NOT EXISTS "public"."room_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "category" "text" DEFAULT 'general'::"text" NOT NULL,
    "file_url" "text" NOT NULL,
    "is_pinned" boolean DEFAULT false NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "room_documents_category_check" CHECK ((("char_length"("category") >= 1) AND ("char_length"("category") <= 120))),
    CONSTRAINT "room_documents_description_check" CHECK (("char_length"("description") <= 4000)),
    CONSTRAINT "room_documents_file_url_check" CHECK ((("char_length"("file_url") >= 1) AND ("char_length"("file_url") <= 1000))),
    CONSTRAINT "room_documents_title_check" CHECK ((("char_length"("title") >= 1) AND ("char_length"("title") <= 180)))
);

CREATE TABLE IF NOT EXISTS "public"."room_faq_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid" NOT NULL,
    "question" "text" NOT NULL,
    "answer" "text" NOT NULL,
    "category" "text" DEFAULT 'general'::"text" NOT NULL,
    "is_pinned" boolean DEFAULT false NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "room_faq_entries_answer_check" CHECK ((("char_length"("answer") >= 1) AND ("char_length"("answer") <= 8000))),
    CONSTRAINT "room_faq_entries_category_check" CHECK ((("char_length"("category") >= 1) AND ("char_length"("category") <= 120))),
    CONSTRAINT "room_faq_entries_question_check" CHECK ((("char_length"("question") >= 1) AND ("char_length"("question") <= 240)))
);

CREATE TABLE IF NOT EXISTS "public"."room_form_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid" NOT NULL,
    "form_id" "uuid" NOT NULL,
    "submitted_by" "uuid",
    "answers" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "review_note" "text" DEFAULT ''::"text" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "room_form_submissions_answers_check" CHECK (("jsonb_typeof"("answers") = 'array'::"text")),
    CONSTRAINT "room_form_submissions_review_note_check" CHECK (("char_length"("review_note") <= 4000)),
    CONSTRAINT "room_form_submissions_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'reviewing'::"text", 'approved'::"text", 'rejected'::"text", 'archived'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."room_forms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "category" "text" DEFAULT 'general'::"text" NOT NULL,
    "questions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "room_forms_category_check" CHECK ((("char_length"("category") >= 1) AND ("char_length"("category") <= 120))),
    CONSTRAINT "room_forms_description_check" CHECK (("char_length"("description") <= 4000)),
    CONSTRAINT "room_forms_questions_check" CHECK (("jsonb_typeof"("questions") = 'array'::"text")),
    CONSTRAINT "room_forms_title_check" CHECK ((("char_length"("title") >= 1) AND ("char_length"("title") <= 180)))
);

CREATE TABLE IF NOT EXISTS "public"."room_join_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid" NOT NULL,
    "requester_user_id" "uuid" NOT NULL,
    "requester_contact" "text" DEFAULT ''::"text" NOT NULL,
    "requester_note" "text" DEFAULT ''::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "room_join_requests_requester_contact_check" CHECK (("char_length"("requester_contact") <= 200)),
    CONSTRAINT "room_join_requests_requester_note_check" CHECK (("char_length"("requester_note") <= 4000)),
    CONSTRAINT "room_join_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'cancelled'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."room_members" (
    "room_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "id" "uuid" DEFAULT "gen_random_uuid"(),
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "muted_until" timestamp with time zone,
    "suspended_until" timestamp with time zone,
    "moderation_note" "text",
    "moderated_by" "uuid",
    "moderated_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "public"."room_poll_votes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "poll_id" "uuid" NOT NULL,
    "room_id" "uuid" NOT NULL,
    "voter_id" "uuid" NOT NULL,
    "option_index" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "room_poll_votes_option_index_check" CHECK (("option_index" >= 0))
);

CREATE TABLE IF NOT EXISTS "public"."room_polls" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "options" "jsonb" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "created_by" "uuid",
    "closed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "room_polls_description_check" CHECK (("char_length"("description") <= 4000)),
    CONSTRAINT "room_polls_options_check" CHECK ((("jsonb_typeof"("options") = 'array'::"text") AND (("jsonb_array_length"("options") >= 2) AND ("jsonb_array_length"("options") <= 10)))),
    CONSTRAINT "room_polls_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'closed'::"text"]))),
    CONSTRAINT "room_polls_title_check" CHECK ((("char_length"("title") >= 1) AND ("char_length"("title") <= 200)))
);

CREATE TABLE IF NOT EXISTS "public"."room_post_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid" NOT NULL,
    "post_id" "uuid" NOT NULL,
    "uploader_id" "uuid" NOT NULL,
    "storage_bucket" "text" DEFAULT 'room-post-attachments'::"text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "mime_type" "text",
    "file_size" bigint,
    "kind" "text" DEFAULT 'file'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "room_post_attachments_kind_check" CHECK (("kind" = ANY (ARRAY['image'::"text", 'video'::"text", 'file'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."room_post_participants" (
    "room_id" "uuid" NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "added_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."room_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid" NOT NULL,
    "author_id" "uuid" NOT NULL,
    "title" "text",
    "body" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "deletion_reason" "text",
    "discussion_type" "text" DEFAULT 'open_discussion'::"text" NOT NULL,
    "discussion_metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "resolved_at" timestamp with time zone,
    "resolved_by" "uuid",
    "last_activity_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reply_count" integer DEFAULT 0 NOT NULL,
    "visibility_scope" "text" DEFAULT 'room'::"text" NOT NULL,
    CONSTRAINT "room_posts_discussion_metadata_object_check" CHECK (("jsonb_typeof"("discussion_metadata") = 'object'::"text")),
    CONSTRAINT "room_posts_discussion_type_check" CHECK (("discussion_type" = ANY (ARRAY['open_discussion'::"text", 'debate'::"text", 'research_question'::"text", 'problem_solving'::"text"]))),
    CONSTRAINT "room_posts_reply_count_check" CHECK (("reply_count" >= 0)),
    CONSTRAINT "room_posts_resolution_state_check" CHECK (((("status" = 'open'::"text") AND ("resolved_at" IS NULL) AND ("resolved_by" IS NULL)) OR (("status" = 'resolved'::"text") AND ("resolved_at" IS NOT NULL)))),
    CONSTRAINT "room_posts_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'resolved'::"text"]))),
    CONSTRAINT "room_posts_visibility_scope_check" CHECK (("visibility_scope" = ANY (ARRAY['room'::"text", 'author_and_staff'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."room_preferences" (
    "room_id" "uuid" NOT NULL,
    "display_name" "text" DEFAULT ''::"text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "privacy_mode" "text" DEFAULT 'private'::"text" NOT NULL,
    "room_status" "text" DEFAULT 'active'::"text" NOT NULL,
    "posting_rule" "text" DEFAULT 'members'::"text" NOT NULL,
    "join_rule" "text" DEFAULT 'owner_add_only'::"text" NOT NULL,
    "room_icon" "text" DEFAULT 'hub'::"text" NOT NULL,
    "theme_label" "text" DEFAULT 'default'::"text" NOT NULL,
    "calendar_enabled" boolean DEFAULT true NOT NULL,
    "announcements_enabled" boolean DEFAULT true NOT NULL,
    "requests_enabled" boolean DEFAULT true NOT NULL,
    "resources_enabled" boolean DEFAULT true NOT NULL,
    "services_enabled" boolean DEFAULT true NOT NULL,
    "members_enabled" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "room_preferences_description_check" CHECK (("char_length"("description") <= 4000)),
    CONSTRAINT "room_preferences_display_name_check" CHECK (("char_length"("display_name") <= 160)),
    CONSTRAINT "room_preferences_join_rule_check" CHECK (("join_rule" = ANY (ARRAY['owner_add_only'::"text", 'request_to_join'::"text", 'invite_only'::"text"]))),
    CONSTRAINT "room_preferences_posting_rule_check" CHECK (("posting_rule" = ANY (ARRAY['members'::"text", 'contributors'::"text", 'admins'::"text"]))),
    CONSTRAINT "room_preferences_privacy_mode_check" CHECK (("privacy_mode" = ANY (ARRAY['private'::"text", 'restricted'::"text", 'public_preview'::"text"]))),
    CONSTRAINT "room_preferences_room_icon_check" CHECK (("char_length"("room_icon") <= 80)),
    CONSTRAINT "room_preferences_room_status_check" CHECK (("room_status" = ANY (ARRAY['active'::"text", 'paused'::"text", 'archived'::"text"]))),
    CONSTRAINT "room_preferences_theme_label_check" CHECK (("char_length"("theme_label") <= 80))
);

CREATE TABLE IF NOT EXISTS "public"."room_product_templates" (
    "key" "text" NOT NULL,
    "name" "text" NOT NULL,
    "room_type" "text" NOT NULL,
    "description" "text" NOT NULL,
    "default_tabs" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "default_permissions" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."room_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "category" "text" DEFAULT 'general'::"text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "room_requests_body_check" CHECK ((("char_length"(TRIM(BOTH FROM "body")) >= 1) AND ("char_length"(TRIM(BOTH FROM "body")) <= 12000))),
    CONSTRAINT "room_requests_category_check" CHECK (("category" = ANY (ARRAY['general'::"text", 'maintenance'::"text", 'help'::"text", 'service'::"text", 'other'::"text"]))),
    CONSTRAINT "room_requests_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'in_progress'::"text", 'resolved'::"text", 'closed'::"text"]))),
    CONSTRAINT "room_requests_title_check" CHECK ((("char_length"(TRIM(BOTH FROM "title")) >= 1) AND ("char_length"(TRIM(BOTH FROM "title")) <= 160)))
);

CREATE TABLE IF NOT EXISTS "public"."room_service_listings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "listing_type" "text" DEFAULT 'service'::"text" NOT NULL,
    "price_label" "text" DEFAULT ''::"text" NOT NULL,
    "availability_label" "text" DEFAULT ''::"text" NOT NULL,
    "provider_name" "text" DEFAULT ''::"text" NOT NULL,
    "contact_label" "text" DEFAULT ''::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "is_featured" boolean DEFAULT false NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "room_service_listings_availability_label_check" CHECK (("char_length"("availability_label") <= 160)),
    CONSTRAINT "room_service_listings_contact_label_check" CHECK (("char_length"("contact_label") <= 200)),
    CONSTRAINT "room_service_listings_description_check" CHECK (("char_length"("description") <= 8000)),
    CONSTRAINT "room_service_listings_listing_type_check" CHECK (("listing_type" = ANY (ARRAY['service'::"text", 'product'::"text", 'offer'::"text", 'appointment'::"text", 'internal_request'::"text"]))),
    CONSTRAINT "room_service_listings_price_label_check" CHECK (("char_length"("price_label") <= 120)),
    CONSTRAINT "room_service_listings_provider_name_check" CHECK (("char_length"("provider_name") <= 160)),
    CONSTRAINT "room_service_listings_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'paused'::"text", 'archived'::"text"]))),
    CONSTRAINT "room_service_listings_title_check" CHECK ((("char_length"(TRIM(BOTH FROM "title")) >= 1) AND ("char_length"(TRIM(BOTH FROM "title")) <= 160)))
);

CREATE TABLE IF NOT EXISTS "public"."room_service_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid" NOT NULL,
    "listing_id" "uuid",
    "title" "text" NOT NULL,
    "details" "text" DEFAULT ''::"text" NOT NULL,
    "requested_for" "text" DEFAULT ''::"text" NOT NULL,
    "requester_contact" "text" DEFAULT ''::"text" NOT NULL,
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "room_service_requests_details_check" CHECK (("char_length"("details") <= 12000)),
    CONSTRAINT "room_service_requests_requested_for_check" CHECK (("char_length"("requested_for") <= 160)),
    CONSTRAINT "room_service_requests_requester_contact_check" CHECK (("char_length"("requester_contact") <= 200)),
    CONSTRAINT "room_service_requests_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'accepted'::"text", 'in_progress'::"text", 'completed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "room_service_requests_title_check" CHECK ((("char_length"(TRIM(BOTH FROM "title")) >= 1) AND ("char_length"(TRIM(BOTH FROM "title")) <= 160)))
);

CREATE TABLE IF NOT EXISTS "public"."room_subscription_plans" (
    "key" "text" NOT NULL,
    "name" "text" NOT NULL,
    "price_label" "text" NOT NULL,
    "member_limit_label" "text" NOT NULL,
    "checkout_mode" "text" DEFAULT 'self_serve'::"text" NOT NULL,
    "features" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."room_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "priority" "text" DEFAULT 'normal'::"text" NOT NULL,
    "due_at" timestamp with time zone,
    "assigned_user_id" "uuid",
    "created_by" "uuid",
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "room_tasks_description_check" CHECK (("char_length"("description") <= 4000)),
    CONSTRAINT "room_tasks_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'normal'::"text", 'high'::"text", 'urgent'::"text"]))),
    CONSTRAINT "room_tasks_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'in_progress'::"text", 'done'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "room_tasks_title_check" CHECK ((("char_length"("title") >= 1) AND ("char_length"("title") <= 200)))
);

CREATE TABLE IF NOT EXISTS "public"."rooms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "type" "text" DEFAULT 'Room'::"text" NOT NULL,
    "visibility" "text" DEFAULT 'public'::"text" NOT NULL,
    "is_private" boolean DEFAULT false NOT NULL,
    "member_count" integer DEFAULT 0 NOT NULL,
    "activity_count" integer DEFAULT 0 NOT NULL,
    "last_activity_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "template_key" "text",
    "subscription_plan" "text",
    "subscription_status" "text",
    "member_limit_label" "text",
    "default_tabs" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "default_permissions" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "owner_id" "uuid",
    "created_by" "uuid",
    "room_type" "text",
    "invite_only" boolean DEFAULT true NOT NULL,
    "join_code" "text",
    "join_code_updated_at" timestamp with time zone,
    "member_limit" integer,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "stripe_price_id" "text",
    "stripe_checkout_session_id" "text",
    "stripe_current_period_end" timestamp with time zone,
    "billing_updated_at" timestamp with time zone,
    "original_owner_id" "uuid",
    "archived_at" timestamp with time zone,
    "archived_by" "uuid",
    "deletion_requested_at" timestamp with time zone,
    "deletion_scheduled_for" timestamp with time zone,
    "deletion_requested_by" "uuid",
    "deletion_reason" "text",
    "ownership_transferred_at" timestamp with time zone,
    "admin_comped" boolean DEFAULT false NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."sticky_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "item_type" "text" NOT NULL,
    "source_key" "text" NOT NULL,
    "title" "text" NOT NULL,
    "subtitle" "text",
    "href" "text" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sticky_items_href_length" CHECK (("char_length"("href") <= 500)),
    CONSTRAINT "sticky_items_item_type_check" CHECK (("item_type" = ANY (ARRAY['discussion'::"text", 'saved'::"text", 'person'::"text", 'topic'::"text", 'note'::"text", 'ai_summary'::"text"]))),
    CONSTRAINT "sticky_items_subtitle_length" CHECK ((("subtitle" IS NULL) OR ("char_length"("subtitle") <= 500))),
    CONSTRAINT "sticky_items_title_length" CHECK (("char_length"("title") <= 240))
);

CREATE TABLE IF NOT EXISTS "public"."support_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "email" "text" NOT NULL,
    "category" "text" DEFAULT 'general'::"text" NOT NULL,
    "subject" "text" NOT NULL,
    "message" "text" NOT NULL,
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "admin_note" "text",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "support_requests_admin_note_length" CHECK ((("admin_note" IS NULL) OR ("char_length"("admin_note") <= 2000))),
    CONSTRAINT "support_requests_category_check" CHECK (("category" = ANY (ARRAY['general'::"text", 'account'::"text", 'billing'::"text", 'safety'::"text", 'accessibility'::"text", 'bug'::"text", 'feedback'::"text", 'legal'::"text"]))),
    CONSTRAINT "support_requests_email_length" CHECK ((("char_length"(TRIM(BOTH FROM "email")) >= 3) AND ("char_length"(TRIM(BOTH FROM "email")) <= 320))),
    CONSTRAINT "support_requests_message_length" CHECK ((("char_length"(TRIM(BOTH FROM "message")) >= 10) AND ("char_length"(TRIM(BOTH FROM "message")) <= 4000))),
    CONSTRAINT "support_requests_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'reviewing'::"text", 'resolved'::"text", 'closed'::"text"]))),
    CONSTRAINT "support_requests_subject_length" CHECK ((("char_length"(TRIM(BOTH FROM "subject")) >= 3) AND ("char_length"(TRIM(BOTH FROM "subject")) <= 160)))
);

CREATE TABLE IF NOT EXISTS "public"."user_ai_entitlements" (
    "user_id" "uuid" NOT NULL,
    "tier" "text" DEFAULT 'free'::"text" NOT NULL,
    "ai_assisted_enabled" boolean DEFAULT false NOT NULL,
    "monthly_summary_limit" integer DEFAULT 0 NOT NULL,
    "monthly_writing_limit" integer DEFAULT 0 NOT NULL,
    "monthly_research_limit" integer DEFAULT 0 NOT NULL,
    "monthly_discovery_limit" integer DEFAULT 0 NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "stripe_price_id" "text",
    "stripe_current_period_end" timestamp with time zone,
    "stripe_subscription_status" "text",
    CONSTRAINT "user_ai_entitlements_tier_check" CHECK (("tier" = ANY (ARRAY['free'::"text", 'premium'::"text", 'admin'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."user_blocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "blocker_id" "uuid" NOT NULL,
    "blocked_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_blocks_no_self_block" CHECK (("blocker_id" <> "blocked_id"))
);

CREATE TABLE IF NOT EXISTS "public"."user_purpose_goals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "purpose_lane" "text",
    "private_note" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    CONSTRAINT "user_purpose_goals_private_note_length_check" CHECK ((("private_note" IS NULL) OR ("char_length"("private_note") <= 1000))),
    CONSTRAINT "user_purpose_goals_purpose_lane_check" CHECK ((("purpose_lane" IS NULL) OR ("purpose_lane" = ANY (ARRAY['Learning'::"text", 'Mastery'::"text", 'Contribution'::"text", 'Community'::"text", 'Career transition'::"text", 'Human development'::"text", 'Local problem-solving'::"text", 'Life after automation'::"text"])))),
    CONSTRAINT "user_purpose_goals_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'paused'::"text", 'completed'::"text"]))),
    CONSTRAINT "user_purpose_goals_title_length_check" CHECK ((("char_length"(TRIM(BOTH FROM "title")) >= 1) AND ("char_length"(TRIM(BOTH FROM "title")) <= 120)))
);

CREATE TABLE IF NOT EXISTS "public"."user_push_device_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "platform" "text" DEFAULT 'ios'::"text" NOT NULL,
    "token_type" "text" DEFAULT 'apns'::"text" NOT NULL,
    "token" "text" NOT NULL,
    "device_id" "text",
    "app_version" "text",
    "enabled" boolean DEFAULT true NOT NULL,
    "last_registered_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_push_device_tokens_platform_check" CHECK (("platform" = ANY (ARRAY['ios'::"text", 'android'::"text", 'web'::"text", 'unknown'::"text"]))),
    CONSTRAINT "user_push_device_tokens_token_length_check" CHECK ((("char_length"("token") >= 16) AND ("char_length"("token") <= 4096))),
    CONSTRAINT "user_push_device_tokens_token_type_check" CHECK (("token_type" = ANY (ARRAY['apns'::"text", 'fcm'::"text", 'webpush'::"text", 'unknown'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."user_topic_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "topic" "text" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_topic_alerts_topic_length" CHECK ((("char_length"("topic") >= 1) AND ("char_length"("topic") <= 80)))
);

CREATE TABLE IF NOT EXISTS "public"."welcome_email_events" (
    "user_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "status" "text" DEFAULT 'sent'::"text" NOT NULL,
    "provider" "text" DEFAULT 'resend'::"text" NOT NULL,
    "provider_message_id" "text",
    "error_message" "text",
    "sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "welcome_email_events_email_length" CHECK ((("char_length"(TRIM(BOTH FROM "email")) >= 3) AND ("char_length"(TRIM(BOTH FROM "email")) <= 320))),
    CONSTRAINT "welcome_email_events_provider_check" CHECK (("provider" = ANY (ARRAY['resend'::"text", 'system'::"text"]))),
    CONSTRAINT "welcome_email_events_status_check" CHECK (("status" = ANY (ARRAY['sent'::"text", 'skipped'::"text", 'failed'::"text"])))
);

CREATE OR REPLACE FUNCTION "public"."is_discussion_audience_admin"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce((
    select profile.is_admin = true
    from public.profiles profile
    where profile.id = p_user_id
    limit 1
  ), false);
$$;

CREATE OR REPLACE FUNCTION "public"."can_view_discussion_audience_row"("p_discussion_id" "uuid", "p_author_id" "uuid", "p_audience_type" "text", "p_audience_base" "text", "p_viewer_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  normalized_type text := coalesce(nullif(p_audience_type, ''), 'public');
  normalized_base text := coalesce(nullif(p_audience_base, ''), 'public');
  base_allowed boolean := false;
  explicitly_included boolean := false;
  explicitly_excluded boolean := false;
begin
  if normalized_type = 'public' then
    return true;
  end if;

  if normalized_type in ('exclude_selected', 'custom')
    and normalized_base = 'public'
    and p_viewer_user_id is null
  then
    return true;
  end if;

  if p_viewer_user_id is null then
    return false;
  end if;

  if p_viewer_user_id = p_author_id
    or public.is_discussion_audience_admin(p_viewer_user_id)
  then
    return true;
  end if;

  if exists (
    select 1
    from public.user_blocks block
    where (
      block.blocker_id = p_author_id
      and block.blocked_id = p_viewer_user_id
    ) or (
      block.blocker_id = p_viewer_user_id
      and block.blocked_id = p_author_id
    )
  ) then
    return false;
  end if;

  select exists (
    select 1
    from public.discussion_audience_members member
    where member.discussion_id = p_discussion_id
      and member.user_id = p_viewer_user_id
      and member.access_kind = 'include'
  ) into explicitly_included;

  select exists (
    select 1
    from public.discussion_audience_members member
    where member.discussion_id = p_discussion_id
      and member.user_id = p_viewer_user_id
      and member.access_kind = 'exclude'
  ) into explicitly_excluded;

  if normalized_type = 'only_me' then
    return false;
  end if;

  if normalized_type = 'exclude_selected' then
    return not explicitly_excluded;
  end if;

  if normalized_type = 'selected' then
    return explicitly_included and not explicitly_excluded;
  end if;

  if normalized_type = 'followers' then
    return exists (
      select 1
      from public.follows relationship
      where relationship.follower_id = p_viewer_user_id
        and relationship.following_id = p_author_id
    );
  end if;

  if normalized_type = 'connections' then
    return exists (
      select 1
      from public.follows incoming
      where incoming.follower_id = p_viewer_user_id
        and incoming.following_id = p_author_id
    ) and exists (
      select 1
      from public.follows outgoing
      where outgoing.follower_id = p_author_id
        and outgoing.following_id = p_viewer_user_id
    );
  end if;

  if normalized_type = 'custom' then
    if normalized_base = 'public' then
      base_allowed := true;
    elsif normalized_base = 'followers' then
      base_allowed := exists (
        select 1
        from public.follows relationship
        where relationship.follower_id = p_viewer_user_id
          and relationship.following_id = p_author_id
      );
    elsif normalized_base = 'connections' then
      base_allowed := exists (
        select 1
        from public.follows incoming
        where incoming.follower_id = p_viewer_user_id
          and incoming.following_id = p_author_id
      ) and exists (
        select 1
        from public.follows outgoing
        where outgoing.follower_id = p_author_id
          and outgoing.following_id = p_viewer_user_id
      );
    end if;

    return (base_allowed or explicitly_included) and not explicitly_excluded;
  end if;

  return false;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."can_view_discussion_audience"("p_discussion_id" "uuid", "p_viewer_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
declare
  discussion_row record;
begin
  select
    discussion.id,
    discussion.user_id,
    discussion.audience_type,
    discussion.audience_base,
    discussion.deleted_at
  into discussion_row
  from public.discussions discussion
  where discussion.id = p_discussion_id;

  if discussion_row.id is null or discussion_row.deleted_at is not null then
    return false;
  end if;

  return public.can_view_discussion_audience_row(
    discussion_row.id,
    discussion_row.user_id,
    discussion_row.audience_type,
    discussion_row.audience_base,
    p_viewer_user_id
  );
end;
$$;

CREATE OR REPLACE FUNCTION "public"."can_view_discussion_audience_for_current_user"("p_discussion_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.can_view_discussion_audience(p_discussion_id, auth.uid());
$$;

CREATE OR REPLACE FUNCTION "public"."can_view_discussion_audience_row_for_current_user"("p_discussion_id" "uuid", "p_author_id" "uuid", "p_audience_type" "text", "p_audience_base" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.can_view_discussion_audience_row(
    p_discussion_id,
    p_author_id,
    p_audience_type,
    p_audience_base,
    auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION "public"."room_user_is_active_member"("target_room_id" "uuid", "target_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.room_members member
    where member.room_id = target_room_id
      and member.user_id = target_user_id
      and coalesce(member.status, 'active') not in ('blocked', 'removed', 'inactive')
      and (
        member.suspended_until is null
        or member.suspended_until <= now()
      )
  )
  or exists (
    select 1
    from public.rooms room
    where room.id = target_room_id
      and (room.owner_id = target_user_id or room.created_by = target_user_id)
  );
$$;

CREATE OR REPLACE FUNCTION "public"."room_user_is_staff"("target_room_id" "uuid", "target_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.rooms room
    where room.id = target_room_id
      and (room.owner_id = target_user_id or room.created_by = target_user_id)
  )
  or exists (
    select 1
    from public.room_members member
    where member.room_id = target_room_id
      and member.user_id = target_user_id
      and coalesce(member.status, 'active') not in ('blocked', 'removed', 'inactive')
      and (
        member.suspended_until is null
        or member.suspended_until <= now()
      )
      and member.role in ('owner', 'admin', 'administrator', 'moderator')
  );
$$;

CREATE OR REPLACE FUNCTION "public"."user_can_access_room_directory"("target_room_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    exists (
      select 1
      from public.room_members member
      where member.room_id = target_room_id
        and member.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.rooms room
      where room.id = target_room_id
        and (room.owner_id = auth.uid() or room.created_by = auth.uid())
    );
$$;

CREATE OR REPLACE FUNCTION "public"."user_can_access_room_documents"("target_room_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    exists (
      select 1
      from public.room_members member
      where member.room_id = target_room_id
        and member.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.rooms room
      where room.id = target_room_id
        and (room.owner_id = auth.uid() or room.created_by = auth.uid())
    );
$$;

CREATE OR REPLACE FUNCTION "public"."user_can_access_room_faq"("target_room_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    exists (
      select 1
      from public.room_members member
      where member.room_id = target_room_id
        and member.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.rooms room
      where room.id = target_room_id
        and (room.owner_id = auth.uid() or room.created_by = auth.uid())
    );
$$;

CREATE OR REPLACE FUNCTION "public"."user_can_access_room_forms"("target_room_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    exists (
      select 1
      from public.room_members member
      where member.room_id = target_room_id
        and member.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.rooms room
      where room.id = target_room_id
        and (room.owner_id = auth.uid() or room.created_by = auth.uid())
    );
$$;

CREATE OR REPLACE FUNCTION "public"."user_can_access_room_polls"("target_room_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    exists (
      select 1
      from public.room_members member
      where member.room_id = target_room_id
        and member.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.rooms room
      where room.id = target_room_id
        and (room.owner_id = auth.uid() or room.created_by = auth.uid())
    );
$$;

CREATE OR REPLACE FUNCTION "public"."user_can_access_room_post"("target_post_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.room_posts post
    where post.id = target_post_id
      and post.deleted_at is null
      and (
        (
          post.visibility_scope = 'room'
          and public.room_user_is_active_member(post.room_id, auth.uid())
        )
        or
        (
          post.visibility_scope = 'author_and_staff'
          and (
            post.author_id = auth.uid()
            or public.room_user_is_staff(post.room_id, auth.uid())
            or exists (
              select 1
              from public.room_post_participants participant
              where participant.post_id = post.id
                and participant.room_id = post.room_id
                and participant.user_id = auth.uid()
                and public.room_user_is_active_member(
                  participant.room_id,
                  participant.user_id
                )
            )
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION "public"."user_can_access_room_preferences"("target_room_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    exists (
      select 1
      from public.room_members member
      where member.room_id = target_room_id
        and member.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.rooms room
      where room.id = target_room_id
        and (room.owner_id = auth.uid() or room.created_by = auth.uid())
    );
$$;

CREATE OR REPLACE FUNCTION "public"."user_can_access_room_requests"("target_room_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    exists (
      select 1
      from public.room_members member
      where member.room_id = target_room_id
        and member.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.rooms room
      where room.id = target_room_id
        and (room.owner_id = auth.uid() or room.created_by = auth.uid())
    );
$$;

CREATE OR REPLACE FUNCTION "public"."user_can_access_room_services"("target_room_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    exists (
      select 1
      from public.room_members member
      where member.room_id = target_room_id
        and member.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.rooms room
      where room.id = target_room_id
        and (room.owner_id = auth.uid() or room.created_by = auth.uid())
    );
$$;

CREATE OR REPLACE FUNCTION "public"."user_can_access_room_tasks"("target_room_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    exists (
      select 1
      from public.room_members member
      where member.room_id = target_room_id
        and member.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.rooms room
      where room.id = target_room_id
        and (room.owner_id = auth.uid() or room.created_by = auth.uid())
    );
$$;

CREATE OR REPLACE FUNCTION "public"."user_can_manage_room_directory"("target_room_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    exists (
      select 1
      from public.room_members member
      where member.room_id = target_room_id
        and member.user_id = auth.uid()
        and member.role in ('owner', 'admin')
    )
    or exists (
      select 1
      from public.rooms room
      where room.id = target_room_id
        and (room.owner_id = auth.uid() or room.created_by = auth.uid())
    );
$$;

CREATE OR REPLACE FUNCTION "public"."user_can_manage_room_documents"("target_room_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    exists (
      select 1
      from public.room_members member
      where member.room_id = target_room_id
        and member.user_id = auth.uid()
        and member.role in ('owner', 'admin')
    )
    or exists (
      select 1
      from public.rooms room
      where room.id = target_room_id
        and (room.owner_id = auth.uid() or room.created_by = auth.uid())
    );
$$;

CREATE OR REPLACE FUNCTION "public"."user_can_manage_room_entry"("target_room_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    exists (
      select 1
      from public.room_members member
      where member.room_id = target_room_id
        and member.user_id = auth.uid()
        and member.role in ('owner', 'admin')
    )
    or exists (
      select 1
      from public.rooms room
      where room.id = target_room_id
        and (room.owner_id = auth.uid() or room.created_by = auth.uid())
    );
$$;

CREATE OR REPLACE FUNCTION "public"."user_can_manage_room_faq"("target_room_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    exists (
      select 1
      from public.room_members member
      where member.room_id = target_room_id
        and member.user_id = auth.uid()
        and member.role in ('owner', 'admin')
    )
    or exists (
      select 1
      from public.rooms room
      where room.id = target_room_id
        and (room.owner_id = auth.uid() or room.created_by = auth.uid())
    );
$$;

CREATE OR REPLACE FUNCTION "public"."user_can_manage_room_forms"("target_room_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    exists (
      select 1
      from public.room_members member
      where member.room_id = target_room_id
        and member.user_id = auth.uid()
        and member.role in ('owner', 'admin')
    )
    or exists (
      select 1
      from public.rooms room
      where room.id = target_room_id
        and (room.owner_id = auth.uid() or room.created_by = auth.uid())
    );
$$;

CREATE OR REPLACE FUNCTION "public"."user_can_manage_room_polls"("target_room_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    exists (
      select 1
      from public.room_members member
      where member.room_id = target_room_id
        and member.user_id = auth.uid()
        and member.role in ('owner', 'admin')
    )
    or exists (
      select 1
      from public.rooms room
      where room.id = target_room_id
        and (room.owner_id = auth.uid() or room.created_by = auth.uid())
    );
$$;

CREATE OR REPLACE FUNCTION "public"."user_can_manage_room_preferences"("target_room_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    exists (
      select 1
      from public.room_members member
      where member.room_id = target_room_id
        and member.user_id = auth.uid()
        and member.role in ('owner', 'admin')
    )
    or exists (
      select 1
      from public.rooms room
      where room.id = target_room_id
        and (room.owner_id = auth.uid() or room.created_by = auth.uid())
    );
$$;

CREATE OR REPLACE FUNCTION "public"."user_can_manage_room_requests"("target_room_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    exists (
      select 1
      from public.room_members member
      where member.room_id = target_room_id
        and member.user_id = auth.uid()
        and member.role in ('owner', 'admin')
    )
    or exists (
      select 1
      from public.rooms room
      where room.id = target_room_id
        and (room.owner_id = auth.uid() or room.created_by = auth.uid())
    );
$$;

CREATE OR REPLACE FUNCTION "public"."user_can_manage_room_services"("target_room_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    exists (
      select 1
      from public.room_members member
      where member.room_id = target_room_id
        and member.user_id = auth.uid()
        and member.role in ('owner', 'admin')
    )
    or exists (
      select 1
      from public.rooms room
      where room.id = target_room_id
        and (room.owner_id = auth.uid() or room.created_by = auth.uid())
    );
$$;

CREATE OR REPLACE FUNCTION "public"."user_can_manage_room_tasks"("target_room_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    exists (
      select 1
      from public.room_members member
      where member.room_id = target_room_id
        and member.user_id = auth.uid()
        and member.role in ('owner', 'admin')
    )
    or exists (
      select 1
      from public.rooms room
      where room.id = target_room_id
        and (room.owner_id = auth.uid() or room.created_by = auth.uid())
    );
$$;

CREATE OR REPLACE FUNCTION "public"."user_is_private_conversation_member"("target_conversation_id" "uuid", "target_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    target_user_id = auth.uid()
    and exists (
      select 1
      from public.private_conversation_members member
      where member.conversation_id = target_conversation_id
        and member.user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION "public"."user_is_loombus_admin"("target_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    target_user_id = auth.uid()
    and exists (
      select 1
      from public.profiles profile
      where profile.id = auth.uid()
        and profile.is_admin = true
    );
$$;

CREATE OR REPLACE FUNCTION "public"."user_can_read_private_messages"("target_conversation_id" "uuid", "target_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    target_user_id = auth.uid()
    and (
      public.user_is_private_conversation_member(
        target_conversation_id,
        auth.uid()
      )
      or public.user_is_loombus_admin(auth.uid())
    );
$$;

CREATE OR REPLACE FUNCTION "public"."user_can_request_join_room"("target_room_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    auth.uid() is not null
    and exists (
      select 1
      from public.room_preferences preferences
      where preferences.room_id = target_room_id
        and preferences.room_status = 'active'
        and preferences.join_rule = 'request_to_join'
    )
    and not exists (
      select 1
      from public.room_members member
      where member.room_id = target_room_id
        and member.user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION "public"."user_can_view_room_activity"("target_room_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    exists (
      select 1
      from public.room_members member
      where member.room_id = target_room_id
        and member.user_id = auth.uid()
        and member.role in ('owner', 'admin')
    )
    or exists (
      select 1
      from public.rooms room
      where room.id = target_room_id
        and (room.owner_id = auth.uid() or room.created_by = auth.uid())
    );
$$;

CREATE OR REPLACE FUNCTION "public"."user_can_vote_room_poll"("target_poll_id" "uuid", "target_room_id" "uuid", "target_option_index" integer) RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    auth.uid() is not null
    and public.user_can_access_room_polls(target_room_id)
    and exists (
      select 1
      from public.room_polls poll
      where poll.id = target_poll_id
        and poll.room_id = target_room_id
        and poll.status = 'open'
        and target_option_index >= 0
        and target_option_index < jsonb_array_length(poll.options)
    );
$$;

CREATE OR REPLACE FUNCTION "public"."user_has_bookmark_collection_access"("target_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    target_user_id = (select auth.uid())
    and (
      exists (
        select 1
        from public.user_ai_entitlements as entitlement
        where entitlement.user_id = target_user_id
          and entitlement.ai_assisted_enabled is true
          and entitlement.tier in ('premium', 'admin')
      )
      or exists (
        select 1
        from public.profiles as profile
        where profile.id = target_user_id
          and profile.is_admin is true
      )
    );
$$;

CREATE OR REPLACE FUNCTION "public"."user_has_discussion_draft_access"("target_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    target_user_id = auth.uid()
    and exists (
      select 1
      from public.user_ai_entitlements entitlement
      where entitlement.user_id = auth.uid()
        and entitlement.ai_assisted_enabled = true
        and entitlement.tier in ('premium', 'admin')
    );
$$;

CREATE OR REPLACE FUNCTION "public"."user_has_loombus_labs_access"("target_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    target_user_id = auth.uid()
    and (
      exists (
        select 1
        from public.profiles profile
        where profile.id = auth.uid()
          and profile.is_admin = true
      )
      or exists (
        select 1
        from public.user_ai_entitlements entitlement
        where entitlement.user_id = auth.uid()
          and (
            entitlement.tier = 'admin'
            or (
              entitlement.ai_assisted_enabled = true
              and entitlement.tier = 'premium'
              and entitlement.monthly_summary_limit > 50
            )
          )
      )
    );
$$;

CREATE OR REPLACE FUNCTION "public"."user_has_premium_topic_alert_access"("target_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    target_user_id = auth.uid()
    and exists (
      select 1
      from public.profiles profile
      left join public.user_ai_entitlements entitlement
        on entitlement.user_id = profile.id
      where profile.id = auth.uid()
        and (
          profile.is_admin = true
          or (
            entitlement.ai_assisted_enabled = true
            and entitlement.tier in ('premium', 'admin')
          )
        )
    );
$$;

CREATE OR REPLACE FUNCTION "public"."user_has_stickies_access"("target_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    target_user_id = auth.uid()
    and (
      exists (
        select 1
        from public.profiles profile
        where profile.id = auth.uid()
          and profile.is_admin = true
      )
      or exists (
        select 1
        from public.user_ai_entitlements entitlement
        where entitlement.user_id = auth.uid()
          and entitlement.ai_assisted_enabled = true
          and entitlement.tier in ('premium', 'premium_plus', 'admin')
      )
    );
$$;

CREATE OR REPLACE FUNCTION "public"."user_is_active_room_member"("target_room_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.room_members member
    where member.room_id = target_room_id
      and member.user_id = auth.uid()
      and coalesce(member.status, 'active')
        not in ('blocked', 'removed', 'inactive')
      and (
        member.suspended_until is null
        or member.suspended_until <= now()
      )
  )
  or exists (
    select 1
    from public.rooms room
    where room.id = target_room_id
      and (
        room.owner_id = auth.uid()
        or room.created_by = auth.uid()
      )
  );
$$;

CREATE OR REPLACE FUNCTION "public"."user_is_room_staff"("target_room_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.room_user_is_staff(target_room_id, auth.uid());
$$;

ALTER TABLE ONLY "public"."account_deletion_requests"
    ADD CONSTRAINT "account_deletion_requests_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."action_rate_events"
    ADD CONSTRAINT "action_rate_events_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."ai_extra_credit_ledger"
    ADD CONSTRAINT "ai_extra_credit_ledger_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."ai_extra_credit_packs"
    ADD CONSTRAINT "ai_extra_credit_packs_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."ai_extra_credit_packs"
    ADD CONSTRAINT "ai_extra_credit_packs_stripe_checkout_session_id_key" UNIQUE ("stripe_checkout_session_id");

ALTER TABLE ONLY "public"."ai_output_ratings"
    ADD CONSTRAINT "ai_output_ratings_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."ai_usage_events"
    ADD CONSTRAINT "ai_usage_events_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."bookmark_collections"
    ADD CONSTRAINT "bookmark_collections_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."bookmarks"
    ADD CONSTRAINT "bookmarks_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."discussion_ai_outputs"
    ADD CONSTRAINT "discussion_ai_outputs_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."discussion_attachments"
    ADD CONSTRAINT "discussion_attachments_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."discussion_attachments"
    ADD CONSTRAINT "discussion_attachments_unique_discussion_sort" UNIQUE ("discussion_id", "sort_order");

ALTER TABLE ONLY "public"."discussion_attachments"
    ADD CONSTRAINT "discussion_attachments_unique_path" UNIQUE ("storage_bucket", "storage_path");

ALTER TABLE ONLY "public"."discussion_audience_members"
    ADD CONSTRAINT "discussion_audience_members_pkey" PRIMARY KEY ("discussion_id", "user_id", "access_kind");

ALTER TABLE ONLY "public"."discussion_drafts"
    ADD CONSTRAINT "discussion_drafts_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."discussion_summaries"
    ADD CONSTRAINT "discussion_summaries_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."discussion_tags"
    ADD CONSTRAINT "discussion_tags_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."discussion_video_upload_events"
    ADD CONSTRAINT "discussion_video_upload_events_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."discussion_views"
    ADD CONSTRAINT "discussion_views_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."discussions"
    ADD CONSTRAINT "discussions_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."labs_feature_request_votes"
    ADD CONSTRAINT "labs_feature_request_votes_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."labs_feature_request_votes"
    ADD CONSTRAINT "labs_feature_request_votes_unique_user_request" UNIQUE ("request_id", "user_id");

ALTER TABLE ONLY "public"."labs_feature_requests"
    ADD CONSTRAINT "labs_feature_requests_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."loombus_feature_flags"
    ADD CONSTRAINT "loombus_feature_flags_pkey" PRIMARY KEY ("key");

ALTER TABLE ONLY "public"."loombus_room_discussions"
    ADD CONSTRAINT "loombus_room_discussions_pkey" PRIMARY KEY ("room_id", "discussion_id");

ALTER TABLE ONLY "public"."loombus_room_members"
    ADD CONSTRAINT "loombus_room_members_pkey" PRIMARY KEY ("room_id", "user_id");

ALTER TABLE ONLY "public"."loombus_rooms"
    ADD CONSTRAINT "loombus_rooms_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."loombus_rooms"
    ADD CONSTRAINT "loombus_rooms_slug_key" UNIQUE ("slug");

ALTER TABLE ONLY "public"."loombus_shell_preferences"
    ADD CONSTRAINT "loombus_shell_preferences_pkey" PRIMARY KEY ("user_id");

ALTER TABLE ONLY "public"."loombus_v2_create_drafts"
    ADD CONSTRAINT "loombus_v2_create_drafts_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."loombus_v2_create_drafts"
    ADD CONSTRAINT "loombus_v2_create_drafts_user_unique" UNIQUE ("user_id");

ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id");

ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."paste_usage_events"
    ADD CONSTRAINT "paste_usage_events_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."private_conversation_members"
    ADD CONSTRAINT "private_conversation_members_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."private_conversation_members"
    ADD CONSTRAINT "private_conversation_members_unique_user" UNIQUE ("conversation_id", "user_id");

ALTER TABLE ONLY "public"."private_conversations"
    ADD CONSTRAINT "private_conversations_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."private_message_attachments"
    ADD CONSTRAINT "private_message_attachments_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."private_message_attachments"
    ADD CONSTRAINT "private_message_attachments_unique_sort" UNIQUE ("message_id", "sort_order");

ALTER TABLE ONLY "public"."private_messages"
    ADD CONSTRAINT "private_messages_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."profile_sensitive"
    ADD CONSTRAINT "profile_sensitive_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");

ALTER TABLE ONLY "public"."replies"
    ADD CONSTRAINT "replies_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."reply_reactions"
    ADD CONSTRAINT "reply_reactions_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."reply_reactions"
    ADD CONSTRAINT "reply_reactions_unique_user_reply_type" UNIQUE ("reply_id", "user_id", "reaction_type");

ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."room_activity_log"
    ADD CONSTRAINT "room_activity_log_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."room_directory_contacts"
    ADD CONSTRAINT "room_directory_contacts_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."room_documents"
    ADD CONSTRAINT "room_documents_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."room_faq_entries"
    ADD CONSTRAINT "room_faq_entries_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."room_form_submissions"
    ADD CONSTRAINT "room_form_submissions_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."room_forms"
    ADD CONSTRAINT "room_forms_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."room_join_requests"
    ADD CONSTRAINT "room_join_requests_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."room_members"
    ADD CONSTRAINT "room_members_pkey" PRIMARY KEY ("room_id", "user_id");

ALTER TABLE ONLY "public"."room_poll_votes"
    ADD CONSTRAINT "room_poll_votes_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."room_poll_votes"
    ADD CONSTRAINT "room_poll_votes_poll_id_voter_id_key" UNIQUE ("poll_id", "voter_id");

ALTER TABLE ONLY "public"."room_polls"
    ADD CONSTRAINT "room_polls_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."room_post_attachments"
    ADD CONSTRAINT "room_post_attachments_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."room_post_attachments"
    ADD CONSTRAINT "room_post_attachments_storage_bucket_storage_path_key" UNIQUE ("storage_bucket", "storage_path");

ALTER TABLE ONLY "public"."room_post_participants"
    ADD CONSTRAINT "room_post_participants_pkey" PRIMARY KEY ("post_id", "user_id");

ALTER TABLE ONLY "public"."room_posts"
    ADD CONSTRAINT "room_posts_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."room_preferences"
    ADD CONSTRAINT "room_preferences_pkey" PRIMARY KEY ("room_id");

ALTER TABLE ONLY "public"."room_product_templates"
    ADD CONSTRAINT "room_product_templates_pkey" PRIMARY KEY ("key");

ALTER TABLE ONLY "public"."room_requests"
    ADD CONSTRAINT "room_requests_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."room_service_listings"
    ADD CONSTRAINT "room_service_listings_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."room_service_requests"
    ADD CONSTRAINT "room_service_requests_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."room_subscription_plans"
    ADD CONSTRAINT "room_subscription_plans_pkey" PRIMARY KEY ("key");

ALTER TABLE ONLY "public"."room_tasks"
    ADD CONSTRAINT "room_tasks_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."rooms"
    ADD CONSTRAINT "rooms_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."sticky_items"
    ADD CONSTRAINT "sticky_items_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."sticky_items"
    ADD CONSTRAINT "sticky_items_unique_source" UNIQUE ("user_id", "item_type", "source_key");

ALTER TABLE ONLY "public"."support_requests"
    ADD CONSTRAINT "support_requests_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."user_ai_entitlements"
    ADD CONSTRAINT "user_ai_entitlements_pkey" PRIMARY KEY ("user_id");

ALTER TABLE ONLY "public"."user_blocks"
    ADD CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."user_purpose_goals"
    ADD CONSTRAINT "user_purpose_goals_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."user_push_device_tokens"
    ADD CONSTRAINT "user_push_device_tokens_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."user_push_device_tokens"
    ADD CONSTRAINT "user_push_device_tokens_unique_token" UNIQUE ("token");

ALTER TABLE ONLY "public"."user_topic_alerts"
    ADD CONSTRAINT "user_topic_alerts_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."user_topic_alerts"
    ADD CONSTRAINT "user_topic_alerts_unique_user_topic" UNIQUE ("user_id", "topic");

ALTER TABLE ONLY "public"."welcome_email_events"
    ADD CONSTRAINT "welcome_email_events_pkey" PRIMARY KEY ("user_id");

CREATE UNIQUE INDEX "account_deletion_requests_open_user_idx" ON "public"."account_deletion_requests" USING "btree" ("user_id") WHERE ("status" = ANY (ARRAY['requested'::"text", 'reviewing'::"text"]));

CREATE UNIQUE INDEX "ai_output_ratings_user_discussion_feature_idx" ON "public"."ai_output_ratings" USING "btree" ("user_id", "discussion_id", "feature_key");

CREATE UNIQUE INDEX "bookmark_collections_user_name_unique" ON "public"."bookmark_collections" USING "btree" ("user_id", "lower"(TRIM(BOTH FROM "name")));

CREATE UNIQUE INDEX "bookmarks_user_discussion_unique" ON "public"."bookmarks" USING "btree" ("user_id", "discussion_id");

CREATE UNIQUE INDEX "discussion_ai_outputs_discussion_feature_idx" ON "public"."discussion_ai_outputs" USING "btree" ("discussion_id", "feature_key");

CREATE UNIQUE INDEX "discussion_attachments_one_video_per_discussion_idx" ON "public"."discussion_attachments" USING "btree" ("discussion_id") WHERE ("attachment_kind" = 'video'::"text");

CREATE UNIQUE INDEX "discussion_summaries_discussion_id_idx" ON "public"."discussion_summaries" USING "btree" ("discussion_id");

CREATE UNIQUE INDEX "discussion_tags_discussion_lower_tag_idx" ON "public"."discussion_tags" USING "btree" ("discussion_id", "lower"("tag"));

CREATE UNIQUE INDEX "discussion_views_discussion_viewer_unique" ON "public"."discussion_views" USING "btree" ("discussion_id", "viewer_id") WHERE ("viewer_id" IS NOT NULL);

CREATE UNIQUE INDEX "discussions_submission_fingerprint_unique_idx" ON "public"."discussions" USING "btree" ("submission_fingerprint") WHERE ("submission_fingerprint" IS NOT NULL);

CREATE UNIQUE INDEX "notification_preferences_email_digest_unsubscribe_token_idx" ON "public"."notification_preferences" USING "btree" ("email_digest_unsubscribe_token");

CREATE UNIQUE INDEX "profiles_unique_lower_username_idx" ON "public"."profiles" USING "btree" ("lower"("username")) WHERE (("username" IS NOT NULL) AND ("btrim"("username") <> ''::"text"));

CREATE UNIQUE INDEX "replies_submission_fingerprint_unique_idx" ON "public"."replies" USING "btree" ("submission_fingerprint") WHERE ("submission_fingerprint" IS NOT NULL);

CREATE UNIQUE INDEX "reports_unique_discussion_reporter_idx" ON "public"."reports" USING "btree" ("reporter_id", "discussion_id") WHERE (("discussion_id" IS NOT NULL) AND ("reply_id" IS NULL));

CREATE UNIQUE INDEX "reports_unique_profile_report_per_user_idx" ON "public"."reports" USING "btree" ("reporter_id", "reported_profile_id") WHERE ("reported_profile_id" IS NOT NULL);

CREATE UNIQUE INDEX "reports_unique_reply_reporter_idx" ON "public"."reports" USING "btree" ("reporter_id", "reply_id") WHERE ("reply_id" IS NOT NULL);

CREATE UNIQUE INDEX "room_join_requests_one_pending_idx" ON "public"."room_join_requests" USING "btree" ("room_id", "requester_user_id") WHERE ("status" = 'pending'::"text");

CREATE UNIQUE INDEX "room_members_id_unique_idx" ON "public"."room_members" USING "btree" ("id");

CREATE UNIQUE INDEX "room_members_room_user_unique_idx" ON "public"."room_members" USING "btree" ("room_id", "user_id");

CREATE UNIQUE INDEX "room_posts_id_room_unique_idx" ON "public"."room_posts" USING "btree" ("id", "room_id");

CREATE UNIQUE INDEX "rooms_join_code_unique" ON "public"."rooms" USING "btree" ("join_code") WHERE ("join_code" IS NOT NULL);

CREATE UNIQUE INDEX "rooms_stripe_checkout_session_unique_idx" ON "public"."rooms" USING "btree" ("stripe_checkout_session_id") WHERE ("stripe_checkout_session_id" IS NOT NULL);

CREATE UNIQUE INDEX "rooms_stripe_subscription_unique_idx" ON "public"."rooms" USING "btree" ("stripe_subscription_id") WHERE ("stripe_subscription_id" IS NOT NULL);

CREATE UNIQUE INDEX "user_blocks_unique_pair_idx" ON "public"."user_blocks" USING "btree" ("blocker_id", "blocked_id");

ALTER TABLE ONLY "public"."account_deletion_requests"
    ADD CONSTRAINT "account_deletion_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."account_deletion_requests"
    ADD CONSTRAINT "account_deletion_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."action_rate_events"
    ADD CONSTRAINT "action_rate_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."ai_extra_credit_ledger"
    ADD CONSTRAINT "ai_extra_credit_ledger_ai_usage_event_id_fkey" FOREIGN KEY ("ai_usage_event_id") REFERENCES "public"."ai_usage_events"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."ai_extra_credit_ledger"
    ADD CONSTRAINT "ai_extra_credit_ledger_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "public"."ai_extra_credit_packs"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."ai_extra_credit_ledger"
    ADD CONSTRAINT "ai_extra_credit_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."ai_extra_credit_packs"
    ADD CONSTRAINT "ai_extra_credit_packs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."ai_output_ratings"
    ADD CONSTRAINT "ai_output_ratings_discussion_id_fkey" FOREIGN KEY ("discussion_id") REFERENCES "public"."discussions"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."ai_output_ratings"
    ADD CONSTRAINT "ai_output_ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."ai_usage_events"
    ADD CONSTRAINT "ai_usage_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."bookmark_collections"
    ADD CONSTRAINT "bookmark_collections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."bookmarks"
    ADD CONSTRAINT "bookmarks_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "public"."bookmark_collections"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."bookmarks"
    ADD CONSTRAINT "bookmarks_discussion_id_fkey" FOREIGN KEY ("discussion_id") REFERENCES "public"."discussions"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."bookmarks"
    ADD CONSTRAINT "bookmarks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."discussion_ai_outputs"
    ADD CONSTRAINT "discussion_ai_outputs_discussion_id_fkey" FOREIGN KEY ("discussion_id") REFERENCES "public"."discussions"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."discussion_ai_outputs"
    ADD CONSTRAINT "discussion_ai_outputs_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."discussion_attachments"
    ADD CONSTRAINT "discussion_attachments_discussion_id_fkey" FOREIGN KEY ("discussion_id") REFERENCES "public"."discussions"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."discussion_attachments"
    ADD CONSTRAINT "discussion_attachments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."discussion_audience_members"
    ADD CONSTRAINT "discussion_audience_members_discussion_fk" FOREIGN KEY ("discussion_id") REFERENCES "public"."discussions"("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY "public"."discussion_audience_members"
    ADD CONSTRAINT "discussion_audience_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."discussion_drafts"
    ADD CONSTRAINT "discussion_drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."discussion_summaries"
    ADD CONSTRAINT "discussion_summaries_discussion_id_fkey" FOREIGN KEY ("discussion_id") REFERENCES "public"."discussions"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."discussion_summaries"
    ADD CONSTRAINT "discussion_summaries_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."discussion_tags"
    ADD CONSTRAINT "discussion_tags_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."discussion_tags"
    ADD CONSTRAINT "discussion_tags_discussion_id_fkey" FOREIGN KEY ("discussion_id") REFERENCES "public"."discussions"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."discussion_video_upload_events"
    ADD CONSTRAINT "discussion_video_upload_events_attachment_id_fkey" FOREIGN KEY ("attachment_id") REFERENCES "public"."discussion_attachments"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."discussion_video_upload_events"
    ADD CONSTRAINT "discussion_video_upload_events_discussion_id_fkey" FOREIGN KEY ("discussion_id") REFERENCES "public"."discussions"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."discussion_video_upload_events"
    ADD CONSTRAINT "discussion_video_upload_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."discussion_views"
    ADD CONSTRAINT "discussion_views_discussion_id_fkey" FOREIGN KEY ("discussion_id") REFERENCES "public"."discussions"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."discussion_views"
    ADD CONSTRAINT "discussion_views_viewer_id_fkey" FOREIGN KEY ("viewer_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."discussions"
    ADD CONSTRAINT "discussions_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."discussions"
    ADD CONSTRAINT "discussions_edited_by_fkey" FOREIGN KEY ("edited_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."discussions"
    ADD CONSTRAINT "discussions_pinned_by_fkey" FOREIGN KEY ("pinned_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."discussions"
    ADD CONSTRAINT "discussions_pinned_reply_id_fkey" FOREIGN KEY ("pinned_reply_id") REFERENCES "public"."replies"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."discussions"
    ADD CONSTRAINT "discussions_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."discussions"
    ADD CONSTRAINT "discussions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."labs_feature_request_votes"
    ADD CONSTRAINT "labs_feature_request_votes_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."labs_feature_requests"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."labs_feature_request_votes"
    ADD CONSTRAINT "labs_feature_request_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."labs_feature_requests"
    ADD CONSTRAINT "labs_feature_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."labs_feature_requests"
    ADD CONSTRAINT "labs_feature_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."loombus_room_discussions"
    ADD CONSTRAINT "loombus_room_discussions_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."loombus_room_discussions"
    ADD CONSTRAINT "loombus_room_discussions_discussion_id_fkey" FOREIGN KEY ("discussion_id") REFERENCES "public"."discussions"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."loombus_room_discussions"
    ADD CONSTRAINT "loombus_room_discussions_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."loombus_rooms"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."loombus_room_members"
    ADD CONSTRAINT "loombus_room_members_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."loombus_rooms"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."loombus_room_members"
    ADD CONSTRAINT "loombus_room_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."loombus_rooms"
    ADD CONSTRAINT "loombus_rooms_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."loombus_shell_preferences"
    ADD CONSTRAINT "loombus_shell_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."loombus_v2_create_drafts"
    ADD CONSTRAINT "loombus_v2_create_drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."paste_usage_events"
    ADD CONSTRAINT "paste_usage_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."private_conversation_members"
    ADD CONSTRAINT "private_conversation_members_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."private_conversations"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."private_conversation_members"
    ADD CONSTRAINT "private_conversation_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."private_conversations"
    ADD CONSTRAINT "private_conversations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."private_message_attachments"
    ADD CONSTRAINT "private_message_attachments_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."private_conversations"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."private_message_attachments"
    ADD CONSTRAINT "private_message_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."private_messages"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."private_message_attachments"
    ADD CONSTRAINT "private_message_attachments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."private_messages"
    ADD CONSTRAINT "private_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."private_conversations"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."private_messages"
    ADD CONSTRAINT "private_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."profile_sensitive"
    ADD CONSTRAINT "profile_sensitive_id_fkey" FOREIGN KEY ("id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_enforced_by_fkey" FOREIGN KEY ("enforced_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."replies"
    ADD CONSTRAINT "replies_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."replies"
    ADD CONSTRAINT "replies_discussion_id_fkey" FOREIGN KEY ("discussion_id") REFERENCES "public"."discussions"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."replies"
    ADD CONSTRAINT "replies_edited_by_fkey" FOREIGN KEY ("edited_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."replies"
    ADD CONSTRAINT "replies_referenced_reply_id_fkey" FOREIGN KEY ("referenced_reply_id") REFERENCES "public"."replies"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."replies"
    ADD CONSTRAINT "replies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."reply_reactions"
    ADD CONSTRAINT "reply_reactions_reply_id_fkey" FOREIGN KEY ("reply_id") REFERENCES "public"."replies"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."reply_reactions"
    ADD CONSTRAINT "reply_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_actioned_by_fkey" FOREIGN KEY ("actioned_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_discussion_id_fkey" FOREIGN KEY ("discussion_id") REFERENCES "public"."discussions"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_reply_id_fkey" FOREIGN KEY ("reply_id") REFERENCES "public"."replies"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_reported_profile_id_fkey" FOREIGN KEY ("reported_profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_status_updated_by_fkey" FOREIGN KEY ("status_updated_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."room_activity_log"
    ADD CONSTRAINT "room_activity_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."room_activity_log"
    ADD CONSTRAINT "room_activity_log_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."room_directory_contacts"
    ADD CONSTRAINT "room_directory_contacts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."room_directory_contacts"
    ADD CONSTRAINT "room_directory_contacts_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."room_directory_contacts"
    ADD CONSTRAINT "room_directory_contacts_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."room_documents"
    ADD CONSTRAINT "room_documents_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."room_documents"
    ADD CONSTRAINT "room_documents_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."room_documents"
    ADD CONSTRAINT "room_documents_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."room_faq_entries"
    ADD CONSTRAINT "room_faq_entries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."room_faq_entries"
    ADD CONSTRAINT "room_faq_entries_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."room_faq_entries"
    ADD CONSTRAINT "room_faq_entries_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."room_form_submissions"
    ADD CONSTRAINT "room_form_submissions_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "public"."room_forms"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."room_form_submissions"
    ADD CONSTRAINT "room_form_submissions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."room_form_submissions"
    ADD CONSTRAINT "room_form_submissions_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."room_form_submissions"
    ADD CONSTRAINT "room_form_submissions_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."room_forms"
    ADD CONSTRAINT "room_forms_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."room_forms"
    ADD CONSTRAINT "room_forms_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."room_forms"
    ADD CONSTRAINT "room_forms_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."room_join_requests"
    ADD CONSTRAINT "room_join_requests_requester_user_id_fkey" FOREIGN KEY ("requester_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."room_join_requests"
    ADD CONSTRAINT "room_join_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."room_join_requests"
    ADD CONSTRAINT "room_join_requests_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."room_members"
    ADD CONSTRAINT "room_members_moderated_by_fkey" FOREIGN KEY ("moderated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."room_members"
    ADD CONSTRAINT "room_members_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."room_members"
    ADD CONSTRAINT "room_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."room_poll_votes"
    ADD CONSTRAINT "room_poll_votes_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "public"."room_polls"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."room_poll_votes"
    ADD CONSTRAINT "room_poll_votes_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."room_poll_votes"
    ADD CONSTRAINT "room_poll_votes_voter_id_fkey" FOREIGN KEY ("voter_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."room_polls"
    ADD CONSTRAINT "room_polls_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."room_polls"
    ADD CONSTRAINT "room_polls_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."room_post_attachments"
    ADD CONSTRAINT "room_post_attachments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."room_posts"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."room_post_attachments"
    ADD CONSTRAINT "room_post_attachments_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."room_post_attachments"
    ADD CONSTRAINT "room_post_attachments_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."room_post_participants"
    ADD CONSTRAINT "room_post_participants_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."room_post_participants"
    ADD CONSTRAINT "room_post_participants_post_room_fk" FOREIGN KEY ("post_id", "room_id") REFERENCES "public"."room_posts"("id", "room_id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."room_post_participants"
    ADD CONSTRAINT "room_post_participants_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."room_post_participants"
    ADD CONSTRAINT "room_post_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."room_posts"
    ADD CONSTRAINT "room_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."room_posts"
    ADD CONSTRAINT "room_posts_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."room_posts"
    ADD CONSTRAINT "room_posts_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."room_posts"
    ADD CONSTRAINT "room_posts_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."room_preferences"
    ADD CONSTRAINT "room_preferences_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."room_preferences"
    ADD CONSTRAINT "room_preferences_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."room_preferences"
    ADD CONSTRAINT "room_preferences_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."room_requests"
    ADD CONSTRAINT "room_requests_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."room_requests"
    ADD CONSTRAINT "room_requests_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."room_requests"
    ADD CONSTRAINT "room_requests_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."room_service_listings"
    ADD CONSTRAINT "room_service_listings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."room_service_listings"
    ADD CONSTRAINT "room_service_listings_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."room_service_listings"
    ADD CONSTRAINT "room_service_listings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."room_service_requests"
    ADD CONSTRAINT "room_service_requests_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."room_service_requests"
    ADD CONSTRAINT "room_service_requests_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."room_service_listings"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."room_service_requests"
    ADD CONSTRAINT "room_service_requests_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."room_service_requests"
    ADD CONSTRAINT "room_service_requests_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."room_tasks"
    ADD CONSTRAINT "room_tasks_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."room_tasks"
    ADD CONSTRAINT "room_tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."room_tasks"
    ADD CONSTRAINT "room_tasks_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."rooms"
    ADD CONSTRAINT "rooms_archived_by_fkey" FOREIGN KEY ("archived_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."rooms"
    ADD CONSTRAINT "rooms_deletion_requested_by_fkey" FOREIGN KEY ("deletion_requested_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."rooms"
    ADD CONSTRAINT "rooms_original_owner_id_fkey" FOREIGN KEY ("original_owner_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."sticky_items"
    ADD CONSTRAINT "sticky_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."support_requests"
    ADD CONSTRAINT "support_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."support_requests"
    ADD CONSTRAINT "support_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."user_ai_entitlements"
    ADD CONSTRAINT "user_ai_entitlements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."user_blocks"
    ADD CONSTRAINT "user_blocks_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."user_blocks"
    ADD CONSTRAINT "user_blocks_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."user_purpose_goals"
    ADD CONSTRAINT "user_purpose_goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."user_push_device_tokens"
    ADD CONSTRAINT "user_push_device_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."user_topic_alerts"
    ADD CONSTRAINT "user_topic_alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."welcome_email_events"
    ADD CONSTRAINT "welcome_email_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

COMMENT ON FUNCTION "public"."user_can_read_private_messages"("target_conversation_id" "uuid", "target_user_id" "uuid") IS 'Security definer helper for private message conversation/member/message read policies. Allows conversation members and Loombus admins.';

COMMENT ON FUNCTION "public"."user_has_stickies_access"("target_user_id" "uuid") IS 'Stickies access check used by sticky_items RLS. Premium, Premium Plus, and admin users can access Stickies.';

COMMENT ON FUNCTION "public"."user_is_private_conversation_member"("target_conversation_id" "uuid", "target_user_id" "uuid") IS 'Security definer helper used by private message RLS policies to avoid recursive policy evaluation on private_conversation_members.';

ALTER TABLE "public"."account_deletion_requests" OWNER TO "postgres";

ALTER TABLE "public"."action_rate_events" OWNER TO "postgres";

ALTER TABLE "public"."ai_extra_credit_ledger" OWNER TO "postgres";

COMMENT ON TABLE "public"."ai_extra_credit_ledger" IS 'Audit ledger for Extra AI Pack purchases, consumption, refunds, and adjustments.';

COMMENT ON COLUMN "public"."ai_extra_credit_ledger"."credits_delta" IS 'Positive for purchases/adjustments, negative for consumed credits.';

ALTER TABLE "public"."ai_extra_credit_packs" OWNER TO "postgres";

COMMENT ON TABLE "public"."ai_extra_credit_packs" IS 'One-time Extra AI Pack purchases and remaining credit balances.';

COMMENT ON COLUMN "public"."ai_extra_credit_packs"."remaining_credits" IS 'Credits remaining from this purchased Extra AI Pack.';

ALTER TABLE "public"."ai_output_ratings" OWNER TO "postgres";

COMMENT ON TABLE "public"."ai_output_ratings" IS 'Helpful / not helpful ratings submitted by members for Loombus AI-assisted discussion outputs.';

COMMENT ON COLUMN "public"."ai_output_ratings"."feature_key" IS 'AI feature being rated: thread_summary, key_takeaways, what_changed, or disagreement_map.';

COMMENT ON COLUMN "public"."ai_output_ratings"."rating" IS 'User rating for the AI output: helpful or not_helpful.';

COMMENT ON COLUMN "public"."ai_output_ratings"."source_content_hash" IS 'Optional content hash for the AI output source at the time of rating.';

ALTER TABLE "public"."ai_usage_events" OWNER TO "postgres";

COMMENT ON TABLE "public"."ai_usage_events" IS 'Usage log for Premium AI-Assisted Layer features.';

COMMENT ON COLUMN "public"."ai_usage_events"."feature_key" IS 'AI feature used, such as thread_summary, writing_assist, research_mode, discovery, or moderation_assist.';

COMMENT ON COLUMN "public"."ai_usage_events"."prompt_tokens" IS 'Prompt/input tokens reported by the AI provider, when available.';

COMMENT ON COLUMN "public"."ai_usage_events"."completion_tokens" IS 'Completion/output tokens reported by the AI provider, when available.';

COMMENT ON COLUMN "public"."ai_usage_events"."total_tokens" IS 'Total tokens reported by the AI provider, when available.';

COMMENT ON COLUMN "public"."ai_usage_events"."estimated_cost_usd" IS 'Estimated USD cost for this AI event based on provider/model pricing at logging time.';

ALTER TABLE "public"."audit_logs" OWNER TO "postgres";

ALTER TABLE "public"."bookmark_collections" OWNER TO "postgres";

ALTER TABLE "public"."bookmarks" OWNER TO "postgres";

ALTER TABLE "public"."discussion_ai_outputs" OWNER TO "postgres";

COMMENT ON TABLE "public"."discussion_ai_outputs" IS 'Reusable cached outputs for Premium AI-Assisted Layer discussion features.';

COMMENT ON COLUMN "public"."discussion_ai_outputs"."feature_key" IS 'AI feature key such as key_takeaways, what_changed, disagreement_map, research_summary, writing_assist, or moderation_assist.';

COMMENT ON COLUMN "public"."discussion_ai_outputs"."source_content_hash" IS 'Hash of the discussion and visible reply source used to decide whether cached AI output is stale.';

ALTER TABLE "public"."discussion_attachments" OWNER TO "postgres";

COMMENT ON TABLE "public"."discussion_attachments" IS 'Metadata for images and PDFs attached to Loombus discussions.';

COMMENT ON COLUMN "public"."discussion_attachments"."storage_path" IS 'Storage object path inside the discussion-attachments bucket. First folder must be the uploader profile id.';

COMMENT ON COLUMN "public"."discussion_attachments"."public_url" IS 'Public storage URL used to display the attachment.';

COMMENT ON COLUMN "public"."discussion_attachments"."attachment_kind" IS 'Attachment display type: image or pdf.';

COMMENT ON COLUMN "public"."discussion_attachments"."video_duration_seconds" IS 'Video Context duration in seconds. Null for image and PDF attachments.';

ALTER TABLE "public"."discussion_audience_members" OWNER TO "postgres";

ALTER TABLE "public"."discussion_drafts" OWNER TO "postgres";

COMMENT ON COLUMN "public"."discussion_drafts"."reality_lens" IS 'Optional Phase 2 human-reality lens saved with discussion drafts.';

COMMENT ON COLUMN "public"."discussion_drafts"."purpose_lane" IS 'Optional draft purpose direction. Not therapy, diagnosis, life coaching, scoring, or ranking.';

ALTER TABLE "public"."discussion_summaries" OWNER TO "postgres";

COMMENT ON TABLE "public"."discussion_summaries" IS 'Cached AI-assisted discussion summaries. Summaries are generated server-side and reused.';

COMMENT ON COLUMN "public"."discussion_summaries"."source_content_hash" IS 'Hash of the discussion/reply source text used to determine whether a cached summary is stale.';

ALTER TABLE "public"."discussion_tags" OWNER TO "postgres";

COMMENT ON TABLE "public"."discussion_tags" IS 'Optional secondary tags for discussions beyond the primary topic lane.';

COMMENT ON COLUMN "public"."discussion_tags"."tag" IS 'Short human-readable tag such as AI ethics, publishing, startups, or housing.';

ALTER TABLE "public"."discussion_video_upload_events" OWNER TO "postgres";

COMMENT ON TABLE "public"."discussion_video_upload_events" IS 'Monthly usage ledger for Loombus Video Context uploads. Rows remain even when videos are deleted so deleted videos still count against the monthly quota.';

ALTER TABLE "public"."discussion_views" OWNER TO "postgres";

ALTER TABLE "public"."discussions" OWNER TO "postgres";

COMMENT ON COLUMN "public"."discussions"."updated_at" IS 'Timestamp of the most recent discussion content update.';

COMMENT ON COLUMN "public"."discussions"."edited_at" IS 'Timestamp of the most recent user-visible edit.';

COMMENT ON COLUMN "public"."discussions"."edited_by" IS 'User id that most recently edited the discussion.';

COMMENT ON COLUMN "public"."discussions"."edit_count" IS 'Number of times the published discussion has been edited.';

COMMENT ON COLUMN "public"."discussions"."pinned_reply_id" IS 'Reply highlighted by a discussion author or admin as especially useful.';

COMMENT ON COLUMN "public"."discussions"."pinned_at" IS 'Timestamp when a reply was pinned to the discussion.';

COMMENT ON COLUMN "public"."discussions"."pinned_by" IS 'User id of the member or admin who pinned the reply.';

COMMENT ON COLUMN "public"."discussions"."purpose_lane" IS 'Optional discussion purpose direction. Not therapy, diagnosis, life coaching, scoring, or ranking.';

COMMENT ON COLUMN "public"."discussions"."discussion_type" IS 'Structured discussion mode: open_discussion, debate, research_question, or problem_solving.';

COMMENT ON COLUMN "public"."discussions"."discussion_metadata" IS 'Flexible structured fields for discussion modes, stored as JSON.';

COMMENT ON COLUMN "public"."discussions"."submission_fingerprint" IS 'Server-generated daily fingerprint used to prevent repeated Discussion submissions.';

ALTER TABLE "public"."profiles" OWNER TO "postgres";

COMMENT ON COLUMN "public"."profiles"."creator_website_url" IS 'Optional public creator website/profile link for Premium Plus/Admin users.';

COMMENT ON COLUMN "public"."profiles"."creator_support_url" IS 'Optional public support link for Premium Plus/Admin users.';

COMMENT ON COLUMN "public"."profiles"."creator_support_label" IS 'Optional display label for the support link.';

COMMENT ON COLUMN "public"."profiles"."account_status" IS 'Account enforcement status: active, warned, suspended, or banned.';

COMMENT ON COLUMN "public"."profiles"."enforcement_reason" IS 'Short admin-facing reason for the latest account enforcement action.';

COMMENT ON COLUMN "public"."profiles"."enforcement_note" IS 'Optional admin note for account enforcement context.';

COMMENT ON COLUMN "public"."profiles"."enforced_by" IS 'Admin profile that last changed account enforcement status.';

COMMENT ON COLUMN "public"."profiles"."enforced_at" IS 'Timestamp of the latest account enforcement status change.';

COMMENT ON COLUMN "public"."profiles"."suspended_until" IS 'Timestamp when a temporary suspension ends. Null for non-suspended or indefinite states.';

COMMENT ON COLUMN "public"."profiles"."perspective_marker" IS 'Optional self-selected perspective context shown on profile. Not a verification claim, expertise score, ranking, or trust score.';

COMMENT ON COLUMN "public"."profiles"."identity_verification_status" IS 'Provider-agnostic Loombus identity verification state: unverified, pending, verified, failed, or restricted.';

COMMENT ON COLUMN "public"."profiles"."identity_verification_provider" IS 'Identity verification provider used for the current verification state. Expected values include manual or idme.';

COMMENT ON COLUMN "public"."profiles"."identity_provider_subject" IS 'External provider subject/reference identifier. Do not store raw identity documents, selfies, biometric data, or full provider payloads here.';

COMMENT ON COLUMN "public"."profiles"."identity_verified_at" IS 'Timestamp when Loombus accepted the user as identity verified.';

COMMENT ON COLUMN "public"."profiles"."identity_verification_last_checked_at" IS 'Timestamp when Loombus last checked or refreshed the user identity verification state.';

COMMENT ON COLUMN "public"."profiles"."legal_name_verified" IS 'True when the user legal name has been verified by an approved provider or admin process.';

COMMENT ON COLUMN "public"."profiles"."identity_restriction_reason" IS 'Short admin/provider reason for failed or restricted identity verification. Do not store sensitive identity-document details.';

ALTER TABLE "public"."follows" OWNER TO "postgres";

ALTER TABLE "public"."labs_feature_request_votes" OWNER TO "postgres";

COMMENT ON TABLE "public"."labs_feature_request_votes" IS 'Upvote-only votes on Loombus Labs feature requests by Premium Plus/Admin members.';

COMMENT ON COLUMN "public"."labs_feature_request_votes"."request_id" IS 'Labs feature request receiving the vote.';

COMMENT ON COLUMN "public"."labs_feature_request_votes"."user_id" IS 'Premium Plus/Admin member who cast the vote.';

ALTER TABLE "public"."labs_feature_requests" OWNER TO "postgres";

COMMENT ON TABLE "public"."labs_feature_requests" IS 'Premium Plus/Admin Loombus Labs feature requests and admin review workflow.';

COMMENT ON COLUMN "public"."labs_feature_requests"."status" IS 'Labs request status: submitted, reviewing, planned, shipped, or declined.';

ALTER TABLE "public"."loombus_feature_flags" OWNER TO "postgres";

COMMENT ON TABLE "public"."loombus_feature_flags" IS 'Dark-launch flags for Loombus V2 backend and shell features. Rollout allowlists are private and must be resolved server-side.';

ALTER TABLE "public"."loombus_room_discussions" OWNER TO "postgres";

COMMENT ON TABLE "public"."loombus_room_discussions" IS 'Join table linking existing discussions into V2 rooms.';

ALTER TABLE "public"."loombus_room_members" OWNER TO "postgres";

COMMENT ON TABLE "public"."loombus_room_members" IS 'Membership table for V2 rooms.';

ALTER TABLE "public"."loombus_rooms" OWNER TO "postgres";

COMMENT ON TABLE "public"."loombus_rooms" IS 'V2 room directory for communities, labs, local spaces, and private groups.';

ALTER TABLE "public"."loombus_shell_preferences" OWNER TO "postgres";

COMMENT ON TABLE "public"."loombus_shell_preferences" IS 'Per-user shell/layout preference storage for Loombus V2, including System, Dark Gold, and Light Blue appearance modes.';

ALTER TABLE "public"."loombus_v2_create_drafts" OWNER TO "postgres";

ALTER TABLE "public"."notification_preferences" OWNER TO "postgres";

COMMENT ON COLUMN "public"."notification_preferences"."followed_discussions_enabled" IS 'Whether this member wants in-app notifications when people they follow publish new discussions.';

COMMENT ON COLUMN "public"."notification_preferences"."followed_replies_enabled" IS 'Whether this member wants in-app notifications when people they follow post replies.';

COMMENT ON COLUMN "public"."notification_preferences"."email_digest_enabled" IS 'Whether this member opted in to email digests.';

COMMENT ON COLUMN "public"."notification_preferences"."email_digest_frequency" IS 'Email digest frequency: daily or weekly.';

COMMENT ON COLUMN "public"."notification_preferences"."email_digest_last_sent_at" IS 'Timestamp when the latest email digest was successfully sent.';

COMMENT ON COLUMN "public"."notification_preferences"."email_digest_unsubscribe_token" IS 'Durable token used by the public one-click email digest unsubscribe route.';

COMMENT ON COLUMN "public"."notification_preferences"."push_messages_enabled" IS 'Whether this member wants native push notifications for private messages.';

COMMENT ON COLUMN "public"."notification_preferences"."push_replies_enabled" IS 'Whether this member wants native push notifications for replies to their discussions.';

COMMENT ON COLUMN "public"."notification_preferences"."push_follows_enabled" IS 'Whether this member wants native push notifications for new followers.';

COMMENT ON COLUMN "public"."notification_preferences"."push_admin_reports_enabled" IS 'Whether this admin wants native push notifications for newly filed reports.';

ALTER TABLE "public"."notifications" OWNER TO "postgres";

ALTER TABLE "public"."paste_usage_events" OWNER TO "postgres";

ALTER TABLE "public"."private_conversation_members" OWNER TO "postgres";

COMMENT ON TABLE "public"."private_conversation_members" IS 'Per-user membership and inbox state for private conversations. deleted_at hides a conversation for one user and does not hard-delete moderation evidence.';

COMMENT ON COLUMN "public"."private_conversation_members"."muted_at" IS 'When set, notifications for this conversation are suppressed for the member until unmuted.';

ALTER TABLE "public"."private_conversations" OWNER TO "postgres";

COMMENT ON TABLE "public"."private_conversations" IS 'Private message conversation containers. Phase 1 database foundation only; visible UI and API routes are added later.';

ALTER TABLE "public"."private_message_attachments" OWNER TO "postgres";

COMMENT ON TABLE "public"."private_message_attachments" IS 'Attachment records for private messages. Uploads are inserted by service-role APIs after validating conversation membership.';

COMMENT ON COLUMN "public"."private_message_attachments"."storage_bucket" IS 'Supabase Storage bucket name. Expected bucket: message-attachments.';

ALTER TABLE "public"."private_messages" OWNER TO "postgres";

COMMENT ON TABLE "public"."private_messages" IS 'Private text messages. Phase 1 supports text-only messages; user deletion does not hard-delete records so reports and moderation history can be preserved.';

COMMENT ON COLUMN "public"."private_messages"."message_type" IS 'Reserved for future message types. Phase 1 only allows text.';

COMMENT ON COLUMN "public"."private_messages"."read_by_recipient_at" IS 'Internal read tracking for unread counts and inbox state. Not exposed as user-visible read receipts in Phase 1.';

ALTER TABLE "public"."profile_sensitive" OWNER TO "postgres";

ALTER TABLE "public"."replies" OWNER TO "postgres";

COMMENT ON COLUMN "public"."replies"."updated_at" IS 'Timestamp when a reply was last updated.';

COMMENT ON COLUMN "public"."replies"."edited_at" IS 'Timestamp when a reply was last edited by a user or admin.';

COMMENT ON COLUMN "public"."replies"."edited_by" IS 'User id of the member or admin who last edited the reply.';

COMMENT ON COLUMN "public"."replies"."edit_count" IS 'Number of times a reply has been edited.';

COMMENT ON COLUMN "public"."replies"."referenced_reply_id" IS 'Optional reply reference for Respond to a point. This is not a nested thread parent.';

COMMENT ON COLUMN "public"."replies"."quoted_excerpt" IS 'Short stored excerpt from the referenced reply for display context.';

COMMENT ON COLUMN "public"."replies"."submission_fingerprint" IS 'Server-generated daily fingerprint used to prevent repeated Reply submissions.';

ALTER TABLE "public"."reply_reactions" OWNER TO "postgres";

COMMENT ON TABLE "public"."reply_reactions" IS 'Depth-based reaction signals for Loombus replies.';

COMMENT ON COLUMN "public"."reply_reactions"."reaction_type" IS 'Reaction type: helpful, insightful, well_reasoned, changed_my_view, or needs_evidence.';

ALTER TABLE "public"."reports" OWNER TO "postgres";

COMMENT ON COLUMN "public"."reports"."status" IS 'Moderation report workflow status: new, reviewing, dismissed, or actioned.';

COMMENT ON COLUMN "public"."reports"."reported_profile_id" IS 'Profile/user being reported. Used for member-submitted public profile reports.';

COMMENT ON COLUMN "public"."reports"."reviewed_by" IS 'Admin profile id that reviewed or resolved the report.';

COMMENT ON COLUMN "public"."reports"."reviewed_at" IS 'Timestamp when an admin marked the report reviewed.';

COMMENT ON COLUMN "public"."reports"."resolution_note" IS 'Optional admin note describing how the report was handled.';

COMMENT ON COLUMN "public"."reports"."status_updated_by" IS 'Admin who last changed the report workflow status.';

COMMENT ON COLUMN "public"."reports"."status_updated_at" IS 'Timestamp when the report workflow status was last changed.';

COMMENT ON COLUMN "public"."reports"."actioned_by" IS 'Admin who took a moderation action because of this report, when applicable.';

COMMENT ON COLUMN "public"."reports"."actioned_at" IS 'Timestamp when a moderation action was taken because of this report, when applicable.';

ALTER TABLE "public"."room_activity_log" OWNER TO "postgres";

ALTER TABLE "public"."room_directory_contacts" OWNER TO "postgres";

ALTER TABLE "public"."room_documents" OWNER TO "postgres";

ALTER TABLE "public"."room_faq_entries" OWNER TO "postgres";

ALTER TABLE "public"."room_form_submissions" OWNER TO "postgres";

ALTER TABLE "public"."room_forms" OWNER TO "postgres";

ALTER TABLE "public"."room_join_requests" OWNER TO "postgres";

ALTER TABLE ONLY "public"."room_members" REPLICA IDENTITY FULL;

ALTER TABLE "public"."room_members" OWNER TO "postgres";

ALTER TABLE "public"."room_poll_votes" OWNER TO "postgres";

ALTER TABLE "public"."room_polls" OWNER TO "postgres";

ALTER TABLE "public"."room_post_attachments" OWNER TO "postgres";

ALTER TABLE "public"."room_post_participants" OWNER TO "postgres";

COMMENT ON TABLE "public"."room_post_participants" IS 'Active Room members explicitly added by staff to isolated Customer Support cases.';

ALTER TABLE ONLY "public"."room_posts" REPLICA IDENTITY FULL;

ALTER TABLE "public"."room_posts" OWNER TO "postgres";

COMMENT ON TABLE "public"."room_posts" IS 'Structured private room discussion posts. Soft-deleted posts remain auditable.';

COMMENT ON COLUMN "public"."room_posts"."discussion_type" IS 'Room discussion mode. Room discussions intentionally do not use public Topics.';

COMMENT ON COLUMN "public"."room_posts"."discussion_metadata" IS 'Validated structured fields for the selected Room discussion mode.';

COMMENT ON COLUMN "public"."room_posts"."status" IS 'Thread workflow state: open or resolved.';

COMMENT ON COLUMN "public"."room_posts"."visibility_scope" IS 'Non-toggleable thread visibility derived from Room type: room or author_and_staff.';

ALTER TABLE "public"."room_preferences" OWNER TO "postgres";

ALTER TABLE "public"."room_product_templates" OWNER TO "postgres";

ALTER TABLE "public"."room_requests" OWNER TO "postgres";

ALTER TABLE "public"."room_service_listings" OWNER TO "postgres";

ALTER TABLE "public"."room_service_requests" OWNER TO "postgres";

ALTER TABLE "public"."room_subscription_plans" OWNER TO "postgres";

ALTER TABLE "public"."room_tasks" OWNER TO "postgres";

ALTER TABLE ONLY "public"."rooms" REPLICA IDENTITY FULL;

ALTER TABLE "public"."rooms" OWNER TO "postgres";

COMMENT ON TABLE "public"."rooms" IS 'Private Loombus room records used by the canonical Live Rooms workspace.';

COMMENT ON COLUMN "public"."rooms"."admin_comped" IS 'True when Loombus grants the Room plan directly to an administrator without Stripe billing.';

ALTER TABLE "public"."sticky_items" OWNER TO "postgres";

COMMENT ON TABLE "public"."sticky_items" IS 'Premium workspace items pinned by users. Separate from bookmarks/saved library.';

ALTER TABLE "public"."support_requests" OWNER TO "postgres";

COMMENT ON TABLE "public"."support_requests" IS 'Structured support/contact requests submitted through Loombus contact workflows.';

COMMENT ON COLUMN "public"."support_requests"."category" IS 'Support request category: general, account, billing, safety, accessibility, bug, feedback, or legal.';

COMMENT ON COLUMN "public"."support_requests"."status" IS 'Admin review status: new, reviewing, resolved, or closed.';

ALTER TABLE "public"."user_ai_entitlements" OWNER TO "postgres";

COMMENT ON TABLE "public"."user_ai_entitlements" IS 'Premium AI-Assisted Layer entitlements for Loombus members.';

COMMENT ON COLUMN "public"."user_ai_entitlements"."stripe_customer_id" IS 'Stripe customer id used to open Billing Portal sessions.';

COMMENT ON COLUMN "public"."user_ai_entitlements"."stripe_subscription_id" IS 'Current Stripe subscription id for the member, when available.';

COMMENT ON COLUMN "public"."user_ai_entitlements"."stripe_price_id" IS 'Current Stripe price id for the active subscription item, when available.';

COMMENT ON COLUMN "public"."user_ai_entitlements"."stripe_current_period_end" IS 'Current Stripe subscription period end, when available.';

COMMENT ON COLUMN "public"."user_ai_entitlements"."stripe_subscription_status" IS 'Latest known Stripe subscription status for billing portal/account display.';

ALTER TABLE "public"."user_blocks" OWNER TO "postgres";

COMMENT ON TABLE "public"."user_blocks" IS 'User-to-user block relationships. A blocker can prevent follow interactions with a blocked profile.';

ALTER TABLE "public"."user_purpose_goals" OWNER TO "postgres";

COMMENT ON TABLE "public"."user_purpose_goals" IS 'Private user-owned contribution and purpose goals. Not public reputation, therapy, diagnosis, life coaching, scoring, or ranking.';

COMMENT ON COLUMN "public"."user_purpose_goals"."purpose_lane" IS 'Optional Purpose Lane connection for a private goal.';

COMMENT ON COLUMN "public"."user_purpose_goals"."private_note" IS 'Private note for why this goal matters or what the user may do next.';

ALTER TABLE "public"."user_push_device_tokens" OWNER TO "postgres";

COMMENT ON TABLE "public"."user_push_device_tokens" IS 'Native mobile push notification device tokens registered by authenticated Loombus users.';

COMMENT ON COLUMN "public"."user_push_device_tokens"."token" IS 'Native push token. On iOS this is the APNs token returned through Capacitor PushNotifications registration.';

ALTER TABLE "public"."user_topic_alerts" OWNER TO "postgres";

COMMENT ON TABLE "public"."user_topic_alerts" IS 'Premium/Admin member-selected topic alerts for new discussion notifications.';

COMMENT ON COLUMN "public"."user_topic_alerts"."topic" IS 'Primary discussion topic lane the member wants alerts for.';

COMMENT ON COLUMN "public"."user_topic_alerts"."enabled" IS 'Whether the topic alert is currently active.';

ALTER TABLE "public"."welcome_email_events" OWNER TO "postgres";

COMMENT ON TABLE "public"."welcome_email_events" IS 'One-time welcome email delivery tracking for Loombus product email.';

COMMENT ON COLUMN "public"."welcome_email_events"."status" IS 'Welcome email delivery status: sent, skipped, or failed.';

COMMENT ON COLUMN "public"."welcome_email_events"."provider_message_id" IS 'Email provider message id, when available.';

CREATE INDEX "account_deletion_requests_status_requested_idx" ON "public"."account_deletion_requests" USING "btree" ("status", "requested_at" DESC);

CREATE INDEX "account_deletion_requests_user_id_idx" ON "public"."account_deletion_requests" USING "btree" ("user_id");

CREATE INDEX "action_rate_events_target_idx" ON "public"."action_rate_events" USING "btree" ("target_id");

CREATE INDEX "action_rate_events_user_action_created_idx" ON "public"."action_rate_events" USING "btree" ("user_id", "action_key", "created_at" DESC);

CREATE INDEX "ai_extra_credit_ledger_pack_created_idx" ON "public"."ai_extra_credit_ledger" USING "btree" ("pack_id", "created_at" DESC);

CREATE INDEX "ai_extra_credit_ledger_user_created_idx" ON "public"."ai_extra_credit_ledger" USING "btree" ("user_id", "created_at" DESC);

CREATE INDEX "ai_extra_credit_packs_stripe_checkout_idx" ON "public"."ai_extra_credit_packs" USING "btree" ("stripe_checkout_session_id");

CREATE INDEX "ai_extra_credit_packs_user_status_idx" ON "public"."ai_extra_credit_packs" USING "btree" ("user_id", "status", "created_at" DESC);

CREATE INDEX "ai_output_ratings_created_at_idx" ON "public"."ai_output_ratings" USING "btree" ("created_at");

CREATE INDEX "ai_output_ratings_discussion_feature_idx" ON "public"."ai_output_ratings" USING "btree" ("discussion_id", "feature_key");

CREATE INDEX "ai_output_ratings_feature_rating_idx" ON "public"."ai_output_ratings" USING "btree" ("feature_key", "rating");

CREATE INDEX "ai_usage_events_created_at_idx" ON "public"."ai_usage_events" USING "btree" ("created_at");

CREATE INDEX "ai_usage_events_estimated_cost_usd_idx" ON "public"."ai_usage_events" USING "btree" ("estimated_cost_usd");

CREATE INDEX "ai_usage_events_feature_key_idx" ON "public"."ai_usage_events" USING "btree" ("feature_key");

CREATE INDEX "ai_usage_events_provider_model_idx" ON "public"."ai_usage_events" USING "btree" ("provider", "model_name");

CREATE INDEX "ai_usage_events_user_id_idx" ON "public"."ai_usage_events" USING "btree" ("user_id");

CREATE INDEX "audit_logs_action_idx" ON "public"."audit_logs" USING "btree" ("action");

CREATE INDEX "audit_logs_actor_id_idx" ON "public"."audit_logs" USING "btree" ("actor_id");

CREATE INDEX "audit_logs_created_at_idx" ON "public"."audit_logs" USING "btree" ("created_at" DESC);

CREATE INDEX "bookmark_collections_user_created_idx" ON "public"."bookmark_collections" USING "btree" ("user_id", "created_at" DESC);

CREATE INDEX "bookmarks_user_collection_created_idx" ON "public"."bookmarks" USING "btree" ("user_id", "collection_id", "created_at" DESC);

CREATE INDEX "bookmarks_user_private_note_updated_idx" ON "public"."bookmarks" USING "btree" ("user_id", "private_note_updated_at" DESC) WHERE ("private_note" IS NOT NULL);

CREATE INDEX "discussion_ai_outputs_discussion_id_idx" ON "public"."discussion_ai_outputs" USING "btree" ("discussion_id");

CREATE INDEX "discussion_ai_outputs_feature_key_idx" ON "public"."discussion_ai_outputs" USING "btree" ("feature_key");

CREATE INDEX "discussion_ai_outputs_generated_at_idx" ON "public"."discussion_ai_outputs" USING "btree" ("generated_at");

CREATE INDEX "discussion_attachments_discussion_sort_idx" ON "public"."discussion_attachments" USING "btree" ("discussion_id", "sort_order", "created_at");

CREATE INDEX "discussion_attachments_kind_idx" ON "public"."discussion_attachments" USING "btree" ("attachment_kind");

CREATE INDEX "discussion_attachments_user_created_idx" ON "public"."discussion_attachments" USING "btree" ("user_id", "created_at" DESC);

CREATE INDEX "discussion_audience_members_user_idx" ON "public"."discussion_audience_members" USING "btree" ("user_id", "discussion_id");

CREATE INDEX "discussion_drafts_user_updated_idx" ON "public"."discussion_drafts" USING "btree" ("user_id", "updated_at" DESC);

CREATE INDEX "discussion_summaries_generated_at_idx" ON "public"."discussion_summaries" USING "btree" ("generated_at");

CREATE INDEX "discussion_tags_discussion_id_idx" ON "public"."discussion_tags" USING "btree" ("discussion_id");

CREATE INDEX "discussion_tags_lower_tag_idx" ON "public"."discussion_tags" USING "btree" ("lower"("tag"));

CREATE INDEX "discussion_video_upload_events_attachment_idx" ON "public"."discussion_video_upload_events" USING "btree" ("attachment_id");

CREATE INDEX "discussion_video_upload_events_user_created_idx" ON "public"."discussion_video_upload_events" USING "btree" ("user_id", "created_at" DESC);

CREATE INDEX "discussion_views_author_lookup_idx" ON "public"."discussion_views" USING "btree" ("discussion_id", "viewed_at" DESC);

CREATE INDEX "discussion_views_discussion_created_idx" ON "public"."discussion_views" USING "btree" ("discussion_id", "created_at" DESC);

CREATE INDEX "discussion_views_viewer_created_idx" ON "public"."discussion_views" USING "btree" ("viewer_id", "created_at" DESC) WHERE ("viewer_id" IS NOT NULL);

CREATE INDEX "discussions_edited_at_idx" ON "public"."discussions" USING "btree" ("edited_at" DESC) WHERE ("edited_at" IS NOT NULL);

CREATE INDEX "discussions_pinned_at_idx" ON "public"."discussions" USING "btree" ("pinned_at" DESC) WHERE ("pinned_at" IS NOT NULL);

CREATE INDEX "discussions_pinned_reply_id_idx" ON "public"."discussions" USING "btree" ("pinned_reply_id") WHERE ("pinned_reply_id" IS NOT NULL);

CREATE INDEX "discussions_purpose_lane_created_at_idx" ON "public"."discussions" USING "btree" ("purpose_lane", "created_at" DESC) WHERE ("purpose_lane" IS NOT NULL);

CREATE INDEX "discussions_reality_lens_created_at_idx" ON "public"."discussions" USING "btree" ("reality_lens", "created_at" DESC) WHERE ("reality_lens" IS NOT NULL);

CREATE INDEX "discussions_resolved_at_idx" ON "public"."discussions" USING "btree" ("resolved_at" DESC) WHERE ("resolved_at" IS NOT NULL);

CREATE INDEX "discussions_status_created_at_idx" ON "public"."discussions" USING "btree" ("discussion_status", "created_at" DESC) WHERE ("deleted_at" IS NULL);

CREATE INDEX "discussions_user_updated_idx" ON "public"."discussions" USING "btree" ("user_id", "updated_at" DESC);

CREATE INDEX "labs_feature_request_votes_request_idx" ON "public"."labs_feature_request_votes" USING "btree" ("request_id", "created_at" DESC);

CREATE INDEX "labs_feature_request_votes_user_idx" ON "public"."labs_feature_request_votes" USING "btree" ("user_id", "created_at" DESC);

CREATE INDEX "labs_feature_requests_reviewed_by_idx" ON "public"."labs_feature_requests" USING "btree" ("reviewed_by");

CREATE INDEX "labs_feature_requests_status_created_idx" ON "public"."labs_feature_requests" USING "btree" ("status", "created_at" DESC);

CREATE INDEX "labs_feature_requests_user_created_idx" ON "public"."labs_feature_requests" USING "btree" ("user_id", "created_at" DESC);

CREATE INDEX "loombus_feature_flags_enabled_idx" ON "public"."loombus_feature_flags" USING "btree" ("enabled");

CREATE INDEX "loombus_room_discussions_discussion_idx" ON "public"."loombus_room_discussions" USING "btree" ("discussion_id");

CREATE INDEX "loombus_room_members_user_idx" ON "public"."loombus_room_members" USING "btree" ("user_id", "status");

CREATE INDEX "loombus_rooms_status_visibility_idx" ON "public"."loombus_rooms" USING "btree" ("status", "visibility");

CREATE INDEX "loombus_rooms_type_idx" ON "public"."loombus_rooms" USING "btree" ("room_type");

CREATE INDEX "loombus_v2_create_drafts_user_updated_idx" ON "public"."loombus_v2_create_drafts" USING "btree" ("user_id", "updated_at" DESC);

CREATE INDEX "notification_preferences_email_digest_idx" ON "public"."notification_preferences" USING "btree" ("email_digest_enabled", "email_digest_frequency", "email_digest_last_sent_at");

CREATE INDEX "notification_preferences_push_enabled_idx" ON "public"."notification_preferences" USING "btree" ("user_id", "push_messages_enabled", "push_replies_enabled", "push_follows_enabled", "push_admin_reports_enabled");

CREATE INDEX "notifications_user_room_created_idx" ON "public"."notifications" USING "btree" ("user_id", "room_id", "created_at" DESC) WHERE ("room_id" IS NOT NULL);

CREATE INDEX "paste_usage_events_user_created_idx" ON "public"."paste_usage_events" USING "btree" ("user_id", "created_at" DESC);

CREATE INDEX "private_conversation_members_conversation_id_idx" ON "public"."private_conversation_members" USING "btree" ("conversation_id");

CREATE INDEX "private_conversation_members_user_id_idx" ON "public"."private_conversation_members" USING "btree" ("user_id");

CREATE INDEX "private_conversations_last_message_at_idx" ON "public"."private_conversations" USING "btree" ("last_message_at" DESC NULLS LAST);

CREATE INDEX "private_message_attachments_conversation_idx" ON "public"."private_message_attachments" USING "btree" ("conversation_id", "created_at" DESC);

CREATE INDEX "private_message_attachments_message_idx" ON "public"."private_message_attachments" USING "btree" ("message_id", "sort_order");

CREATE INDEX "private_messages_conversation_created_idx" ON "public"."private_messages" USING "btree" ("conversation_id", "created_at");

CREATE INDEX "private_messages_sender_created_idx" ON "public"."private_messages" USING "btree" ("sender_id", "created_at" DESC);

CREATE INDEX "profiles_account_status_idx" ON "public"."profiles" USING "btree" ("account_status");

CREATE INDEX "profiles_enforced_at_idx" ON "public"."profiles" USING "btree" ("enforced_at");

CREATE INDEX "profiles_enforced_by_idx" ON "public"."profiles" USING "btree" ("enforced_by");

CREATE INDEX "profiles_identity_provider_subject_idx" ON "public"."profiles" USING "btree" ("identity_provider_subject") WHERE ("identity_provider_subject" IS NOT NULL);

CREATE INDEX "profiles_identity_verification_provider_idx" ON "public"."profiles" USING "btree" ("identity_verification_provider");

CREATE INDEX "profiles_identity_verification_status_idx" ON "public"."profiles" USING "btree" ("identity_verification_status");

CREATE INDEX "profiles_identity_verified_at_idx" ON "public"."profiles" USING "btree" ("identity_verified_at") WHERE ("identity_verified_at" IS NOT NULL);

CREATE INDEX "profiles_suspended_until_idx" ON "public"."profiles" USING "btree" ("suspended_until");

CREATE INDEX "replies_edited_at_idx" ON "public"."replies" USING "btree" ("edited_at" DESC) WHERE ("edited_at" IS NOT NULL);

CREATE INDEX "replies_referenced_reply_id_idx" ON "public"."replies" USING "btree" ("referenced_reply_id") WHERE ("referenced_reply_id" IS NOT NULL);

CREATE INDEX "replies_user_updated_at_idx" ON "public"."replies" USING "btree" ("user_id", "updated_at" DESC) WHERE ("deleted_at" IS NULL);

CREATE INDEX "reply_reactions_reply_idx" ON "public"."reply_reactions" USING "btree" ("reply_id", "created_at" DESC);

CREATE INDEX "reply_reactions_user_idx" ON "public"."reply_reactions" USING "btree" ("user_id", "created_at" DESC);

CREATE INDEX "reports_actioned_at_idx" ON "public"."reports" USING "btree" ("actioned_at");

CREATE INDEX "reports_actioned_by_idx" ON "public"."reports" USING "btree" ("actioned_by");

CREATE INDEX "reports_reply_id_idx" ON "public"."reports" USING "btree" ("reply_id");

CREATE INDEX "reports_reported_profile_id_idx" ON "public"."reports" USING "btree" ("reported_profile_id");

CREATE INDEX "reports_reviewed_at_idx" ON "public"."reports" USING "btree" ("reviewed_at");

CREATE INDEX "reports_reviewed_by_idx" ON "public"."reports" USING "btree" ("reviewed_by");

CREATE INDEX "reports_status_created_idx" ON "public"."reports" USING "btree" ("status", "created_at" DESC);

CREATE INDEX "reports_status_updated_at_idx" ON "public"."reports" USING "btree" ("status_updated_at");

CREATE INDEX "reports_status_updated_by_idx" ON "public"."reports" USING "btree" ("status_updated_by");

CREATE INDEX "room_activity_log_actor_idx" ON "public"."room_activity_log" USING "btree" ("actor_id");

CREATE INDEX "room_activity_log_event_type_idx" ON "public"."room_activity_log" USING "btree" ("event_type");

CREATE INDEX "room_activity_log_room_created_idx" ON "public"."room_activity_log" USING "btree" ("room_id", "created_at" DESC);

CREATE INDEX "room_directory_contacts_created_by_idx" ON "public"."room_directory_contacts" USING "btree" ("created_by");

CREATE INDEX "room_directory_contacts_room_idx" ON "public"."room_directory_contacts" USING "btree" ("room_id", "is_pinned" DESC, "contact_type", "name");

CREATE INDEX "room_directory_contacts_type_idx" ON "public"."room_directory_contacts" USING "btree" ("contact_type");

CREATE INDEX "room_documents_category_idx" ON "public"."room_documents" USING "btree" ("category");

CREATE INDEX "room_documents_created_by_idx" ON "public"."room_documents" USING "btree" ("created_by");

CREATE INDEX "room_documents_room_idx" ON "public"."room_documents" USING "btree" ("room_id", "is_pinned" DESC, "category", "title");

CREATE INDEX "room_faq_entries_category_idx" ON "public"."room_faq_entries" USING "btree" ("category");

CREATE INDEX "room_faq_entries_created_by_idx" ON "public"."room_faq_entries" USING "btree" ("created_by");

CREATE INDEX "room_faq_entries_room_idx" ON "public"."room_faq_entries" USING "btree" ("room_id", "is_pinned" DESC, "category", "question");

CREATE INDEX "room_form_submissions_form_idx" ON "public"."room_form_submissions" USING "btree" ("form_id", "status", "updated_at" DESC);

CREATE INDEX "room_form_submissions_room_idx" ON "public"."room_form_submissions" USING "btree" ("room_id", "status", "updated_at" DESC);

CREATE INDEX "room_form_submissions_submitted_by_idx" ON "public"."room_form_submissions" USING "btree" ("submitted_by");

CREATE INDEX "room_forms_category_idx" ON "public"."room_forms" USING "btree" ("category");

CREATE INDEX "room_forms_created_by_idx" ON "public"."room_forms" USING "btree" ("created_by");

CREATE INDEX "room_forms_room_idx" ON "public"."room_forms" USING "btree" ("room_id", "category", "title");

CREATE INDEX "room_join_requests_requester_idx" ON "public"."room_join_requests" USING "btree" ("requester_user_id");

CREATE INDEX "room_join_requests_room_status_idx" ON "public"."room_join_requests" USING "btree" ("room_id", "status");

CREATE INDEX "room_members_room_muted_idx" ON "public"."room_members" USING "btree" ("room_id", "muted_until") WHERE ("muted_until" IS NOT NULL);

CREATE INDEX "room_members_room_status_idx" ON "public"."room_members" USING "btree" ("room_id", "status");

CREATE INDEX "room_members_room_suspended_idx" ON "public"."room_members" USING "btree" ("room_id", "suspended_until") WHERE ("suspended_until" IS NOT NULL);

CREATE INDEX "room_members_user_status_idx" ON "public"."room_members" USING "btree" ("user_id", "status");

CREATE INDEX "room_poll_votes_poll_idx" ON "public"."room_poll_votes" USING "btree" ("poll_id");

CREATE INDEX "room_poll_votes_room_idx" ON "public"."room_poll_votes" USING "btree" ("room_id");

CREATE INDEX "room_poll_votes_voter_idx" ON "public"."room_poll_votes" USING "btree" ("voter_id");

CREATE INDEX "room_polls_created_by_idx" ON "public"."room_polls" USING "btree" ("created_by");

CREATE INDEX "room_polls_room_status_idx" ON "public"."room_polls" USING "btree" ("room_id", "status", "updated_at" DESC);

CREATE INDEX "room_post_attachments_created_at_idx" ON "public"."room_post_attachments" USING "btree" ("created_at" DESC);

CREATE INDEX "room_post_attachments_post_id_idx" ON "public"."room_post_attachments" USING "btree" ("post_id");

CREATE INDEX "room_post_attachments_room_id_idx" ON "public"."room_post_attachments" USING "btree" ("room_id");

CREATE INDEX "room_post_participants_post_created_idx" ON "public"."room_post_participants" USING "btree" ("post_id", "created_at");

CREATE INDEX "room_post_participants_room_user_idx" ON "public"."room_post_participants" USING "btree" ("room_id", "user_id", "created_at" DESC);

CREATE INDEX "room_posts_author_idx" ON "public"."room_posts" USING "btree" ("author_id", "created_at" DESC);

CREATE INDEX "room_posts_room_active_idx" ON "public"."room_posts" USING "btree" ("room_id", "created_at" DESC) WHERE ("deleted_at" IS NULL);

CREATE INDEX "room_posts_room_activity_idx" ON "public"."room_posts" USING "btree" ("room_id", "last_activity_at" DESC) WHERE ("deleted_at" IS NULL);

CREATE INDEX "room_posts_room_created_idx" ON "public"."room_posts" USING "btree" ("room_id", "created_at" DESC);

CREATE INDEX "room_posts_room_status_activity_idx" ON "public"."room_posts" USING "btree" ("room_id", "status", "last_activity_at" DESC) WHERE ("deleted_at" IS NULL);

CREATE INDEX "room_preferences_privacy_mode_idx" ON "public"."room_preferences" USING "btree" ("privacy_mode");

CREATE INDEX "room_preferences_room_status_idx" ON "public"."room_preferences" USING "btree" ("room_status");

CREATE INDEX "room_requests_created_by_idx" ON "public"."room_requests" USING "btree" ("created_by");

CREATE INDEX "room_requests_room_id_status_created_at_idx" ON "public"."room_requests" USING "btree" ("room_id", "status", "created_at" DESC);

CREATE INDEX "room_service_listings_room_featured_created_idx" ON "public"."room_service_listings" USING "btree" ("room_id", "is_featured" DESC, "created_at" DESC);

CREATE INDEX "room_service_listings_room_status_created_idx" ON "public"."room_service_listings" USING "btree" ("room_id", "status", "created_at" DESC);

CREATE INDEX "room_service_requests_created_by_idx" ON "public"."room_service_requests" USING "btree" ("created_by");

CREATE INDEX "room_service_requests_listing_idx" ON "public"."room_service_requests" USING "btree" ("listing_id");

CREATE INDEX "room_service_requests_room_status_created_idx" ON "public"."room_service_requests" USING "btree" ("room_id", "status", "created_at" DESC);

CREATE INDEX "room_tasks_assigned_user_idx" ON "public"."room_tasks" USING "btree" ("assigned_user_id");

CREATE INDEX "room_tasks_created_by_idx" ON "public"."room_tasks" USING "btree" ("created_by");

CREATE INDEX "room_tasks_due_at_idx" ON "public"."room_tasks" USING "btree" ("due_at");

CREATE INDEX "room_tasks_room_status_idx" ON "public"."room_tasks" USING "btree" ("room_id", "status", "updated_at" DESC);

CREATE INDEX "rooms_subscription_status_idx" ON "public"."rooms" USING "btree" ("subscription_status", "subscription_plan");

CREATE INDEX "sticky_items_user_position_idx" ON "public"."sticky_items" USING "btree" ("user_id", "position", "created_at" DESC);

CREATE INDEX "sticky_items_user_type_idx" ON "public"."sticky_items" USING "btree" ("user_id", "item_type");

CREATE INDEX "support_requests_email_created_idx" ON "public"."support_requests" USING "btree" ("email", "created_at" DESC);

CREATE INDEX "support_requests_status_created_idx" ON "public"."support_requests" USING "btree" ("status", "created_at" DESC);

CREATE INDEX "support_requests_user_created_idx" ON "public"."support_requests" USING "btree" ("user_id", "created_at" DESC);

CREATE INDEX "user_ai_entitlements_enabled_idx" ON "public"."user_ai_entitlements" USING "btree" ("ai_assisted_enabled");

CREATE INDEX "user_ai_entitlements_stripe_customer_idx" ON "public"."user_ai_entitlements" USING "btree" ("stripe_customer_id");

CREATE INDEX "user_ai_entitlements_stripe_subscription_idx" ON "public"."user_ai_entitlements" USING "btree" ("stripe_subscription_id");

CREATE INDEX "user_ai_entitlements_tier_idx" ON "public"."user_ai_entitlements" USING "btree" ("tier");

CREATE INDEX "user_blocks_blocked_id_idx" ON "public"."user_blocks" USING "btree" ("blocked_id");

CREATE INDEX "user_blocks_blocker_id_idx" ON "public"."user_blocks" USING "btree" ("blocker_id");

CREATE INDEX "user_purpose_goals_user_purpose_lane_idx" ON "public"."user_purpose_goals" USING "btree" ("user_id", "purpose_lane") WHERE ("purpose_lane" IS NOT NULL);

CREATE INDEX "user_purpose_goals_user_status_updated_idx" ON "public"."user_purpose_goals" USING "btree" ("user_id", "status", "updated_at" DESC);

CREATE INDEX "user_push_device_tokens_enabled_seen_idx" ON "public"."user_push_device_tokens" USING "btree" ("enabled", "last_seen_at" DESC);

CREATE INDEX "user_push_device_tokens_user_enabled_idx" ON "public"."user_push_device_tokens" USING "btree" ("user_id", "enabled", "platform");

CREATE INDEX "user_topic_alerts_topic_enabled_idx" ON "public"."user_topic_alerts" USING "btree" ("topic", "enabled");

CREATE INDEX "user_topic_alerts_user_enabled_idx" ON "public"."user_topic_alerts" USING "btree" ("user_id", "enabled", "topic");

CREATE INDEX "welcome_email_events_sent_at_idx" ON "public"."welcome_email_events" USING "btree" ("sent_at" DESC);

CREATE INDEX "welcome_email_events_status_created_idx" ON "public"."welcome_email_events" USING "btree" ("status", "created_at" DESC);

CREATE POLICY "Admins can delete Labs requests" ON "public"."labs_feature_requests" FOR DELETE USING ("public"."user_is_loombus_admin"("auth"."uid"()));

CREATE POLICY "Admins can manage AI entitlements" ON "public"."user_ai_entitlements" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));

CREATE POLICY "Admins can manage Labs feature request votes" ON "public"."labs_feature_request_votes" TO "authenticated" USING ("public"."user_is_loombus_admin"("auth"."uid"())) WITH CHECK ("public"."user_is_loombus_admin"("auth"."uid"()));

CREATE POLICY "Admins can manage reply reactions" ON "public"."reply_reactions" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));

CREATE POLICY "Admins can read AI entitlements" ON "public"."user_ai_entitlements" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));

CREATE POLICY "Admins can read AI output ratings" ON "public"."ai_output_ratings" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));

CREATE POLICY "Admins can read AI usage events" ON "public"."ai_usage_events" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));

CREATE POLICY "Admins can read account deletion requests" ON "public"."account_deletion_requests" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "profile"
  WHERE (("profile"."id" = "auth"."uid"()) AND ("profile"."is_admin" = true)))));

CREATE POLICY "Admins can read audit logs" ON "public"."audit_logs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));

CREATE POLICY "Admins can read extra AI credit ledger" ON "public"."ai_extra_credit_ledger" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));

CREATE POLICY "Admins can read extra AI credit packs" ON "public"."ai_extra_credit_packs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));

CREATE POLICY "Admins can read reports" ON "public"."reports" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));

CREATE POLICY "Admins can read support requests" ON "public"."support_requests" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));

CREATE POLICY "Admins can read topic alerts" ON "public"."user_topic_alerts" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));

CREATE POLICY "Admins can read welcome email events" ON "public"."welcome_email_events" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));

CREATE POLICY "Admins can restore discussions" ON "public"."discussions" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));

CREATE POLICY "Admins can update Labs requests" ON "public"."labs_feature_requests" FOR UPDATE USING ("public"."user_is_loombus_admin"("auth"."uid"())) WITH CHECK ("public"."user_is_loombus_admin"("auth"."uid"()));

CREATE POLICY "Admins can update account deletion requests" ON "public"."account_deletion_requests" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "profile"
  WHERE (("profile"."id" = "auth"."uid"()) AND ("profile"."is_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "profile"
  WHERE (("profile"."id" = "auth"."uid"()) AND ("profile"."is_admin" = true)))));

CREATE POLICY "Admins can update discussions" ON "public"."discussions" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));

CREATE POLICY "Admins can update reports" ON "public"."reports" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));

CREATE POLICY "Admins can update support requests" ON "public"."support_requests" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));

CREATE POLICY "Anyone can create support requests" ON "public"."support_requests" FOR INSERT TO "authenticated", "anon" WITH CHECK ((("user_id" IS NULL) OR ("user_id" = "auth"."uid"())));

CREATE POLICY "Anyone can read discussion tags" ON "public"."discussion_tags" FOR SELECT USING (true);

CREATE POLICY "Anyone can read discussion views" ON "public"."discussion_views" FOR SELECT USING (true);

CREATE POLICY "Anyone can read live discussions" ON "public"."discussions" FOR SELECT USING (("deleted_at" IS NULL));

CREATE POLICY "Anyone can read live replies" ON "public"."replies" FOR SELECT USING (("deleted_at" IS NULL));

CREATE POLICY "Anyone can read profiles" ON "public"."profiles" FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create discussions" ON "public"."discussions" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Authenticated users can create replies" ON "public"."replies" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Authenticated users can create their own reply reactions" ON "public"."reply_reactions" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Authenticated users can delete their own reply reactions" ON "public"."reply_reactions" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Authenticated users can insert own discussion views" ON "public"."discussion_views" FOR INSERT TO "authenticated" WITH CHECK ((("viewer_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."discussions" "discussion"
  WHERE (("discussion"."id" = "discussion_views"."discussion_id") AND ("discussion"."deleted_at" IS NULL))))));

CREATE POLICY "Authenticated users can read reply reactions" ON "public"."reply_reactions" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Authorized members can create post attachments" ON "public"."room_post_attachments" FOR INSERT TO "authenticated" WITH CHECK ((("uploader_id" = "auth"."uid"()) AND "public"."user_can_access_room_post"("post_id") AND (EXISTS ( SELECT 1
   FROM "public"."room_posts" "post"
  WHERE (("post"."id" = "room_post_attachments"."post_id") AND ("post"."room_id" = "room_post_attachments"."room_id"))))));

CREATE POLICY "Authorized members can read Room discussions" ON "public"."room_posts" FOR SELECT TO "authenticated" USING ("public"."user_can_access_room_post"("id"));

CREATE POLICY "Authorized members can read post attachments" ON "public"."room_post_attachments" FOR SELECT TO "authenticated" USING (("public"."user_can_access_room_post"("post_id") AND (EXISTS ( SELECT 1
   FROM "public"."room_posts" "post"
  WHERE (("post"."id" = "room_post_attachments"."post_id") AND ("post"."room_id" = "room_post_attachments"."room_id"))))));

CREATE POLICY "Authorized members can read support-case participants" ON "public"."room_post_participants" FOR SELECT TO "authenticated" USING ("public"."user_can_access_room_post"("post_id"));

CREATE POLICY "Conversation members can read private message attachments" ON "public"."private_message_attachments" FOR SELECT TO "authenticated" USING ("public"."user_can_read_private_messages"("conversation_id", "auth"."uid"()));

CREATE POLICY "Labs members can create their own feature request votes" ON "public"."labs_feature_request_votes" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND "public"."user_has_loombus_labs_access"("auth"."uid"())));

CREATE POLICY "Labs members can delete their own feature request votes" ON "public"."labs_feature_request_votes" FOR DELETE TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND "public"."user_has_loombus_labs_access"("auth"."uid"())));

CREATE POLICY "Labs members can read feature request votes" ON "public"."labs_feature_request_votes" FOR SELECT TO "authenticated" USING ("public"."user_has_loombus_labs_access"("auth"."uid"()));

CREATE POLICY "Labs members can read visible Labs requests" ON "public"."labs_feature_requests" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "user_id") OR "public"."user_has_loombus_labs_access"("auth"."uid"()) OR "public"."user_is_loombus_admin"("auth"."uid"())));

CREATE POLICY "Live room members are visible inside the room" ON "public"."room_members" FOR SELECT TO "authenticated" USING ("public"."user_is_active_room_member"("room_id"));

CREATE POLICY "Live room records are visible to active members" ON "public"."rooms" FOR SELECT TO "authenticated" USING ("public"."user_is_active_room_member"("id"));

CREATE POLICY "Premium Plus users can create Labs requests" ON "public"."labs_feature_requests" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND "public"."user_has_loombus_labs_access"("user_id")));

CREATE POLICY "Premium members and admins can read discussion AI outputs" ON "public"."discussion_ai_outputs" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."user_ai_entitlements"
  WHERE (("user_ai_entitlements"."user_id" = "auth"."uid"()) AND ("user_ai_entitlements"."ai_assisted_enabled" = true) AND ("user_ai_entitlements"."tier" = ANY (ARRAY['premium'::"text", 'admin'::"text"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true))))));

CREATE POLICY "Premium members and admins can read discussion summaries" ON "public"."discussion_summaries" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."user_ai_entitlements"
  WHERE (("user_ai_entitlements"."user_id" = "auth"."uid"()) AND ("user_ai_entitlements"."ai_assisted_enabled" = true) AND ("user_ai_entitlements"."tier" = ANY (ARRAY['premium'::"text", 'admin'::"text"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true))))));

CREATE POLICY "Premium users can create discussion drafts" ON "public"."discussion_drafts" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND "public"."user_has_discussion_draft_access"("user_id")));

CREATE POLICY "Premium users can create their bookmark collections" ON "public"."bookmark_collections" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND "public"."user_has_bookmark_collection_access"("user_id")));

CREATE POLICY "Premium users can create their own stickies" ON "public"."sticky_items" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND "public"."user_has_stickies_access"("auth"."uid"())));

CREATE POLICY "Premium users can create their own topic alerts" ON "public"."user_topic_alerts" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND "public"."user_has_premium_topic_alert_access"("auth"."uid"())));

CREATE POLICY "Premium users can delete discussion drafts" ON "public"."discussion_drafts" FOR DELETE USING ((("auth"."uid"() = "user_id") AND "public"."user_has_discussion_draft_access"("user_id")));

CREATE POLICY "Premium users can delete their bookmark collections" ON "public"."bookmark_collections" FOR DELETE TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND "public"."user_has_bookmark_collection_access"("user_id")));

CREATE POLICY "Premium users can delete their own stickies" ON "public"."sticky_items" FOR DELETE TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND "public"."user_has_stickies_access"("auth"."uid"())));

CREATE POLICY "Premium users can delete their own topic alerts" ON "public"."user_topic_alerts" FOR DELETE TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND "public"."user_has_premium_topic_alert_access"("auth"."uid"())));

CREATE POLICY "Premium users can update discussion drafts" ON "public"."discussion_drafts" FOR UPDATE USING ((("auth"."uid"() = "user_id") AND "public"."user_has_discussion_draft_access"("user_id"))) WITH CHECK ((("auth"."uid"() = "user_id") AND "public"."user_has_discussion_draft_access"("user_id")));

CREATE POLICY "Premium users can update their bookmark collections" ON "public"."bookmark_collections" FOR UPDATE TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND "public"."user_has_bookmark_collection_access"("user_id"))) WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND "public"."user_has_bookmark_collection_access"("user_id")));

CREATE POLICY "Premium users can update their own stickies" ON "public"."sticky_items" FOR UPDATE TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND "public"."user_has_stickies_access"("auth"."uid"()))) WITH CHECK ((("user_id" = "auth"."uid"()) AND "public"."user_has_stickies_access"("auth"."uid"())));

CREATE POLICY "Premium users can update their own topic alerts" ON "public"."user_topic_alerts" FOR UPDATE TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND "public"."user_has_premium_topic_alert_access"("auth"."uid"()))) WITH CHECK ((("user_id" = "auth"."uid"()) AND "public"."user_has_premium_topic_alert_access"("auth"."uid"())));

CREATE POLICY "Public can read attachments for visible discussions" ON "public"."discussion_attachments" FOR SELECT TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."discussions" "discussion"
  WHERE (("discussion"."id" = "discussion_attachments"."discussion_id") AND ("discussion"."deleted_at" IS NULL)))));

CREATE POLICY "Readable room discussion links" ON "public"."loombus_room_discussions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."loombus_rooms" "room"
  WHERE ("room"."id" = "loombus_room_discussions"."room_id"))));

CREATE POLICY "Room entry managers can update join requests" ON "public"."room_join_requests" FOR UPDATE USING (("public"."user_can_manage_room_entry"("room_id") OR ("requester_user_id" = "auth"."uid"()))) WITH CHECK (("public"."user_can_manage_room_entry"("room_id") OR (("requester_user_id" = "auth"."uid"()) AND ("status" = 'cancelled'::"text"))));

CREATE POLICY "Room entry managers can view join requests" ON "public"."room_join_requests" FOR SELECT USING (("public"."user_can_manage_room_entry"("room_id") OR ("requester_user_id" = "auth"."uid"())));

CREATE POLICY "Room members can create room requests" ON "public"."room_requests" FOR INSERT WITH CHECK ((("created_by" = "auth"."uid"()) AND "public"."user_can_access_room_requests"("room_id")));

CREATE POLICY "Room members can create service requests" ON "public"."room_service_requests" FOR INSERT WITH CHECK ((("created_by" = "auth"."uid"()) AND "public"."user_can_access_room_services"("room_id")));

CREATE POLICY "Room members can create submissions" ON "public"."room_form_submissions" FOR INSERT WITH CHECK ((("submitted_by" = "auth"."uid"()) AND "public"."user_can_access_room_forms"("room_id")));

CREATE POLICY "Room members can delete their own poll vote" ON "public"."room_poll_votes" FOR DELETE USING ((("voter_id" = "auth"."uid"()) AND "public"."user_can_access_room_polls"("room_id")));

CREATE POLICY "Room members can update their own open poll vote" ON "public"."room_poll_votes" FOR UPDATE USING ((("voter_id" = "auth"."uid"()) AND "public"."user_can_access_room_polls"("room_id"))) WITH CHECK ((("voter_id" = "auth"."uid"()) AND "public"."user_can_vote_room_poll"("poll_id", "room_id", "option_index")));

CREATE POLICY "Room members can view FAQ entries" ON "public"."room_faq_entries" FOR SELECT USING ("public"."user_can_access_room_faq"("room_id"));

CREATE POLICY "Room members can view directory contacts" ON "public"."room_directory_contacts" FOR SELECT USING ("public"."user_can_access_room_directory"("room_id"));

CREATE POLICY "Room members can view documents" ON "public"."room_documents" FOR SELECT USING ("public"."user_can_access_room_documents"("room_id"));

CREATE POLICY "Room members can view forms" ON "public"."room_forms" FOR SELECT USING ("public"."user_can_access_room_forms"("room_id"));

CREATE POLICY "Room members can view own submissions" ON "public"."room_form_submissions" FOR SELECT USING (("public"."user_can_manage_room_forms"("room_id") OR (("submitted_by" = "auth"."uid"()) AND "public"."user_can_access_room_forms"("room_id"))));

CREATE POLICY "Room members can view poll votes" ON "public"."room_poll_votes" FOR SELECT USING ("public"."user_can_access_room_polls"("room_id"));

CREATE POLICY "Room members can view polls" ON "public"."room_polls" FOR SELECT USING ("public"."user_can_access_room_polls"("room_id"));

CREATE POLICY "Room members can view room preferences" ON "public"."room_preferences" FOR SELECT USING ("public"."user_can_access_room_preferences"("room_id"));

CREATE POLICY "Room members can view room requests" ON "public"."room_requests" FOR SELECT USING ("public"."user_can_access_room_requests"("room_id"));

CREATE POLICY "Room members can view service listings" ON "public"."room_service_listings" FOR SELECT USING ("public"."user_can_access_room_services"("room_id"));

CREATE POLICY "Room members can view service requests" ON "public"."room_service_requests" FOR SELECT USING (("public"."user_can_manage_room_services"("room_id") OR ("created_by" = "auth"."uid"())));

CREATE POLICY "Room members can view tasks" ON "public"."room_tasks" FOR SELECT USING ("public"."user_can_access_room_tasks"("room_id"));

CREATE POLICY "Room members can vote on open polls" ON "public"."room_poll_votes" FOR INSERT WITH CHECK ((("voter_id" = "auth"."uid"()) AND "public"."user_can_vote_room_poll"("poll_id", "room_id", "option_index")));

CREATE POLICY "Room owners and admins can create FAQ entries" ON "public"."room_faq_entries" FOR INSERT WITH CHECK ((("created_by" = "auth"."uid"()) AND "public"."user_can_manage_room_faq"("room_id")));

CREATE POLICY "Room owners and admins can create directory contacts" ON "public"."room_directory_contacts" FOR INSERT WITH CHECK ((("created_by" = "auth"."uid"()) AND "public"."user_can_manage_room_directory"("room_id")));

CREATE POLICY "Room owners and admins can create documents" ON "public"."room_documents" FOR INSERT WITH CHECK ((("created_by" = "auth"."uid"()) AND "public"."user_can_manage_room_documents"("room_id")));

CREATE POLICY "Room owners and admins can create forms" ON "public"."room_forms" FOR INSERT WITH CHECK ((("created_by" = "auth"."uid"()) AND "public"."user_can_manage_room_forms"("room_id")));

CREATE POLICY "Room owners and admins can create polls" ON "public"."room_polls" FOR INSERT WITH CHECK ((("created_by" = "auth"."uid"()) AND "public"."user_can_manage_room_polls"("room_id")));

CREATE POLICY "Room owners and admins can create room preferences" ON "public"."room_preferences" FOR INSERT WITH CHECK ((("created_by" = "auth"."uid"()) AND "public"."user_can_manage_room_preferences"("room_id")));

CREATE POLICY "Room owners and admins can create service listings" ON "public"."room_service_listings" FOR INSERT WITH CHECK ((("created_by" = "auth"."uid"()) AND "public"."user_can_manage_room_services"("room_id")));

CREATE POLICY "Room owners and admins can create tasks" ON "public"."room_tasks" FOR INSERT WITH CHECK ((("created_by" = "auth"."uid"()) AND "public"."user_can_manage_room_tasks"("room_id")));

CREATE POLICY "Room owners and admins can delete FAQ entries" ON "public"."room_faq_entries" FOR DELETE USING ("public"."user_can_manage_room_faq"("room_id"));

CREATE POLICY "Room owners and admins can delete directory contacts" ON "public"."room_directory_contacts" FOR DELETE USING ("public"."user_can_manage_room_directory"("room_id"));

CREATE POLICY "Room owners and admins can delete documents" ON "public"."room_documents" FOR DELETE USING ("public"."user_can_manage_room_documents"("room_id"));

CREATE POLICY "Room owners and admins can delete forms" ON "public"."room_forms" FOR DELETE USING ("public"."user_can_manage_room_forms"("room_id"));

CREATE POLICY "Room owners and admins can delete polls" ON "public"."room_polls" FOR DELETE USING ("public"."user_can_manage_room_polls"("room_id"));

CREATE POLICY "Room owners and admins can delete submissions" ON "public"."room_form_submissions" FOR DELETE USING ("public"."user_can_manage_room_forms"("room_id"));

CREATE POLICY "Room owners and admins can delete tasks" ON "public"."room_tasks" FOR DELETE USING ("public"."user_can_manage_room_tasks"("room_id"));

CREATE POLICY "Room owners and admins can update FAQ entries" ON "public"."room_faq_entries" FOR UPDATE USING ("public"."user_can_manage_room_faq"("room_id")) WITH CHECK ("public"."user_can_manage_room_faq"("room_id"));

CREATE POLICY "Room owners and admins can update directory contacts" ON "public"."room_directory_contacts" FOR UPDATE USING ("public"."user_can_manage_room_directory"("room_id")) WITH CHECK ("public"."user_can_manage_room_directory"("room_id"));

CREATE POLICY "Room owners and admins can update documents" ON "public"."room_documents" FOR UPDATE USING ("public"."user_can_manage_room_documents"("room_id")) WITH CHECK ("public"."user_can_manage_room_documents"("room_id"));

CREATE POLICY "Room owners and admins can update forms" ON "public"."room_forms" FOR UPDATE USING ("public"."user_can_manage_room_forms"("room_id")) WITH CHECK ("public"."user_can_manage_room_forms"("room_id"));

CREATE POLICY "Room owners and admins can update polls" ON "public"."room_polls" FOR UPDATE USING ("public"."user_can_manage_room_polls"("room_id")) WITH CHECK ("public"."user_can_manage_room_polls"("room_id"));

CREATE POLICY "Room owners and admins can update room preferences" ON "public"."room_preferences" FOR UPDATE USING ("public"."user_can_manage_room_preferences"("room_id")) WITH CHECK ("public"."user_can_manage_room_preferences"("room_id"));

CREATE POLICY "Room owners and admins can update room requests" ON "public"."room_requests" FOR UPDATE USING ("public"."user_can_manage_room_requests"("room_id")) WITH CHECK ("public"."user_can_manage_room_requests"("room_id"));

CREATE POLICY "Room owners and admins can update service listings" ON "public"."room_service_listings" FOR UPDATE USING ("public"."user_can_manage_room_services"("room_id")) WITH CHECK ("public"."user_can_manage_room_services"("room_id"));

CREATE POLICY "Room owners and admins can update service requests" ON "public"."room_service_requests" FOR UPDATE USING ("public"."user_can_manage_room_services"("room_id")) WITH CHECK ("public"."user_can_manage_room_services"("room_id"));

CREATE POLICY "Room owners and admins can update submissions" ON "public"."room_form_submissions" FOR UPDATE USING ("public"."user_can_manage_room_forms"("room_id")) WITH CHECK ("public"."user_can_manage_room_forms"("room_id"));

CREATE POLICY "Room owners and admins can update tasks" ON "public"."room_tasks" FOR UPDATE USING ("public"."user_can_manage_room_tasks"("room_id")) WITH CHECK ("public"."user_can_manage_room_tasks"("room_id"));

CREATE POLICY "Room owners and admins can view activity log" ON "public"."room_activity_log" FOR SELECT USING ("public"."user_can_view_room_activity"("room_id"));

CREATE POLICY "Room plans are readable" ON "public"."room_subscription_plans" FOR SELECT TO "authenticated", "anon" USING (true);

CREATE POLICY "Room templates are readable" ON "public"."room_product_templates" FOR SELECT TO "authenticated", "anon" USING (true);

CREATE POLICY "Signed in users can request room entry" ON "public"."room_join_requests" FOR INSERT WITH CHECK ((("requester_user_id" = "auth"."uid"()) AND ("status" = 'pending'::"text") AND "public"."user_can_request_join_room"("room_id")));

CREATE POLICY "Uploaders and Room staff can delete post attachments" ON "public"."room_post_attachments" FOR DELETE TO "authenticated" USING (("public"."user_can_access_room_post"("post_id") AND (("uploader_id" = "auth"."uid"()) OR "public"."user_is_room_staff"("room_id"))));

CREATE POLICY "Users can create follows" ON "public"."follows" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "follower_id"));

CREATE POLICY "Users can create own account deletion requests" ON "public"."account_deletion_requests" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));

CREATE POLICY "Users can create reports" ON "public"."reports" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "reporter_id"));

CREATE POLICY "Users can create their own AI output ratings" ON "public"."ai_output_ratings" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));

CREATE POLICY "Users can create their own action rate events" ON "public"."action_rate_events" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can create their own blocks" ON "public"."user_blocks" FOR INSERT WITH CHECK (("auth"."uid"() = "blocker_id"));

CREATE POLICY "Users can create their own bookmarks" ON "public"."bookmarks" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can create their own purpose goals" ON "public"."user_purpose_goals" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can delete follows" ON "public"."follows" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "follower_id"));

CREATE POLICY "Users can delete their own AI output ratings" ON "public"."ai_output_ratings" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));

CREATE POLICY "Users can delete their own V2 create draft" ON "public"."loombus_v2_create_drafts" FOR DELETE USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can delete their own blocks" ON "public"."user_blocks" FOR DELETE USING (("auth"."uid"() = "blocker_id"));

CREATE POLICY "Users can delete their own bookmarks" ON "public"."bookmarks" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can delete their own notifications" ON "public"."notifications" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can delete their own purpose goals" ON "public"."user_purpose_goals" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can delete their own push device tokens" ON "public"."user_push_device_tokens" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can follow users" ON "public"."follows" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "follower_id"));

CREATE POLICY "Users can insert own paste usage" ON "public"."paste_usage_events" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can insert own shell preferences" ON "public"."loombus_shell_preferences" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can insert their own V2 create draft" ON "public"."loombus_v2_create_drafts" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can insert their own notification preferences" ON "public"."notification_preferences" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can insert their own profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));

CREATE POLICY "Users can read block relationships involving themselves" ON "public"."user_blocks" FOR SELECT USING ((("auth"."uid"() = "blocker_id") OR ("auth"."uid"() = "blocked_id")));

CREATE POLICY "Users can read follows" ON "public"."follows" FOR SELECT USING (true);

CREATE POLICY "Users can read own account deletion requests" ON "public"."account_deletion_requests" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));

CREATE POLICY "Users can read own paste usage" ON "public"."paste_usage_events" FOR SELECT USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can read own room memberships" ON "public"."loombus_room_members" FOR SELECT USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can read own shell preferences" ON "public"."loombus_shell_preferences" FOR SELECT USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can read own video context usage" ON "public"."discussion_video_upload_events" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can read private conversation members" ON "public"."private_conversation_members" FOR SELECT TO "authenticated" USING ("public"."user_can_read_private_messages"("conversation_id", "auth"."uid"()));

CREATE POLICY "Users can read private messages" ON "public"."private_messages" FOR SELECT TO "authenticated" USING ("public"."user_can_read_private_messages"("conversation_id", "auth"."uid"()));

CREATE POLICY "Users can read their bookmark collections" ON "public"."bookmark_collections" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));

CREATE POLICY "Users can read their discussion drafts" ON "public"."discussion_drafts" FOR SELECT USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can read their own AI entitlement" ON "public"."user_ai_entitlements" FOR SELECT USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can read their own AI output ratings" ON "public"."ai_output_ratings" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));

CREATE POLICY "Users can read their own AI usage" ON "public"."ai_usage_events" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));

CREATE POLICY "Users can read their own V2 create draft" ON "public"."loombus_v2_create_drafts" FOR SELECT USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can read their own action rate events" ON "public"."action_rate_events" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can read their own bookmarks" ON "public"."bookmarks" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can read their own extra AI credit ledger" ON "public"."ai_extra_credit_ledger" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));

CREATE POLICY "Users can read their own extra AI credit packs" ON "public"."ai_extra_credit_packs" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));

CREATE POLICY "Users can read their own notification preferences" ON "public"."notification_preferences" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can read their own notifications" ON "public"."notifications" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can read their own purpose goals" ON "public"."user_purpose_goals" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can read their own push device tokens" ON "public"."user_push_device_tokens" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can read their own stickies" ON "public"."sticky_items" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND "public"."user_has_stickies_access"("auth"."uid"())));

CREATE POLICY "Users can read their own support requests" ON "public"."support_requests" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));

CREATE POLICY "Users can read their own topic alerts" ON "public"."user_topic_alerts" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));

CREATE POLICY "Users can read their own welcome email event" ON "public"."welcome_email_events" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));

CREATE POLICY "Users can read their private conversations" ON "public"."private_conversations" FOR SELECT TO "authenticated" USING ("public"."user_can_read_private_messages"("id", "auth"."uid"()));

CREATE POLICY "Users can unfollow users" ON "public"."follows" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "follower_id"));

CREATE POLICY "Users can update own shell preferences" ON "public"."loombus_shell_preferences" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can update their own AI output ratings" ON "public"."ai_output_ratings" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));

CREATE POLICY "Users can update their own V2 create draft" ON "public"."loombus_v2_create_drafts" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can update their own notification preferences" ON "public"."notification_preferences" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can update their own notifications" ON "public"."notifications" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));

CREATE POLICY "Users can update their own purpose goals" ON "public"."user_purpose_goals" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can view follows" ON "public"."follows" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Users insert own sensitive profile data" ON "public"."profile_sensitive" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));

CREATE POLICY "Users read own sensitive profile data" ON "public"."profile_sensitive" FOR SELECT USING (("auth"."uid"() = "id"));

CREATE POLICY "Users update own sensitive profile data" ON "public"."profile_sensitive" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));

CREATE POLICY "Visible rooms are readable" ON "public"."loombus_rooms" FOR SELECT USING ((("status" = 'active'::"text") AND (("visibility" = 'public'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."loombus_room_members" "member"
  WHERE (("member"."room_id" = "loombus_rooms"."id") AND ("member"."user_id" = "auth"."uid"()) AND ("member"."status" = 'active'::"text")))))));

ALTER TABLE "public"."account_deletion_requests" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."action_rate_events" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ai_extra_credit_ledger" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ai_extra_credit_packs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ai_output_ratings" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ai_usage_events" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."bookmark_collections" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."bookmarks" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."discussion_ai_outputs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."discussion_attachments" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "discussion_audience_access_restriction" ON "public"."bookmarks" AS RESTRICTIVE USING ("public"."can_view_discussion_audience_for_current_user"("discussion_id")) WITH CHECK ("public"."can_view_discussion_audience_for_current_user"("discussion_id"));

CREATE POLICY "discussion_audience_access_restriction" ON "public"."discussion_attachments" AS RESTRICTIVE USING ("public"."can_view_discussion_audience_for_current_user"("discussion_id")) WITH CHECK ("public"."can_view_discussion_audience_for_current_user"("discussion_id"));

CREATE POLICY "discussion_audience_access_restriction" ON "public"."discussion_summaries" AS RESTRICTIVE USING ("public"."can_view_discussion_audience_for_current_user"("discussion_id")) WITH CHECK ("public"."can_view_discussion_audience_for_current_user"("discussion_id"));

CREATE POLICY "discussion_audience_access_restriction" ON "public"."discussion_tags" AS RESTRICTIVE USING ("public"."can_view_discussion_audience_for_current_user"("discussion_id")) WITH CHECK ("public"."can_view_discussion_audience_for_current_user"("discussion_id"));

CREATE POLICY "discussion_audience_access_restriction" ON "public"."discussion_views" AS RESTRICTIVE USING ("public"."can_view_discussion_audience_for_current_user"("discussion_id")) WITH CHECK ("public"."can_view_discussion_audience_for_current_user"("discussion_id"));

CREATE POLICY "discussion_audience_access_restriction" ON "public"."replies" AS RESTRICTIVE USING ("public"."can_view_discussion_audience_for_current_user"("discussion_id")) WITH CHECK ("public"."can_view_discussion_audience_for_current_user"("discussion_id"));

CREATE POLICY "discussion_audience_access_restriction" ON "public"."reply_reactions" AS RESTRICTIVE USING ((EXISTS ( SELECT 1
   FROM "public"."replies" "reply"
  WHERE (("reply"."id" = "reply_reactions"."reply_id") AND "public"."can_view_discussion_audience_for_current_user"("reply"."discussion_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."replies" "reply"
  WHERE (("reply"."id" = "reply_reactions"."reply_id") AND "public"."can_view_discussion_audience_for_current_user"("reply"."discussion_id")))));

ALTER TABLE "public"."discussion_audience_members" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "discussion_audience_members_owner_select" ON "public"."discussion_audience_members" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."discussions" "discussion"
  WHERE (("discussion"."id" = "discussion_audience_members"."discussion_id") AND (("discussion"."user_id" = "auth"."uid"()) OR "public"."is_discussion_audience_admin"("auth"."uid"()))))));

CREATE POLICY "discussion_audience_select_restriction" ON "public"."discussions" AS RESTRICTIVE FOR SELECT USING ("public"."can_view_discussion_audience_row_for_current_user"("id", "user_id", "audience_type", "audience_base"));

ALTER TABLE "public"."discussion_drafts" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."discussion_summaries" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."discussion_tags" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."discussion_video_upload_events" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."discussion_views" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."discussions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."follows" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."labs_feature_request_votes" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."labs_feature_requests" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."loombus_feature_flags" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."loombus_room_discussions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."loombus_room_members" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."loombus_rooms" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."loombus_shell_preferences" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."loombus_v2_create_drafts" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."notification_preferences" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."paste_usage_events" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."private_conversation_members" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."private_conversations" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."private_message_attachments" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."private_messages" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."profile_sensitive" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."replies" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."reply_reactions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."reports" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."room_activity_log" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."room_directory_contacts" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."room_documents" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."room_faq_entries" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."room_form_submissions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."room_forms" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."room_join_requests" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."room_members" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."room_poll_votes" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."room_polls" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."room_post_attachments" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."room_post_participants" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."room_posts" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."room_preferences" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."room_product_templates" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."room_requests" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."room_service_listings" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."room_service_requests" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."room_subscription_plans" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."room_tasks" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."rooms" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."sticky_items" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."support_requests" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."user_ai_entitlements" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."user_blocks" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."user_purpose_goals" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."user_push_device_tokens" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."user_topic_alerts" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."welcome_email_events" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON FUNCTION "public"."can_view_discussion_audience"("p_discussion_id" "uuid", "p_viewer_user_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."can_view_discussion_audience"("p_discussion_id" "uuid", "p_viewer_user_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."can_view_discussion_audience_for_current_user"("p_discussion_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."can_view_discussion_audience_for_current_user"("p_discussion_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."can_view_discussion_audience_for_current_user"("p_discussion_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."can_view_discussion_audience_row"("p_discussion_id" "uuid", "p_author_id" "uuid", "p_audience_type" "text", "p_audience_base" "text", "p_viewer_user_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."can_view_discussion_audience_row"("p_discussion_id" "uuid", "p_author_id" "uuid", "p_audience_type" "text", "p_audience_base" "text", "p_viewer_user_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."can_view_discussion_audience_row_for_current_user"("p_discussion_id" "uuid", "p_author_id" "uuid", "p_audience_type" "text", "p_audience_base" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."can_view_discussion_audience_row_for_current_user"("p_discussion_id" "uuid", "p_author_id" "uuid", "p_audience_type" "text", "p_audience_base" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."can_view_discussion_audience_row_for_current_user"("p_discussion_id" "uuid", "p_author_id" "uuid", "p_audience_type" "text", "p_audience_base" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."is_discussion_audience_admin"("p_user_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."is_discussion_audience_admin"("p_user_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."room_user_is_active_member"("target_room_id" "uuid", "target_user_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."room_user_is_active_member"("target_room_id" "uuid", "target_user_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."room_user_is_active_member"("target_room_id" "uuid", "target_user_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."room_user_is_active_member"("target_room_id" "uuid", "target_user_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."room_user_is_staff"("target_room_id" "uuid", "target_user_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."room_user_is_staff"("target_room_id" "uuid", "target_user_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."room_user_is_staff"("target_room_id" "uuid", "target_user_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."room_user_is_staff"("target_room_id" "uuid", "target_user_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."user_can_access_room_directory"("target_room_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."user_can_access_room_directory"("target_room_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."user_can_access_room_directory"("target_room_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."user_can_access_room_documents"("target_room_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."user_can_access_room_documents"("target_room_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."user_can_access_room_documents"("target_room_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."user_can_access_room_faq"("target_room_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."user_can_access_room_faq"("target_room_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."user_can_access_room_faq"("target_room_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."user_can_access_room_forms"("target_room_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."user_can_access_room_forms"("target_room_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."user_can_access_room_forms"("target_room_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."user_can_access_room_polls"("target_room_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."user_can_access_room_polls"("target_room_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."user_can_access_room_polls"("target_room_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."user_can_access_room_post"("target_post_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."user_can_access_room_post"("target_post_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."user_can_access_room_post"("target_post_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."user_can_access_room_post"("target_post_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."user_can_access_room_preferences"("target_room_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."user_can_access_room_preferences"("target_room_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."user_can_access_room_preferences"("target_room_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."user_can_access_room_requests"("target_room_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."user_can_access_room_requests"("target_room_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."user_can_access_room_requests"("target_room_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."user_can_access_room_services"("target_room_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."user_can_access_room_services"("target_room_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."user_can_access_room_services"("target_room_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."user_can_access_room_tasks"("target_room_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."user_can_access_room_tasks"("target_room_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."user_can_access_room_tasks"("target_room_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."user_can_manage_room_directory"("target_room_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."user_can_manage_room_directory"("target_room_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."user_can_manage_room_directory"("target_room_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."user_can_manage_room_documents"("target_room_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."user_can_manage_room_documents"("target_room_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."user_can_manage_room_documents"("target_room_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."user_can_manage_room_entry"("target_room_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."user_can_manage_room_entry"("target_room_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."user_can_manage_room_entry"("target_room_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."user_can_manage_room_faq"("target_room_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."user_can_manage_room_faq"("target_room_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."user_can_manage_room_faq"("target_room_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."user_can_manage_room_forms"("target_room_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."user_can_manage_room_forms"("target_room_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."user_can_manage_room_forms"("target_room_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."user_can_manage_room_polls"("target_room_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."user_can_manage_room_polls"("target_room_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."user_can_manage_room_polls"("target_room_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."user_can_manage_room_preferences"("target_room_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."user_can_manage_room_preferences"("target_room_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."user_can_manage_room_preferences"("target_room_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."user_can_manage_room_requests"("target_room_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."user_can_manage_room_requests"("target_room_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."user_can_manage_room_requests"("target_room_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."user_can_manage_room_services"("target_room_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."user_can_manage_room_services"("target_room_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."user_can_manage_room_services"("target_room_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."user_can_manage_room_tasks"("target_room_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."user_can_manage_room_tasks"("target_room_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."user_can_manage_room_tasks"("target_room_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."user_can_read_private_messages"("target_conversation_id" "uuid", "target_user_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."user_can_read_private_messages"("target_conversation_id" "uuid", "target_user_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."user_can_read_private_messages"("target_conversation_id" "uuid", "target_user_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."user_can_request_join_room"("target_room_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."user_can_request_join_room"("target_room_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."user_can_request_join_room"("target_room_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."user_can_view_room_activity"("target_room_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."user_can_view_room_activity"("target_room_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."user_can_view_room_activity"("target_room_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."user_can_vote_room_poll"("target_poll_id" "uuid", "target_room_id" "uuid", "target_option_index" integer) TO "anon";

GRANT ALL ON FUNCTION "public"."user_can_vote_room_poll"("target_poll_id" "uuid", "target_room_id" "uuid", "target_option_index" integer) TO "authenticated";

GRANT ALL ON FUNCTION "public"."user_can_vote_room_poll"("target_poll_id" "uuid", "target_room_id" "uuid", "target_option_index" integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."user_has_bookmark_collection_access"("target_user_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."user_has_bookmark_collection_access"("target_user_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."user_has_bookmark_collection_access"("target_user_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."user_has_discussion_draft_access"("target_user_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."user_has_discussion_draft_access"("target_user_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."user_has_discussion_draft_access"("target_user_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."user_has_loombus_labs_access"("target_user_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."user_has_loombus_labs_access"("target_user_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."user_has_loombus_labs_access"("target_user_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."user_has_premium_topic_alert_access"("target_user_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."user_has_premium_topic_alert_access"("target_user_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."user_has_premium_topic_alert_access"("target_user_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."user_has_stickies_access"("target_user_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."user_has_stickies_access"("target_user_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."user_has_stickies_access"("target_user_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."user_is_active_room_member"("target_room_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."user_is_active_room_member"("target_room_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."user_is_active_room_member"("target_room_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."user_is_loombus_admin"("target_user_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."user_is_loombus_admin"("target_user_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."user_is_loombus_admin"("target_user_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."user_is_private_conversation_member"("target_conversation_id" "uuid", "target_user_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."user_is_private_conversation_member"("target_conversation_id" "uuid", "target_user_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."user_is_private_conversation_member"("target_conversation_id" "uuid", "target_user_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."user_is_room_staff"("target_room_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."user_is_room_staff"("target_room_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."user_is_room_staff"("target_room_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."user_is_room_staff"("target_room_id" "uuid") TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."account_deletion_requests" TO "anon";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."account_deletion_requests" TO "authenticated";

GRANT ALL ON TABLE "public"."account_deletion_requests" TO "service_role";

GRANT SELECT,MAINTAIN ON TABLE "public"."action_rate_events" TO "anon";

GRANT SELECT,INSERT,MAINTAIN ON TABLE "public"."action_rate_events" TO "authenticated";

GRANT ALL ON TABLE "public"."action_rate_events" TO "service_role";

GRANT SELECT,MAINTAIN ON TABLE "public"."ai_extra_credit_ledger" TO "authenticated";

GRANT ALL ON TABLE "public"."ai_extra_credit_ledger" TO "service_role";

GRANT SELECT,MAINTAIN ON TABLE "public"."ai_extra_credit_packs" TO "authenticated";

GRANT ALL ON TABLE "public"."ai_extra_credit_packs" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."ai_output_ratings" TO "authenticated";

GRANT ALL ON TABLE "public"."ai_output_ratings" TO "service_role";

GRANT SELECT,MAINTAIN ON TABLE "public"."ai_usage_events" TO "authenticated";

GRANT ALL ON TABLE "public"."ai_usage_events" TO "service_role";

GRANT SELECT,MAINTAIN ON TABLE "public"."audit_logs" TO "authenticated";

GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";

GRANT ALL ON TABLE "public"."bookmark_collections" TO "service_role";

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."bookmark_collections" TO "authenticated";

GRANT SELECT,MAINTAIN ON TABLE "public"."bookmarks" TO "anon";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."bookmarks" TO "authenticated";

GRANT ALL ON TABLE "public"."bookmarks" TO "service_role";

GRANT SELECT,MAINTAIN ON TABLE "public"."discussion_ai_outputs" TO "authenticated";

GRANT ALL ON TABLE "public"."discussion_ai_outputs" TO "service_role";

GRANT ALL ON TABLE "public"."discussion_attachments" TO "service_role";

GRANT SELECT ON TABLE "public"."discussion_attachments" TO "anon";

GRANT SELECT ON TABLE "public"."discussion_attachments" TO "authenticated";

GRANT SELECT,MAINTAIN ON TABLE "public"."discussion_audience_members" TO "authenticated";

GRANT ALL ON TABLE "public"."discussion_audience_members" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."discussion_drafts" TO "authenticated";

GRANT ALL ON TABLE "public"."discussion_drafts" TO "service_role";

GRANT SELECT,MAINTAIN ON TABLE "public"."discussion_summaries" TO "authenticated";

GRANT ALL ON TABLE "public"."discussion_summaries" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."discussion_tags" TO "anon";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."discussion_tags" TO "authenticated";

GRANT ALL ON TABLE "public"."discussion_tags" TO "service_role";

GRANT ALL ON TABLE "public"."discussion_video_upload_events" TO "service_role";

GRANT SELECT ON TABLE "public"."discussion_video_upload_events" TO "authenticated";

GRANT SELECT,INSERT,MAINTAIN ON TABLE "public"."discussion_views" TO "anon";

GRANT SELECT,INSERT,MAINTAIN ON TABLE "public"."discussion_views" TO "authenticated";

GRANT ALL ON TABLE "public"."discussion_views" TO "service_role";

GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."discussions" TO "authenticated";

GRANT ALL ON TABLE "public"."discussions" TO "service_role";

GRANT SELECT ON TABLE "public"."discussions" TO "anon";

GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."profiles" TO "authenticated";

GRANT ALL ON TABLE "public"."profiles" TO "service_role";

GRANT SELECT ON TABLE "public"."profiles" TO "anon";

GRANT SELECT,MAINTAIN ON TABLE "public"."follows" TO "anon";

GRANT SELECT,INSERT,DELETE,MAINTAIN ON TABLE "public"."follows" TO "authenticated";

GRANT ALL ON TABLE "public"."follows" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN ON TABLE "public"."labs_feature_request_votes" TO "authenticated";

GRANT ALL ON TABLE "public"."labs_feature_request_votes" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."labs_feature_requests" TO "authenticated";

GRANT ALL ON TABLE "public"."labs_feature_requests" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."loombus_feature_flags" TO "anon";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."loombus_feature_flags" TO "authenticated";

GRANT ALL ON TABLE "public"."loombus_feature_flags" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."loombus_room_discussions" TO "anon";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."loombus_room_discussions" TO "authenticated";

GRANT ALL ON TABLE "public"."loombus_room_discussions" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."loombus_room_members" TO "anon";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."loombus_room_members" TO "authenticated";

GRANT ALL ON TABLE "public"."loombus_room_members" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."loombus_rooms" TO "anon";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."loombus_rooms" TO "authenticated";

GRANT ALL ON TABLE "public"."loombus_rooms" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."loombus_shell_preferences" TO "anon";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."loombus_shell_preferences" TO "authenticated";

GRANT ALL ON TABLE "public"."loombus_shell_preferences" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."loombus_v2_create_drafts" TO "anon";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."loombus_v2_create_drafts" TO "authenticated";

GRANT ALL ON TABLE "public"."loombus_v2_create_drafts" TO "service_role";

GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."notification_preferences" TO "authenticated";

GRANT ALL ON TABLE "public"."notification_preferences" TO "service_role";

GRANT SELECT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."notifications" TO "authenticated";

GRANT ALL ON TABLE "public"."notifications" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."paste_usage_events" TO "anon";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."paste_usage_events" TO "authenticated";

GRANT ALL ON TABLE "public"."paste_usage_events" TO "service_role";

GRANT SELECT,MAINTAIN ON TABLE "public"."private_conversation_members" TO "authenticated";

GRANT ALL ON TABLE "public"."private_conversation_members" TO "service_role";

GRANT SELECT,MAINTAIN ON TABLE "public"."private_conversations" TO "authenticated";

GRANT ALL ON TABLE "public"."private_conversations" TO "service_role";

GRANT SELECT,MAINTAIN ON TABLE "public"."private_message_attachments" TO "authenticated";

GRANT ALL ON TABLE "public"."private_message_attachments" TO "service_role";

GRANT SELECT,MAINTAIN ON TABLE "public"."private_messages" TO "authenticated";

GRANT ALL ON TABLE "public"."private_messages" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."profile_sensitive" TO "anon";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."profile_sensitive" TO "authenticated";

GRANT ALL ON TABLE "public"."profile_sensitive" TO "service_role";

GRANT SELECT,MAINTAIN ON TABLE "public"."replies" TO "anon";

GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."replies" TO "authenticated";

GRANT ALL ON TABLE "public"."replies" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."reply_reactions" TO "authenticated";

GRANT ALL ON TABLE "public"."reply_reactions" TO "service_role";

GRANT SELECT,MAINTAIN ON TABLE "public"."reports" TO "anon";

GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."reports" TO "authenticated";

GRANT ALL ON TABLE "public"."reports" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."room_activity_log" TO "anon";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."room_activity_log" TO "authenticated";

GRANT ALL ON TABLE "public"."room_activity_log" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."room_directory_contacts" TO "anon";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."room_directory_contacts" TO "authenticated";

GRANT ALL ON TABLE "public"."room_directory_contacts" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."room_documents" TO "anon";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."room_documents" TO "authenticated";

GRANT ALL ON TABLE "public"."room_documents" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."room_faq_entries" TO "anon";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."room_faq_entries" TO "authenticated";

GRANT ALL ON TABLE "public"."room_faq_entries" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."room_form_submissions" TO "anon";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."room_form_submissions" TO "authenticated";

GRANT ALL ON TABLE "public"."room_form_submissions" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."room_forms" TO "anon";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."room_forms" TO "authenticated";

GRANT ALL ON TABLE "public"."room_forms" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."room_join_requests" TO "anon";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."room_join_requests" TO "authenticated";

GRANT ALL ON TABLE "public"."room_join_requests" TO "service_role";

GRANT SELECT,MAINTAIN ON TABLE "public"."room_members" TO "authenticated";

GRANT ALL ON TABLE "public"."room_members" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."room_poll_votes" TO "anon";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."room_poll_votes" TO "authenticated";

GRANT ALL ON TABLE "public"."room_poll_votes" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."room_polls" TO "anon";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."room_polls" TO "authenticated";

GRANT ALL ON TABLE "public"."room_polls" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."room_post_attachments" TO "anon";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."room_post_attachments" TO "authenticated";

GRANT ALL ON TABLE "public"."room_post_attachments" TO "service_role";

GRANT SELECT,MAINTAIN ON TABLE "public"."room_post_participants" TO "authenticated";

GRANT ALL ON TABLE "public"."room_post_participants" TO "service_role";

GRANT SELECT,MAINTAIN ON TABLE "public"."room_posts" TO "authenticated";

GRANT ALL ON TABLE "public"."room_posts" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."room_preferences" TO "anon";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."room_preferences" TO "authenticated";

GRANT ALL ON TABLE "public"."room_preferences" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."room_product_templates" TO "anon";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."room_product_templates" TO "authenticated";

GRANT ALL ON TABLE "public"."room_product_templates" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."room_requests" TO "anon";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."room_requests" TO "authenticated";

GRANT ALL ON TABLE "public"."room_requests" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."room_service_listings" TO "anon";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."room_service_listings" TO "authenticated";

GRANT ALL ON TABLE "public"."room_service_listings" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."room_service_requests" TO "anon";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."room_service_requests" TO "authenticated";

GRANT ALL ON TABLE "public"."room_service_requests" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."room_subscription_plans" TO "anon";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."room_subscription_plans" TO "authenticated";

GRANT ALL ON TABLE "public"."room_subscription_plans" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."room_tasks" TO "anon";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."room_tasks" TO "authenticated";

GRANT ALL ON TABLE "public"."room_tasks" TO "service_role";

GRANT SELECT,MAINTAIN ON TABLE "public"."rooms" TO "authenticated";

GRANT ALL ON TABLE "public"."rooms" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."sticky_items" TO "authenticated";

GRANT ALL ON TABLE "public"."sticky_items" TO "service_role";

GRANT ALL ON TABLE "public"."support_requests" TO "service_role";

GRANT INSERT ON TABLE "public"."support_requests" TO "anon";

GRANT SELECT,INSERT,UPDATE ON TABLE "public"."support_requests" TO "authenticated";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."user_ai_entitlements" TO "authenticated";

GRANT ALL ON TABLE "public"."user_ai_entitlements" TO "service_role";

GRANT SELECT,MAINTAIN ON TABLE "public"."user_blocks" TO "anon";

GRANT SELECT,INSERT,DELETE,MAINTAIN ON TABLE "public"."user_blocks" TO "authenticated";

GRANT ALL ON TABLE "public"."user_blocks" TO "service_role";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."user_purpose_goals" TO "authenticated";

GRANT ALL ON TABLE "public"."user_purpose_goals" TO "service_role";

GRANT ALL ON TABLE "public"."user_push_device_tokens" TO "service_role";

GRANT SELECT,DELETE ON TABLE "public"."user_push_device_tokens" TO "authenticated";

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."user_topic_alerts" TO "authenticated";

GRANT ALL ON TABLE "public"."user_topic_alerts" TO "service_role";

GRANT ALL ON TABLE "public"."welcome_email_events" TO "service_role";

GRANT SELECT ON TABLE "public"."welcome_email_events" TO "authenticated";


commit;
