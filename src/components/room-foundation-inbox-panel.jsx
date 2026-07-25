"use client";

import { Bell, CheckCheck, Loader2, SlidersHorizontal } from "lucide-react";
import { RoomCorePagination } from "@/components/room-core-pagination";
import { actorName, formatDate } from "@/components/room-foundation-types";

export function RoomFoundationInboxPanel({
  inbox,
  summary,
  loadingPanel,
  working,
  resultsHeadingRef,
  postAction,
  loadInbox,
  openModule,
}) {
  const preferences = inbox?.preferences ?? summary?.preferences;
  const unreadCount = summary?.unreadCount ?? 0;
  const events = inbox?.events ?? [];
  return (
    <>
      <div className="room-foundation-inbox-controls">
        <div>
          <SlidersHorizontal aria-hidden="true" />
          <label>
            <input
              type="checkbox"
              checked={Boolean(preferences?.importantOnly)}
              disabled={working}
              onChange={(event) =>
                void postAction("update_preferences", { importantOnly: event.target.checked })
              }
            />
            <span>Important activity only</span>
          </label>
          <label>
            <input
              type="checkbox"
              checked={Boolean(preferences?.muted)}
              disabled={working}
              onChange={(event) =>
                void postAction("update_preferences", { muted: event.target.checked })
              }
            />
            <span>Mute unread badge</span>
          </label>
        </div>
        <button
          type="button"
          onClick={() => void postAction("mark_read")}
          disabled={working || unreadCount === 0}
        >
          {working ? (
            <Loader2 className="is-spinning" aria-hidden="true" />
          ) : (
            <CheckCheck aria-hidden="true" />
          )}
          Mark all read
        </button>
      </div>

      <div className="room-foundation-events room-core-results-region">
        <h3 ref={resultsHeadingRef} className="room-core-results-heading" tabIndex={-1}>
          Room activity
        </h3>
        {inbox?.eventsCapped ? (
          <p className="room-core-limit-warning" role="status">
            Activity reached its private safety limit. Newer activity is shown first.
          </p>
        ) : null}
        {loadingPanel && !inbox ? (
          <div className="room-foundation-loading" role="status">
            <Loader2 className="is-spinning" aria-hidden="true" />
            Loading Room activity
          </div>
        ) : events.length === 0 ? (
          <div className="room-foundation-empty">
            <Bell aria-hidden="true" />
            <h3>No Room activity yet</h3>
            <p>New discussions, announcements, dates, files, tasks, polls, and membership actions will appear here.</p>
          </div>
        ) : (
          events.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`room-foundation-event${item.importance === "high" ? " is-important" : ""}`}
              onClick={() => openModule(item.moduleKey)}
            >
              <span>
                {item.moduleLabel}
                {item.createdAt ? ` · ${formatDate(item.createdAt)}` : ""}
              </span>
              <strong>{item.title}</strong>
              {item.summary ? <p>{item.summary}</p> : null}
              {actorName(item.actor) ? <small>By {actorName(item.actor)}</small> : null}
            </button>
          ))
        )}
        <RoomCorePagination
          pageInfo={inbox?.pageInfo}
          loading={loadingPanel}
          onPageChange={(page) => void loadInbox(page, true)}
          itemLabel="activity items"
        />
      </div>
    </>
  );
}
