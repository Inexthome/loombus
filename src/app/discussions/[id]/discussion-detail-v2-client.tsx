"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  FileQuestion,
  Flag,
  Folder,
  Lightbulb,
  Link2,
  LoaderCircle,
  LockKeyhole,
  MessageCircle,
  Pencil,
  Pin,
  PinOff,
  Reply as ReplyIcon,
  RotateCcw,
  Send,
  Share2,
  Sparkles,
  StickyNote,
  Trash2,
  UserRound,
  WandSparkles,
  X,
} from "lucide-react";
import { REPORT_REASONS, type ReportReason } from "@/lib/report-reasons";
import { SafetyWarningModal } from "@/components/safety-warning-modal";
import {
  AI_TOOLS,
  REPLY_HELPERS,
  REPLY_REACTIONS,
  type AiToolKey,
  type Profile,
  type Reply,
  type ReplyReactionCounts,
  type ReplyReactionType,
  formatDateTime,
  formatShortDate,
  getDiscussionModeLabel,
  getEditLabel,
  getProfileHandle,
  getProfileName,
  getReactionTotal,
  getReplyReferencePreview,
  getStructuredDiscussionSections,
} from "./discussion-detail-v2-model";
import {
  AiRatingControls,
  AttachmentGallery,
  AuthorIdentity,
  InlineNotice,
  MentionText,
  RichText,
} from "./discussion-detail-v2-components";
import { type ReplySort, useDiscussionDetailV2 } from "./use-discussion-detail-v2";

const AI_FEATURE_KEYS: Record<AiToolKey, string> = {
  summary: "thread_summary",
  keyTakeaways: "key_takeaways",
  whatChanged: "what_changed",
  disagreementMap: "disagreement_map",
  conversationMap: "conversation_map",
  relatedIdeas: "related_ideas",
};

type ReplyCardProps = {
  reply: Reply;
  profile?: Profile;
  referencedReply?: Reply | null;
  referencedProfile?: Profile;
  reactionCounts: ReplyReactionCounts;
  myReactions: ReplyReactionType[];
  currentUserId: string | null;
  canManageDiscussion: boolean;
  isPinned: boolean;
  isReported: boolean;
  editingReplyId: string | null;
  editingReplyBody: string;
  workingAction: string;
  reactionWorkingKey: string;
  onEditingBodyChange: (value: string) => void;
  onStartEdit: (reply: Reply) => void;
  onCancelEdit: () => void;
  onUpdate: (replyId: string) => void;
  onDelete: (replyId: string) => void;
  onRespond: (reply: Reply) => void;
  onReport: (replyId: string) => void;
  onPin: (replyId: string, unpin?: boolean) => void;
  onReact: (replyId: string, reactionType: ReplyReactionType) => void;
};

