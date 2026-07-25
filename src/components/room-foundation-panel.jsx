"use client";

import { Bell, BellOff, Loader2, Search, X } from "lucide-react";
import { RoomFoundationInboxPanel } from "@/components/room-foundation-inbox-panel";
import { RoomFoundationSearchPanel } from "@/components/room-foundation-search-panel";

export function RoomFoundationPanel(props) {
  const {
    panel,
    summary,
    inbox,
    searchPayload,
    query,
    moduleFilter,
    loadingSummary,
    loadingPanel,
    working,
    notice,
    noticeError,
    headingRef,
    resultsHeadingRef,
    searchInputRef,
    closePanel,
    setQuery,
    setModuleFilter,
    handleSearchSubmit,
    loadSearch,
    loadInbox,
    postAction,
    openModule,
    openPanel,
  } = props;
  const unreadCount = summary?.unreadCount ?? 0;
  const preferences = inbox?.preferences ?? summary?.preferences;
  const badge = unreadCount > 99 || summary?.unreadCapped ? "99+" : String(unreadCount);
  const headingId = `room-foundation-${panel}-heading`;
  const descriptionId = `room-foundation-${panel}-description`;

  return (
    <div className="room-foundation">
      <div className="room-foundation-toolbar">
        <button
          type="button"
          className="room-foundation-search-trigger"
          onClick={(event) => openPanel("search", event.currentTarget)}
          aria-expanded={panel === "search"}
          aria-controls="room-foundation-panel"
        >
          <Search aria-hidden="true" />
          <span>Search this Room</span>
        </button>
        <button
          type="button"
          className="room-foundation-inbox-trigger"
          onClick={(event) => openPanel("inbox", event.currentTarget)}
          aria-expanded={panel === "inbox"}
          aria-controls="room-foundation-panel"
          aria-label={unreadCount ? `Room inbox, ${unreadCount} unread` : "Room inbox, no unread activity"}
        >
          {preferences?.muted ? <BellOff aria-hidden="true" /> : <Bell aria-hidden="true" />}
          <span>Room Inbox</span>
          {unreadCount > 0 ? <strong>{badge}</strong> : null}
          {loadingSummary ? <Loader2 className="is-spinning" aria-hidden="true" /> : null}
        </button>
      </div>

      {panel ? (
        <section
          id="room-foundation-panel"
          className="room-foundation-panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby={headingId}
          aria-describedby={descriptionId}
          aria-busy={loadingPanel}
        >
          <header className="room-foundation-heading">
            <div>
              <p>{summary?.room?.name ?? "Private Room"}</p>
              <h2 id={headingId} ref={headingRef} tabIndex={-1}>
                {panel === "search" ? "Search this Room" : "Room Inbox"}
              </h2>
              <span id={descriptionId}>
                {panel === "search"
                  ? "Find private discussions, dates, announcements, knowledge, files, and operational records."
                  : "Review new Room activity without leaving the private workspace."}
              </span>
            </div>
            <button type="button" className="room-foundation-close" onClick={closePanel} aria-label="Close Room panel">
              <X aria-hidden="true" />
            </button>
          </header>

          {notice ? (
            <div className="room-foundation-notice" role={noticeError ? "alert" : "status"}>
              {notice}
            </div>
          ) : null}

          {panel === "search" ? (
            <RoomFoundationSearchPanel
              query={query}
              moduleFilter={moduleFilter}
              searchPayload={searchPayload}
              loadingPanel={loadingPanel}
              resultsHeadingRef={resultsHeadingRef}
              searchInputRef={searchInputRef}
              setQuery={setQuery}
              setModuleFilter={setModuleFilter}
              handleSearchSubmit={handleSearchSubmit}
              loadSearch={loadSearch}
              openModule={openModule}
            />
          ) : (
            <RoomFoundationInboxPanel
              inbox={inbox}
              summary={summary}
              loadingPanel={loadingPanel}
              working={working}
              resultsHeadingRef={resultsHeadingRef}
              postAction={postAction}
              loadInbox={loadInbox}
              openModule={openModule}
            />
          )}
        </section>
      ) : null}
    </div>
  );
}
