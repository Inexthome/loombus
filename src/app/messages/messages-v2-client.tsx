"use client";

import Link from "next/link";
import {
  Archive,
  Bell,
  BellOff,
  ChevronLeft,
  FileText,
  Flag,
  Image as ImageIcon,
  Inbox,
  Info,
  LoaderCircle,
  LockKeyhole,
  MessageCircle,
  MoreHorizontal,
  Paperclip,
  Search,
  Send,
  ShieldCheck,
  SquarePen,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import {
  AttachmentLimitNote,
  ConversationIdentity,
  ConversationListItem,
  MessageAttachmentCard,
  MessageBubble,
  MessagesInlineNotice,
  PeopleSearchResultCard,
  PrivateMessagingNote,
} from "./messages-v2-components";
import {
  MESSAGE_REPORT_REASONS,
  formatMessageAttachmentFileSize,
  formatMessageDay,
  getConversationHandle,
  getConversationName,
  isDifferentMessageDay,
} from "./messages-v2-model";
import { useMessagesV2 } from "./use-messages-v2";

function LoadingState() {
  return (
    <main className="messages-v2-page">
      <div className="messages-v2-loading-shell" aria-label="Loading messages">
        <div className="messages-v2-skeleton messages-v2-skeleton-heading" />
        <div className="messages-v2-loading-grid">
          <div className="messages-v2-skeleton messages-v2-skeleton-panel" />
          <div className="messages-v2-skeleton messages-v2-skeleton-thread" />
          <div className="messages-v2-skeleton messages-v2-skeleton-panel" />
        </div>
      </div>
    </main>
  );
}

export default function MessagesV2Client() {
  const controller = useMessagesV2();
  const {
    threadEndRef,
    composerRef,
    loading,
    threadLoading,
    currentUserId,
    conversations,
    selectedConversation,
    selectedConversationId,
    threadMessages,
    mobileThreadOpen,
    filteredConversations,
    conversationSearch,
    setConversationSearch,
    conversationFilter,
    setConversationFilter,
    unreadCount,
    mutedCount,
    newMessageOpen,
    peopleSearchQuery,
    setPeopleSearchQuery,
    peopleSearchResults,
    peopleSearchLoading,
    startingConversation,
    composerText,
    setComposerText,
    attachmentFiles,
    attachmentMessage,
    typingUserName,
    sending,
    conversationAction,
    conversationMenuOpen,
    setConversationMenuOpen,
    detailsOpen,
    setDetailsOpen,
    reportPanelOpen,
    setReportPanelOpen,
    reportReason,
    setReportReason,
    reportNotes,
    setReportNotes,
    sharedAttachments,
    notice,
    noticeTone,
    showNotice,
    selectConversation,
    closeMobileThread,
    openNewMessage,
    closeNewMessage,
    handleStartConversation,
    runConversationAction,
    sendTypingIndicator,
    handleAttachmentSelection,
    clearAttachments,
    handleSendMessage,
    handleComposerKeyDown,
  } = controller;

  if (loading) return <LoadingState />;

  const filters = [
    ["all", "All", conversations.length],
    ["unread", "Unread", unreadCount],
    ["muted", "Muted", mutedCount],
  ] as const;

  const renderDetails = (drawer = false) => {
    if (!selectedConversation) return null;
    return (
      <section className={`messages-v2-details-card${drawer ? " is-drawer" : ""}`}>
        {drawer ? (
          <header className="messages-v2-drawer-header">
            <div>
              <p className="messages-v2-eyebrow">Conversation details</p>
              <h2>Private thread</h2>
            </div>
            <button
              type="button"
              className="messages-v2-icon-button"
              onClick={() => setDetailsOpen(false)}
              aria-label="Close conversation details"
            >
              <X aria-hidden="true" size={18} />
            </button>
          </header>
        ) : null}

        <div className="messages-v2-details-identity">
          <ConversationIdentity conversation={selectedConversation} size="lg" />
          <span className="messages-v2-private-badge">
            <LockKeyhole aria-hidden="true" size={13} />
            Private
          </span>
        </div>

        <dl className="messages-v2-details-list">
          <div>
            <dt>Connection</dt>
            <dd>Mutual followers</dd>
          </div>
          <div>
            <dt>Notifications</dt>
            <dd>{selectedConversation.mutedAt ? "Muted" : "On"}</dd>
          </div>
          <div>
            <dt>Shared files</dt>
            <dd>{sharedAttachments.length}</dd>
          </div>
        </dl>

        {selectedConversation.otherUsername ? (
          <Link
            href={`/u/${selectedConversation.otherUsername}`}
            className="messages-v2-profile-link"
          >
            <UserRound aria-hidden="true" size={16} />
            View profile
          </Link>
        ) : null}

        <div className="messages-v2-details-section">
          <div className="messages-v2-details-heading">
            <div>
              <p className="messages-v2-eyebrow">Shared media</p>
              <h3>Recent attachments</h3>
            </div>
            <span>{sharedAttachments.length}</span>
          </div>

          {sharedAttachments.length ? (
            <div className="messages-v2-shared-grid">
              {sharedAttachments.slice(-6).reverse().map((attachment) => (
                <MessageAttachmentCard
                  key={attachment.id}
                  attachment={attachment}
                  mine={attachment.userId === currentUserId}
                  compact
                />
              ))}
            </div>
          ) : (
            <p className="messages-v2-details-empty">No images or PDFs have been shared yet.</p>
          )}
        </div>

        <div className="messages-v2-details-section">
          <p className="messages-v2-eyebrow">Conversation controls</p>
          <div className="messages-v2-details-actions">
            <button
              type="button"
              disabled={Boolean(conversationAction)}
              onClick={() =>
                void runConversationAction(selectedConversation.mutedAt ? "unmute" : "mute")
              }
            >
              {selectedConversation.mutedAt ? (
                <Bell aria-hidden="true" size={17} />
              ) : (
                <BellOff aria-hidden="true" size={17} />
              )}
              <span>
                <strong>{selectedConversation.mutedAt ? "Unmute" : "Mute"}</strong>
                <small>
                  {selectedConversation.mutedAt
                    ? "Resume conversation notifications."
                    : "Silence notifications from this thread."}
                </small>
              </span>
            </button>
            <button
              type="button"
              disabled={Boolean(conversationAction)}
              onClick={() => void runConversationAction("archive")}
            >
              <Archive aria-hidden="true" size={17} />
              <span>
                <strong>Archive</strong>
                <small>Remove this thread from the active inbox.</small>
              </span>
            </button>
            <button
              type="button"
              disabled={Boolean(conversationAction)}
              onClick={() => void runConversationAction("report")}
            >
              <Flag aria-hidden="true" size={17} />
              <span>
                <strong>Report</strong>
                <small>Send the conversation to Loombus safety review.</small>
              </span>
            </button>
            <button
              type="button"
              className="is-danger"
              disabled={Boolean(conversationAction)}
              onClick={() => void runConversationAction("delete")}
            >
              <Trash2 aria-hidden="true" size={17} />
              <span>
                <strong>Delete from inbox</strong>
                <small>This removes the conversation only for you.</small>
              </span>
            </button>
          </div>
        </div>
      </section>
    );
  };

  return (
    <main className="messages-v2-page">
      <header className="messages-v2-page-header">
        <div>
          <p className="messages-v2-eyebrow">Private communication</p>
          <h1>Messages</h1>
          <p>Focused conversations between mutual followers, away from the public thread.</p>
        </div>
        <button type="button" className="messages-v2-new-button" onClick={openNewMessage}>
          <SquarePen aria-hidden="true" size={17} />
          New message
        </button>
      </header>

      <MessagesInlineNotice
        tone={noticeTone}
        onDismiss={() => showNotice("", "neutral")}
      >
        {notice}
      </MessagesInlineNotice>

      <div className="messages-v2-workspace">
        <aside
          className={`messages-v2-inbox-panel${mobileThreadOpen ? " is-mobile-hidden" : ""}`}
          aria-label="Message inbox"
        >
          <div className="messages-v2-inbox-header">
            <div>
              <p className="messages-v2-eyebrow">Inbox</p>
              <h2>Conversations</h2>
            </div>
            <button
              type="button"
              className="messages-v2-icon-button"
              onClick={openNewMessage}
              aria-label="Start a new message"
            >
              <SquarePen aria-hidden="true" size={17} />
            </button>
          </div>

          <label className="messages-v2-search-field">
            <Search aria-hidden="true" size={16} />
            <input
              value={conversationSearch}
              onChange={(event) => setConversationSearch(event.target.value)}
              placeholder="Search conversations"
            />
            {conversationSearch ? (
              <button
                type="button"
                onClick={() => setConversationSearch("")}
                aria-label="Clear conversation search"
              >
                <X aria-hidden="true" size={14} />
              </button>
            ) : null}
          </label>

          <div className="messages-v2-filter-row" aria-label="Conversation filters">
            {filters.map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                aria-pressed={conversationFilter === key}
                onClick={() => setConversationFilter(key)}
              >
                {label}
                <span>{count}</span>
              </button>
            ))}
          </div>

          <div className="messages-v2-conversation-list">
            {filteredConversations.length ? (
              filteredConversations.map((conversation) => (
                <ConversationListItem
                  key={conversation.id}
                  conversation={conversation}
                  selected={conversation.id === selectedConversationId}
                  onSelect={() => selectConversation(conversation.id)}
                />
              ))
            ) : conversations.length ? (
              <div className="messages-v2-list-empty">
                <Search aria-hidden="true" size={23} />
                <strong>No matching conversations</strong>
                <p>Try another name, username, preview keyword, or inbox filter.</p>
              </div>
            ) : (
              <div className="messages-v2-list-empty">
                <Inbox aria-hidden="true" size={25} />
                <strong>Your inbox is ready</strong>
                <p>Start a private conversation with a mutual follower.</p>
                <button type="button" onClick={openNewMessage}>
                  Find a connection
                </button>
              </div>
            )}
          </div>

          <PrivateMessagingNote />
        </aside>

        <section
          className={`messages-v2-thread-panel${mobileThreadOpen ? " is-mobile-open" : ""}`}
          aria-label="Selected conversation"
        >
          {selectedConversation ? (
            <>
              <header className="messages-v2-thread-header">
                <button
                  type="button"
                  className="messages-v2-thread-back"
                  onClick={closeMobileThread}
                  aria-label="Back to conversations"
                >
                  <ChevronLeft aria-hidden="true" size={20} />
                </button>

                <ConversationIdentity conversation={selectedConversation} size="sm" />

                <div className="messages-v2-thread-header-actions">
                  <button
                    type="button"
                    className="messages-v2-icon-button"
                    onClick={() => setDetailsOpen(true)}
                    aria-label="Open conversation details"
                  >
                    <Info aria-hidden="true" size={17} />
                  </button>
                  <div className="messages-v2-action-menu-wrap">
                    <button
                      type="button"
                      className="messages-v2-icon-button"
                      aria-label="Conversation actions"
                      aria-expanded={conversationMenuOpen}
                      disabled={Boolean(conversationAction)}
                      onClick={() => setConversationMenuOpen(!conversationMenuOpen)}
                    >
                      {conversationAction ? (
                        <LoaderCircle className="is-spinning" size={17} />
                      ) : (
                        <MoreHorizontal aria-hidden="true" size={18} />
                      )}
                    </button>
                    {conversationMenuOpen ? (
                      <div className="messages-v2-action-menu">
                        <button
                          type="button"
                          onClick={() =>
                            void runConversationAction(
                              selectedConversation.mutedAt ? "unmute" : "mute"
                            )
                          }
                        >
                          {selectedConversation.mutedAt ? (
                            <Bell aria-hidden="true" size={15} />
                          ) : (
                            <BellOff aria-hidden="true" size={15} />
                          )}
                          {selectedConversation.mutedAt ? "Unmute" : "Mute"}
                        </button>
                        <button type="button" onClick={() => void runConversationAction("archive")}>
                          <Archive aria-hidden="true" size={15} />
                          Archive
                        </button>
                        <button type="button" onClick={() => void runConversationAction("report")}>
                          <Flag aria-hidden="true" size={15} />
                          Report
                        </button>
                        <button
                          type="button"
                          className="is-danger"
                          onClick={() => void runConversationAction("delete")}
                        >
                          <Trash2 aria-hidden="true" size={15} />
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </header>

              <div className="messages-v2-thread-context">
                <ShieldCheck aria-hidden="true" size={15} />
                <span>
                  Private conversation with {getConversationName(selectedConversation)}
                </span>
                {selectedConversation.mutedAt ? <strong>Muted</strong> : null}
              </div>

              <div className="messages-v2-thread-scroll">
                {threadLoading ? (
                  <div className="messages-v2-thread-loading">
                    <LoaderCircle className="is-spinning" size={20} />
                    Loading conversation…
                  </div>
                ) : threadMessages.length ? (
                  <div className="messages-v2-message-list">
                    {threadMessages.map((threadMessage, index) => (
                      <div key={threadMessage.id}>
                        {isDifferentMessageDay(threadMessage, threadMessages[index - 1]) ? (
                          <div className="messages-v2-date-divider">
                            <span>{formatMessageDay(threadMessage.createdAt)}</span>
                          </div>
                        ) : null}
                        <MessageBubble
                          message={threadMessage}
                          mine={threadMessage.senderId === currentUserId}
                        />
                      </div>
                    ))}
                    {typingUserName ? (
                      <div className="messages-v2-typing-row">
                        <span className="messages-v2-typing-bubble">
                          <i />
                          <i />
                          <i />
                        </span>
                        <small>{typingUserName} is typing</small>
                      </div>
                    ) : null}
                    <div ref={threadEndRef} />
                  </div>
                ) : (
                  <div className="messages-v2-thread-empty">
                    <MessageCircle aria-hidden="true" size={30} />
                    <p className="messages-v2-eyebrow">New private conversation</p>
                    <h2>Start with something worth answering.</h2>
                    <p>
                      Send the first message to {getConversationName(selectedConversation)}. Keep it
                      clear, useful, and respectful.
                    </p>
                  </div>
                )}
              </div>

              <div className="messages-v2-composer-shell">
                {attachmentFiles.length ? (
                  <div className="messages-v2-selected-attachments">
                    <header>
                      <span>
                        <Paperclip aria-hidden="true" size={14} />
                        {attachmentFiles.length} selected
                      </span>
                      <button type="button" onClick={clearAttachments} disabled={sending}>
                        Clear all
                      </button>
                    </header>
                    <div>
                      {attachmentFiles.map((file) => (
                        <span key={`${file.name}-${file.size}-${file.lastModified}`}>
                          {file.type === "application/pdf" ? (
                            <FileText aria-hidden="true" size={15} />
                          ) : (
                            <ImageIcon aria-hidden="true" size={15} />
                          )}
                          <strong>{file.name}</strong>
                          <small>{formatMessageAttachmentFileSize(file.size)}</small>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {attachmentMessage ? (
                  <p className="messages-v2-attachment-message">{attachmentMessage}</p>
                ) : null}

                <div className="messages-v2-composer">
                  <label className="messages-v2-attach-button" title="Add images or PDFs">
                    <Paperclip aria-hidden="true" size={18} />
                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                      onChange={handleAttachmentSelection}
                      disabled={sending}
                    />
                  </label>
                  <textarea
                    ref={composerRef}
                    value={composerText}
                    onChange={(event) => {
                      setComposerText(event.target.value);
                      sendTypingIndicator();
                    }}
                    onKeyDown={handleComposerKeyDown}
                    placeholder="Write a private message…"
                    rows={1}
                  />
                  <button
                    type="button"
                    className="messages-v2-send-button"
                    disabled={sending || (!composerText.trim() && attachmentFiles.length === 0)}
                    onClick={() => void handleSendMessage()}
                  >
                    {sending ? (
                      <LoaderCircle className="is-spinning" size={17} />
                    ) : (
                      <Send aria-hidden="true" size={17} />
                    )}
                    <span>{sending ? "Sending" : "Send"}</span>
                  </button>
                </div>
                <div className="messages-v2-composer-meta">
                  <AttachmentLimitNote />
                  <span>Enter to send · Shift + Enter for a new line</span>
                </div>
              </div>
            </>
          ) : (
            <div className="messages-v2-no-selection">
              <MessageCircle aria-hidden="true" size={34} />
              <p className="messages-v2-eyebrow">Private messages</p>
              <h2>Choose a conversation.</h2>
              <p>Select a thread from your inbox or start a new message with a mutual follower.</p>
              <button type="button" className="messages-v2-primary-button" onClick={openNewMessage}>
                <SquarePen aria-hidden="true" size={17} />
                New message
              </button>
            </div>
          )}
        </section>

        <aside className="messages-v2-details-rail" aria-label="Conversation details">
          {renderDetails()}
        </aside>
      </div>

      {detailsOpen && selectedConversation ? (
        <div
          className="messages-v2-drawer-backdrop"
          role="presentation"
          onClick={() => setDetailsOpen(false)}
        >
          <div role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            {renderDetails(true)}
          </div>
        </div>
      ) : null}

      {newMessageOpen ? (
        <div className="messages-v2-modal-backdrop" role="presentation" onClick={closeNewMessage}>
          <section
            className="messages-v2-modal messages-v2-new-message-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="messages-new-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <p className="messages-v2-eyebrow">New private conversation</p>
                <h2 id="messages-new-title">Message a mutual follower</h2>
                <p>Search by name or username. Existing threads will reopen instead of duplicating.</p>
              </div>
              <button
                type="button"
                className="messages-v2-icon-button"
                onClick={closeNewMessage}
                aria-label="Close new message"
              >
                <X aria-hidden="true" size={18} />
              </button>
            </header>

            <label className="messages-v2-search-field is-large">
              <Search aria-hidden="true" size={17} />
              <input
                autoFocus
                value={peopleSearchQuery}
                onChange={(event) => setPeopleSearchQuery(event.target.value)}
                placeholder="Search mutual followers"
              />
            </label>

            <div className="messages-v2-person-results">
              {peopleSearchQuery.trim().length < 2 ? (
                <div className="messages-v2-modal-empty">
                  <UserRound aria-hidden="true" size={25} />
                  <p>Enter at least two characters to find someone you mutually follow.</p>
                </div>
              ) : peopleSearchLoading ? (
                <div className="messages-v2-modal-empty">
                  <LoaderCircle className="is-spinning" size={21} />
                  <p>Searching connections…</p>
                </div>
              ) : peopleSearchResults.length ? (
                peopleSearchResults.map((person) => (
                  <PeopleSearchResultCard
                    key={person.id}
                    person={person}
                    working={startingConversation === person.id}
                    onSelect={() => void handleStartConversation(person)}
                  />
                ))
              ) : (
                <div className="messages-v2-modal-empty">
                  <Search aria-hidden="true" size={24} />
                  <p>No mutual followers match that search.</p>
                </div>
              )}
            </div>

            <PrivateMessagingNote />
          </section>
        </div>
      ) : null}

      {reportPanelOpen && selectedConversation ? (
        <div
          className="messages-v2-modal-backdrop"
          role="presentation"
          onClick={() => setReportPanelOpen(false)}
        >
          <section
            className="messages-v2-modal messages-v2-report-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="messages-report-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <p className="messages-v2-eyebrow">Safety review</p>
                <h2 id="messages-report-title">Report this conversation</h2>
                <p>
                  Choose the closest reason. Loombus admins review reports and relevant message
                  context.
                </p>
              </div>
              <button
                type="button"
                className="messages-v2-icon-button"
                onClick={() => setReportPanelOpen(false)}
                aria-label="Close report"
              >
                <X aria-hidden="true" size={18} />
              </button>
            </header>

            <div className="messages-v2-report-reasons">
              {MESSAGE_REPORT_REASONS.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={reportReason === value}
                  onClick={() => setReportReason(value)}
                >
                  {label}
                </button>
              ))}
            </div>

            <label className="messages-v2-report-notes">
              <span>Additional notes <small>Optional</small></span>
              <textarea
                value={reportNotes}
                onChange={(event) => setReportNotes(event.target.value)}
                placeholder="Add anything the safety team should know."
                rows={4}
                maxLength={1000}
              />
            </label>

            <footer>
              <button
                type="button"
                className="messages-v2-secondary-button"
                onClick={() => setReportPanelOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="messages-v2-danger-button"
                disabled={conversationAction === "report"}
                onClick={() =>
                  void runConversationAction("report", {
                    reason: reportReason,
                    notes: reportNotes,
                  })
                }
              >
                {conversationAction === "report" ? (
                  <LoaderCircle className="is-spinning" size={16} />
                ) : (
                  <Flag aria-hidden="true" size={16} />
                )}
                {conversationAction === "report" ? "Submitting" : "Submit report"}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </main>
  );
}