function ReplyCard({
  reply,
  profile,
  referencedReply,
  referencedProfile,
  reactionCounts,
  myReactions,
  currentUserId,
  canManageDiscussion,
  isPinned,
  isReported,
  editingReplyId,
  editingReplyBody,
  workingAction,
  reactionWorkingKey,
  onEditingBodyChange,
  onStartEdit,
  onCancelEdit,
  onUpdate,
  onDelete,
  onRespond,
  onReport,
  onPin,
  onReact,
}: ReplyCardProps) {
  const isOwnReply = currentUserId === reply.user_id;
  const isEditing = editingReplyId === reply.id;
  const editLabel = getEditLabel(reply);
  const signalTotal = getReactionTotal(reactionCounts);

  return (
    <article className={`discussion-v2-reply-card${isPinned ? " is-pinned" : ""}`}>
      <header className="discussion-v2-reply-header">
        <AuthorIdentity profile={profile} size="sm" />
        <div className="discussion-v2-reply-meta">
          {isPinned ? (
            <span className="discussion-v2-pinned-label">
              <Pin aria-hidden="true" size={13} />
              Pinned by thread owner
            </span>
          ) : null}
          <span>{formatDateTime(reply.created_at)}</span>
          {editLabel ? <span>{editLabel}</span> : null}
        </div>
      </header>

      {referencedReply ? (
        <button
          type="button"
          className="discussion-v2-reference-card"
          onClick={() => document.getElementById(`reply-${referencedReply.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
        >
          <span className="discussion-v2-reference-label">
            <ReplyIcon aria-hidden="true" size={14} />
            Responding to {getProfileName(referencedProfile)}
          </span>
          <span>{getReplyReferencePreview(referencedReply)}</span>
        </button>
      ) : null}

      {isEditing ? (
        <div className="discussion-v2-reply-edit">
          <textarea
            value={editingReplyBody}
            onChange={(event) => onEditingBodyChange(event.target.value)}
            rows={6}
            autoFocus
          />
          <div className="discussion-v2-inline-actions">
            <button
              type="button"
              className="discussion-v2-button discussion-v2-button-primary"
              disabled={workingAction === `edit:${reply.id}`}
              onClick={() => onUpdate(reply.id)}
            >
              {workingAction === `edit:${reply.id}` ? <LoaderCircle className="is-spinning" size={16} /> : <Check size={16} />}
              Save changes
            </button>
            <button type="button" className="discussion-v2-button" onClick={onCancelEdit}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <RichText content={reply.body} className="discussion-v2-reply-body" />
      )}

      <div className="discussion-v2-reaction-row" aria-label="Reply reactions">
        {REPLY_REACTIONS.map((reaction) => {
          const selected = myReactions.includes(reaction.type);
          const count = reactionCounts[reaction.type] ?? 0;
          const working = reactionWorkingKey === `${reply.id}:${reaction.type}`;
          return (
            <button
              key={reaction.type}
              type="button"
              aria-pressed={selected}
              disabled={working || isOwnReply}
              title={isOwnReply ? "You cannot react to your own reply." : reaction.label}
              onClick={() => onReact(reply.id, reaction.type)}
            >
              {working ? <LoaderCircle className="is-spinning" size={13} /> : null}
              <span>{reaction.shortLabel}</span>
              {count > 0 ? <strong>{count}</strong> : null}
            </button>
          );
        })}
      </div>

      <footer className="discussion-v2-reply-footer">
        <button type="button" onClick={() => onRespond(reply)}>
          <ReplyIcon aria-hidden="true" size={15} />
          Respond to point
        </button>
        <span className="discussion-v2-reply-signal">{signalTotal} signal{signalTotal === 1 ? "" : "s"}</span>
        <span className="discussion-v2-reply-footer-spacer" />
        {canManageDiscussion ? (
          <button
            type="button"
            disabled={workingAction === `pin:${reply.id}`}
            onClick={() => onPin(reply.id, isPinned)}
          >
            {isPinned ? <PinOff aria-hidden="true" size={15} /> : <Pin aria-hidden="true" size={15} />}
            {isPinned ? "Unpin" : "Pin"}
          </button>
        ) : null}
        {isOwnReply ? (
          <>
            <button type="button" onClick={() => onStartEdit(reply)}>
              <Pencil aria-hidden="true" size={15} />
              Edit
            </button>
            <button
              type="button"
              disabled={workingAction === `delete:${reply.id}`}
              onClick={() => onDelete(reply.id)}
            >
              <Trash2 aria-hidden="true" size={15} />
              Delete
            </button>
          </>
        ) : (
          <button type="button" disabled={isReported} onClick={() => onReport(reply.id)}>
            <Flag aria-hidden="true" size={15} />
            {isReported ? "Reported" : "Report"}
          </button>
        )}
      </footer>
    </article>
  );
}

function LoadingState() {
  return (
    <main className="discussion-v2-page">
      <div className="discussion-v2-loading-shell" aria-label="Loading discussion">
        <div className="discussion-v2-skeleton discussion-v2-skeleton-short" />
        <div className="discussion-v2-skeleton discussion-v2-skeleton-title" />
        <div className="discussion-v2-skeleton discussion-v2-skeleton-line" />
        <div className="discussion-v2-skeleton discussion-v2-skeleton-line" />
        <div className="discussion-v2-skeleton discussion-v2-skeleton-card" />
      </div>
    </main>
  );
}

export default function DiscussionDetailV2Client() {
  const controller = useDiscussionDetailV2();
  const {
    composerRef,
    repliesRef,
    discussion,
    profile,
    replies,
    relatedDiscussions,
    discussionTags,
    discussionAttachments,
    replyProfiles,
    loading,
    currentUserId,
    viewerIdentityStatus,
    subscriptionDisplay,
    canUsePremium,
    canManageDiscussion,
    pinnedReply,
    sortedReplies,
    replyBody,
    setReplyBody,
    referencedReply,
    setReferencedReply,
    editingReplyId,
    setEditingReplyId,
    editingReplyBody,
    setEditingReplyBody,
    replySort,
    setReplySort,
    replyReactionCounts,
    myReplyReactions,
    isSaved,
    bookmarkCollections,
    selectedSaveCollectionId,
    setSelectedSaveCollectionId,
    showSavePanel,
    setShowSavePanel,
    isStickied,
    reportedDiscussion,
    reportedReplyIds,
    reportTarget,
    setReportTarget,
    reportReason,
    setReportReason,
    discussionSummary,
    activeAiTool,
    aiResults,
    aiOutputRatings,
    replySuggestions,
    workingAction,
    reactionWorkingKey,
    aiWorkingKey,
    ratingWorkingKey,
    notice,
    error,
    safetyWarning,
    setSafetyWarning,
    scrollToComposer,
    scrollToReplies,
    handleReply,
    handleReplyFormKeyDown,
    handleReplyPaste,
    startReplyEdit,
    handleUpdateReply,
    handleDeleteReply,
    handleToggleReplyReaction,
    updatePinnedReply,
    updateDiscussionStatus,
    openSavePanel,
    handleSaveDiscussion,
    handleRemoveBookmark,
    handleAddToStickies,
    submitReport,
    runAiTool,
    selectAiTool,
    generateReplySuggestions,
    rateAiOutput,
    shareDiscussion,
  } = controller;

  if (loading) return <LoadingState />;

  if (!discussion) {
    return (
      <main className="discussion-v2-page">
        <section className="discussion-v2-not-found">
          <FileQuestion aria-hidden="true" size={34} />
          <p className="discussion-v2-eyebrow">Discussion unavailable</p>
          <h1>This discussion could not be found.</h1>
          <p>It may have been removed, made unavailable, or the link may be incorrect.</p>
          <Link href="/discussions" className="discussion-v2-button discussion-v2-button-primary">
            <ArrowLeft aria-hidden="true" size={17} />
            Back to discussions
          </Link>
        </section>
      </main>
    );
  }

  const structuredSections = getStructuredDiscussionSections(discussion).filter(([, value]) =>
    String(value ?? "").trim()
  );
  const discussionStatus = discussion.discussion_status === "resolved" ? "resolved" : "open";
  const activeTool = AI_TOOLS.find((tool) => tool.key === activeAiTool) ?? AI_TOOLS[0];
  const activeFeatureKey = AI_FEATURE_KEYS[activeAiTool];
  const activeAiOutput =
    activeAiTool === "summary"
      ? discussionSummary?.summary ?? ""
      : aiResults[activeAiTool as Exclude<AiToolKey, "summary">] ?? "";
  const authorVerification = profile?.identity_verification_status;

  return (
    <main className="discussion-v2-page">
      <SafetyWarningModal warning={safetyWarning} onClose={() => setSafetyWarning(null)} />

      <div className="discussion-v2-layout">
        <aside className="discussion-v2-left-rail" aria-label="Discussion navigation">
          <div className="discussion-v2-sticky-stack">
            <Link href="/discussions" className="discussion-v2-back-link">
              <ArrowLeft aria-hidden="true" size={17} />
              Discussions
            </Link>

            <nav className="discussion-v2-section-nav">
              <p className="discussion-v2-rail-label">On this page</p>
              <button type="button" onClick={() => document.getElementById("discussion-opening")?.scrollIntoView({ behavior: "smooth" })}>
                <CircleDot aria-hidden="true" size={15} />
                Opening post
              </button>
              <button type="button" onClick={() => document.getElementById("discussion-intelligence")?.scrollIntoView({ behavior: "smooth" })}>
                <Sparkles aria-hidden="true" size={15} />
                State of discussion
              </button>
              <button type="button" onClick={() => scrollToComposer()}>
                <ReplyIcon aria-hidden="true" size={15} />
                Add your reply
              </button>
              <button type="button" onClick={scrollToReplies}>
                <MessageCircle aria-hidden="true" size={15} />
                Replies
                <span>{replies.length}</span>
              </button>
            </nav>

            <section className="discussion-v2-rail-status">
              <span className={`discussion-v2-status-dot is-${discussionStatus}`} />
              <div>
                <strong>{discussionStatus === "resolved" ? "Resolved" : "Open thread"}</strong>
                <span>
                  {discussionStatus === "resolved"
                    ? "The owner marked this discussion resolved."
                    : "New replies and stronger evidence can still move it forward."}
                </span>
              </div>
            </section>
          </div>
        </aside>

        <div className="discussion-v2-main-column">
          <article id="discussion-opening" className="discussion-v2-opening-card">
            <div className="discussion-v2-topic-row">
              <Link href={`/topics/${encodeURIComponent(discussion.topic)}`} className="discussion-v2-topic-pill">
                {discussion.topic || "Other"}
              </Link>
              <span className="discussion-v2-mode-pill">
                {getDiscussionModeLabel(discussion.discussion_type)}
              </span>
              {discussion.reality_lens ? <span>{discussion.reality_lens}</span> : null}
              {discussion.purpose_lane ? <span>{discussion.purpose_lane}</span> : null}
            </div>

            <h1>{discussion.title}</h1>

            <div className="discussion-v2-opening-meta">
              <AuthorIdentity profile={profile} size="md" />
              <span className="discussion-v2-meta-divider" />
              <span className="discussion-v2-date-meta">
                <Clock3 aria-hidden="true" size={15} />
                Started {formatDateTime(discussion.created_at)}
              </span>
              {getEditLabel(discussion) ? <span>{getEditLabel(discussion)}</span> : null}
              {authorVerification === "verified" ? (
                <span className="discussion-v2-verified-label">
                  <CheckCircle2 aria-hidden="true" size={14} />
                  Verified identity
                </span>
              ) : null}
            </div>

            <RichText content={discussion.body} className="discussion-v2-opening-body" />
            <AttachmentGallery attachments={discussionAttachments} />

            {structuredSections.length > 0 ? (
              <section className="discussion-v2-structured-grid" aria-label="Structured discussion details">
                {structuredSections.map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <p><MentionText text={String(value)} /></p>
                  </div>
                ))}
              </section>
            ) : null}

            {discussionTags.length > 0 ? (
              <div className="discussion-v2-tags" aria-label="Discussion tags">
                {discussionTags.map((tag) => (
                  <Link key={tag} href={`/search?q=${encodeURIComponent(tag)}`}>#{tag}</Link>
                ))}
              </div>
            ) : null}

            <footer className="discussion-v2-opening-actions">
              <button type="button" className="discussion-v2-button discussion-v2-button-primary" onClick={() => scrollToComposer()}>
                <ReplyIcon aria-hidden="true" size={17} />
                Join the discussion
              </button>
              <button
                type="button"
                className="discussion-v2-button"
                disabled={workingAction === "save"}
                onClick={() => (isSaved ? void handleRemoveBookmark() : void openSavePanel())}
              >
                {isSaved ? <BookmarkCheck aria-hidden="true" size={17} /> : <Bookmark aria-hidden="true" size={17} />}
                {isSaved ? "Saved" : "Save"}
              </button>
              <button type="button" className="discussion-v2-button" onClick={() => void shareDiscussion()}>
                <Share2 aria-hidden="true" size={17} />
                Share
              </button>
              <span className="discussion-v2-opening-action-spacer" />
              <button
                type="button"
                className="discussion-v2-button discussion-v2-button-quiet"
                disabled={reportedDiscussion}
                onClick={() => setReportTarget({ type: "discussion" })}
              >
                <Flag aria-hidden="true" size={16} />
                {reportedDiscussion ? "Reported" : "Report"}
              </button>
            </footer>
          </article>

          <section id="discussion-intelligence" className="discussion-v2-intelligence-card">
            <header className="discussion-v2-section-heading">
              <div>
                <p className="discussion-v2-eyebrow">State of the discussion</p>
                <h2>Understand the thread without replacing it.</h2>
                <p>Loombus intelligence organizes the conversation while keeping the original post and replies visible.</p>
              </div>
              <span className="discussion-v2-plan-chip">
                <Sparkles aria-hidden="true" size={15} />
                {subscriptionDisplay.label}
              </span>
            </header>

            <div className="discussion-v2-ai-layout">
              <div className="discussion-v2-ai-tabs" role="tablist" aria-label="Discussion intelligence tools">
                {AI_TOOLS.map((tool) => (
                  <button
                    key={tool.key}
                    type="button"
                    role="tab"
                    aria-selected={activeAiTool === tool.key}
                    onClick={() => selectAiTool(tool.key)}
                  >
                    <span>{tool.label}</span>
                    <ChevronRight aria-hidden="true" size={15} />
                  </button>
                ))}
              </div>

              <div className="discussion-v2-ai-output" role="tabpanel">
                <div className="discussion-v2-ai-output-heading">
                  <div>
                    <p className="discussion-v2-eyebrow">{activeTool.eyebrow}</p>
                    <h3>{activeTool.label}</h3>
                    <p>{activeTool.description}</p>
                  </div>
                  {canUsePremium ? (
                    <button
                      type="button"
                      className="discussion-v2-icon-button"
                      title="Regenerate"
                      disabled={aiWorkingKey === activeAiTool}
                      onClick={() => void runAiTool(activeAiTool)}
                    >
                      <RotateCcw aria-hidden="true" size={17} />
                    </button>
                  ) : null}
                </div>

                {!canUsePremium ? (
                  <div className="discussion-v2-ai-lock">
                    <span><LockKeyhole aria-hidden="true" size={21} /></span>
                    <div>
                      <strong>Premium intelligence tool</strong>
                      <p>Upgrade to organize long discussions into summaries, maps, takeaways, and related ideas.</p>
                    </div>
                    <Link href="/premium" className="discussion-v2-button discussion-v2-button-primary">View Premium</Link>
                  </div>
                ) : aiWorkingKey === activeAiTool ? (
                  <div className="discussion-v2-ai-loading">
                    <LoaderCircle className="is-spinning" aria-hidden="true" size={22} />
                    Building {activeTool.label.toLowerCase()}...
                  </div>
                ) : activeAiOutput ? (
                  <>
                    <RichText content={activeAiOutput} className="discussion-v2-ai-result" />
                    <AiRatingControls
                      featureKey={activeFeatureKey}
                      rating={aiOutputRatings[activeFeatureKey]}
                      working={ratingWorkingKey === activeFeatureKey}
                      onRate={(featureKey, rating) => void rateAiOutput(featureKey, rating)}
                    />
                  </>
                ) : (
                  <div className="discussion-v2-ai-empty">
                    <Lightbulb aria-hidden="true" size={24} />
                    <p>Generate this view when you need it. The original conversation remains the source of truth.</p>
                    <button type="button" className="discussion-v2-button discussion-v2-button-primary" onClick={() => void runAiTool(activeAiTool)}>
                      <WandSparkles aria-hidden="true" size={17} />
                      Generate {activeTool.label}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="discussion-v2-composer-card">
            <form ref={composerRef} onSubmit={handleReply} onKeyDown={handleReplyFormKeyDown}>
              <header className="discussion-v2-section-heading discussion-v2-composer-heading">
                <div>
                  <p className="discussion-v2-eyebrow">Add signal</p>
                  <h2>Write a reply that moves the discussion forward.</h2>
                  <p>Respond to the claim, add evidence, ask a precise question, or identify the next useful step.</p>
                </div>
                <span className="discussion-v2-shortcut">⌘ / Ctrl + Enter</span>
              </header>

              {referencedReply ? (
                <div className="discussion-v2-composer-reference">
                  <div>
                    <span>Responding to {getProfileName(replyProfiles[referencedReply.user_id])}</span>
                    <p>{getReplyReferencePreview(referencedReply)}</p>
                  </div>
                  <button type="button" aria-label="Remove reply reference" onClick={() => setReferencedReply(null)}>
                    <X aria-hidden="true" size={17} />
                  </button>
                </div>
              ) : null}

              <div className="discussion-v2-helper-row" aria-label="Reply starters">
                {REPLY_HELPERS.map((group) => (
                  <div key={group.title} className="discussion-v2-helper-group">
                    <span>{group.title}</span>
                    {group.prompts.map((prompt, index) => (
                      <button key={prompt} type="button" onClick={() => scrollToComposer(prompt, null)}>
                        {index === 0 ? group.title : `${group.title} ${index + 1}`}
                      </button>
                    ))}
                  </div>
                ))}
              </div>

              <textarea
                value={replyBody}
                onChange={(event) => setReplyBody(event.target.value)}
                onPaste={handleReplyPaste}
                rows={8}
                placeholder="Add context, evidence, a counterpoint, or the next useful question..."
                aria-label="Write your reply"
              />

              {replySuggestions ? (
                <div className="discussion-v2-reply-suggestions">
                  <div>
                    <Sparkles aria-hidden="true" size={17} />
                    <strong>Reply targets</strong>
                  </div>
                  <RichText content={replySuggestions} />
                </div>
              ) : null}

              <div className="discussion-v2-composer-footer">
                <div className="discussion-v2-composer-identity">
                  <UserRound aria-hidden="true" size={16} />
                  <span>
                    {currentUserId
                      ? viewerIdentityStatus === "verified"
                        ? "Replying with a verified identity"
                        : "Replying from your Loombus profile"
                      : "Sign in to publish your reply"}
                  </span>
                </div>
                <button
                  type="button"
                  className="discussion-v2-button"
                  disabled={!canUsePremium || aiWorkingKey === "replySuggestions"}
                  title={canUsePremium ? "Generate reply targets" : "Premium feature"}
                  onClick={() => void generateReplySuggestions()}
                >
                  {aiWorkingKey === "replySuggestions" ? <LoaderCircle className="is-spinning" size={16} /> : <Sparkles size={16} />}
                  Reply targets
                </button>
                <button
                  type="submit"
                  className="discussion-v2-button discussion-v2-button-primary"
                  disabled={workingAction === "reply" || !replyBody.trim()}
                >
                  {workingAction === "reply" ? <LoaderCircle className="is-spinning" size={17} /> : <Send aria-hidden="true" size={17} />}
                  Post reply
                </button>
              </div>
            </form>
          </section>

          <div className="discussion-v2-feedback-region" aria-live="polite">
            <InlineNotice tone="success">{notice}</InlineNotice>
            <InlineNotice tone="error">{error}</InlineNotice>
          </div>

          <section ref={repliesRef} id="discussion-replies" className="discussion-v2-replies-section">
            <header className="discussion-v2-replies-heading">
              <div>
                <p className="discussion-v2-eyebrow">Conversation</p>
                <h2>{replies.length} {replies.length === 1 ? "reply" : "replies"}</h2>
              </div>
              <div className="discussion-v2-sort-control" role="group" aria-label="Sort replies">
                {(["best", "newest", "oldest"] as ReplySort[]).map((sort) => (
                  <button
                    key={sort}
                    type="button"
                    aria-pressed={replySort === sort}
                    onClick={() => setReplySort(sort)}
                  >
                    {sort === "best" ? "Best signal" : sort === "newest" ? "Newest" : "Oldest"}
                  </button>
                ))}
              </div>
            </header>

            {pinnedReply ? (
              <ReplyCard
                reply={pinnedReply}
                profile={replyProfiles[pinnedReply.user_id]}
                referencedReply={pinnedReply.referenced_reply_id ? replies.find((reply) => reply.id === pinnedReply.referenced_reply_id) : null}
                referencedProfile={pinnedReply.referenced_reply_id ? replyProfiles[replies.find((reply) => reply.id === pinnedReply.referenced_reply_id)?.user_id ?? ""] : undefined}
                reactionCounts={replyReactionCounts[pinnedReply.id] ?? {}}
                myReactions={myReplyReactions[pinnedReply.id] ?? []}
                currentUserId={currentUserId}
                canManageDiscussion={canManageDiscussion}
                isPinned
                isReported={reportedReplyIds.includes(pinnedReply.id)}
                editingReplyId={editingReplyId}
                editingReplyBody={editingReplyBody}
                workingAction={workingAction}
                reactionWorkingKey={reactionWorkingKey}
                onEditingBodyChange={setEditingReplyBody}
                onStartEdit={startReplyEdit}
                onCancelEdit={() => { setEditingReplyId(null); setEditingReplyBody(""); }}
                onUpdate={(replyId) => void handleUpdateReply(replyId)}
                onDelete={(replyId) => void handleDeleteReply(replyId)}
                onRespond={(reply) => scrollToComposer(undefined, reply)}
                onReport={(replyId) => setReportTarget({ type: "reply", replyId })}
                onPin={(replyId, unpin) => void updatePinnedReply(replyId, unpin)}
                onReact={(replyId, reactionType) => void handleToggleReplyReaction(replyId, reactionType)}
              />
            ) : null}

            {sortedReplies.length > 0 ? (
              <div className="discussion-v2-reply-list">
                {sortedReplies.map((reply) => {
                  const referenced = reply.referenced_reply_id
                    ? replies.find((candidate) => candidate.id === reply.referenced_reply_id) ?? null
                    : null;
                  return (
                    <div id={`reply-${reply.id}`} key={reply.id}>
                      <ReplyCard
                        reply={reply}
                        profile={replyProfiles[reply.user_id]}
                        referencedReply={referenced}
                        referencedProfile={referenced ? replyProfiles[referenced.user_id] : undefined}
                        reactionCounts={replyReactionCounts[reply.id] ?? {}}
                        myReactions={myReplyReactions[reply.id] ?? []}
                        currentUserId={currentUserId}
                        canManageDiscussion={canManageDiscussion}
                        isPinned={false}
                        isReported={reportedReplyIds.includes(reply.id)}
                        editingReplyId={editingReplyId}
                        editingReplyBody={editingReplyBody}
                        workingAction={workingAction}
                        reactionWorkingKey={reactionWorkingKey}
                        onEditingBodyChange={setEditingReplyBody}
                        onStartEdit={startReplyEdit}
                        onCancelEdit={() => { setEditingReplyId(null); setEditingReplyBody(""); }}
                        onUpdate={(replyId) => void handleUpdateReply(replyId)}
                        onDelete={(replyId) => void handleDeleteReply(replyId)}
                        onRespond={(candidate) => scrollToComposer(undefined, candidate)}
                        onReport={(replyId) => setReportTarget({ type: "reply", replyId })}
                        onPin={(replyId, unpin) => void updatePinnedReply(replyId, unpin)}
                        onReact={(replyId, reactionType) => void handleToggleReplyReaction(replyId, reactionType)}
                      />
                    </div>
                  );
                })}
              </div>
            ) : !pinnedReply ? (
              <div className="discussion-v2-empty-replies">
                <MessageCircle aria-hidden="true" size={28} />
                <h3>There are no replies yet.</h3>
                <p>Be the first person to add evidence, a useful distinction, or the next question.</p>
                <button type="button" className="discussion-v2-button discussion-v2-button-primary" onClick={() => scrollToComposer()}>
                  Write the first reply
                </button>
              </div>
            ) : null}
          </section>
        </div>

        <aside className="discussion-v2-right-rail" aria-label="Discussion context">
          <div className="discussion-v2-sticky-stack">
            <section className="discussion-v2-side-card discussion-v2-glance-card">
              <p className="discussion-v2-rail-label">Thread at a glance</p>
              <dl>
                <div><dt>Replies</dt><dd>{replies.length}</dd></div>
                <div><dt>Status</dt><dd>{discussionStatus === "resolved" ? "Resolved" : "Open"}</dd></div>
                <div><dt>Mode</dt><dd>{getDiscussionModeLabel(discussion.discussion_type)}</dd></div>
                <div><dt>Started</dt><dd>{formatShortDate(discussion.created_at)}</dd></div>
              </dl>
              {canManageDiscussion ? (
                <button
                  type="button"
                  className="discussion-v2-button discussion-v2-button-wide"
                  disabled={workingAction === "status"}
                  onClick={() => void updateDiscussionStatus(discussionStatus === "resolved" ? "open" : "resolved")}
                >
                  {discussionStatus === "resolved" ? <RotateCcw size={16} /> : <CheckCircle2 size={16} />}
                  {discussionStatus === "resolved" ? "Reopen discussion" : "Mark resolved"}
                </button>
              ) : null}
            </section>

            <section className="discussion-v2-side-card">
              <p className="discussion-v2-rail-label">Started by</p>
              <AuthorIdentity profile={profile} size="lg" />
              <p className="discussion-v2-side-copy">
                {getProfileHandle(profile)} opened this thread in {discussion.topic || "Other"}.
              </p>
              {profile?.username ? (
                <Link href={`/u/${profile.username}`} className="discussion-v2-side-link">
                  View profile <ChevronRight aria-hidden="true" size={15} />
                </Link>
              ) : null}
            </section>

            <section className="discussion-v2-side-card">
              <p className="discussion-v2-rail-label">Keep it close</p>
              <div className="discussion-v2-side-actions">
                <button type="button" onClick={() => (isSaved ? void handleRemoveBookmark() : void openSavePanel())}>
                  {isSaved ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
                  <span><strong>{isSaved ? "Saved" : "Save discussion"}</strong><small>Return to it from Saved.</small></span>
                </button>
                <button type="button" disabled={!canUsePremium || isStickied || workingAction === "sticky"} onClick={() => void handleAddToStickies()}>
                  <StickyNote size={17} />
                  <span><strong>{isStickied ? "In Stickies" : "Add to Stickies"}</strong><small>{canUsePremium ? "Keep it in your active workspace." : "Premium feature"}</small></span>
                </button>
                <button type="button" onClick={() => void shareDiscussion()}>
                  <Link2 size={17} />
                  <span><strong>Share link</strong><small>Invite someone into the thread.</small></span>
                </button>
              </div>
            </section>

            {relatedDiscussions.length > 0 ? (
              <section className="discussion-v2-side-card" id="related-discussions">
                <div className="discussion-v2-side-card-heading">
                  <p className="discussion-v2-rail-label">Related discussions</p>
                  <Link href={`/topics/${encodeURIComponent(discussion.topic)}`}>View topic</Link>
                </div>
                <div className="discussion-v2-related-list">
                  {relatedDiscussions.map((related) => (
                    <Link key={related.id} href={`/discussions/${related.id}`}>
                      <span>{related.topic}</span>
                      <strong>{related.title}</strong>
                      <small>{formatShortDate(related.created_at)}</small>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </aside>
      </div>

      <div className="discussion-v2-mobile-bar">
        <button type="button" onClick={() => scrollToComposer()}>
          <ReplyIcon aria-hidden="true" size={18} />
          Reply
        </button>
        <button type="button" aria-label={isSaved ? "Remove saved discussion" : "Save discussion"} onClick={() => (isSaved ? void handleRemoveBookmark() : void openSavePanel())}>
          {isSaved ? <BookmarkCheck aria-hidden="true" size={19} /> : <Bookmark aria-hidden="true" size={19} />}
        </button>
        <button type="button" aria-label="Share discussion" onClick={() => void shareDiscussion()}>
          <Share2 aria-hidden="true" size={19} />
        </button>
      </div>

      {showSavePanel ? (
        <div className="discussion-v2-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowSavePanel(false); }}>
          <section className="discussion-v2-modal" role="dialog" aria-modal="true" aria-labelledby="save-discussion-title">
            <header>
              <div>
                <p className="discussion-v2-eyebrow">Save discussion</p>
                <h2 id="save-discussion-title">Choose a folder</h2>
              </div>
              <button type="button" className="discussion-v2-icon-button" aria-label="Close" onClick={() => setShowSavePanel(false)}><X size={18} /></button>
            </header>
            <label>
              Folder
              <select value={selectedSaveCollectionId} onChange={(event) => setSelectedSaveCollectionId(event.target.value)}>
                <option value="unfiled">Unfiled</option>
                {bookmarkCollections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}
              </select>
            </label>
            <p className="discussion-v2-modal-help"><Folder size={16} /> Premium folders keep research, projects, and ongoing conversations organized.</p>
            <footer>
              <button type="button" className="discussion-v2-button" onClick={() => setShowSavePanel(false)}>Cancel</button>
              <button
                type="button"
                className="discussion-v2-button discussion-v2-button-primary"
                disabled={workingAction === "save"}
                onClick={() => void handleSaveDiscussion(selectedSaveCollectionId === "unfiled" ? null : selectedSaveCollectionId)}
              >
                {workingAction === "save" ? <LoaderCircle className="is-spinning" size={16} /> : <Bookmark size={16} />}
                Save discussion
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {reportTarget ? (
        <div className="discussion-v2-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setReportTarget(null); }}>
          <section className="discussion-v2-modal" role="dialog" aria-modal="true" aria-labelledby="report-content-title">
            <header>
              <div>
                <p className="discussion-v2-eyebrow">Safety report</p>
                <h2 id="report-content-title">Report {reportTarget.type === "discussion" ? "discussion" : "reply"}</h2>
              </div>
              <button type="button" className="discussion-v2-icon-button" aria-label="Close" onClick={() => setReportTarget(null)}><X size={18} /></button>
            </header>
            <label>
              Reason
              <select value={reportReason} onChange={(event) => setReportReason(event.target.value as ReportReason)}>
                {REPORT_REASONS.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
              </select>
            </label>
            <p className="discussion-v2-modal-help"><Flag size={16} /> Reports are reviewed against Loombus safety and platform policies.</p>
            <footer>
              <button type="button" className="discussion-v2-button" onClick={() => setReportTarget(null)}>Cancel</button>
              <button type="button" className="discussion-v2-button discussion-v2-button-danger" disabled={workingAction === "report"} onClick={() => void submitReport()}>
                {workingAction === "report" ? <LoaderCircle className="is-spinning" size={16} /> : <Flag size={16} />}
                Submit report
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </main>
  );
}
