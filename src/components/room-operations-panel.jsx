"use client";

import { Archive, Flag, Gauge, Loader2, Shield, Users } from "lucide-react";
import { useMemo } from "react";
import { Lifecycle, Overview } from "@/components/room-operations-panel-lifecycle";
import { MembersView } from "@/components/room-operations-panel-members";
import { ModerationView } from "@/components/room-operations-panel-moderation";
import { ReportView } from "@/components/room-operations-panel-report";

export function RoomOperationsPanel({
  summary,
  payload,
  activeTab,
  loading,
  working,
  onTabChange,
  onPageChange,
  onAction,
  onExport,
  hideNavigation = false,
}) {
  const access = summary.access;
  const tabs = useMemo(
    () =>
      [
        ["overview", "Overview", Gauge, access.canManage],
        ["report", "Report", Flag, true],
        ["members", "Members", Users, access.canManage],
        ["moderation", "Moderation", Shield, access.canModerate],
        ["lifecycle", "Lifecycle", Archive, access.isOwner],
      ].filter((item) => item[3]),
    [access]
  );
  const selected = activeTab || tabs[0]?.[0];
  const panelId = selected ? `room-operation-panel-${selected}` : undefined;

  return (
    <>
      {!hideNavigation ? (
        <nav className="room-operation-tabs" role="tablist" aria-label="Room Operations sections">
          {tabs.map(([value, label, Icon]) => (
            <button
              type="button"
              key={value}
              role="tab"
              id={`room-operation-tab-${value}`}
              aria-selected={selected === value}
              aria-controls={`room-operation-panel-${value}`}
              tabIndex={0}
              onClick={() => onTabChange(value)}
            >
              <Icon aria-hidden="true" />
              {label}
              {value === "moderation" && summary.pendingReportCount ? (
                <strong>{summary.pendingReportCount}</strong>
              ) : null}
            </button>
          ))}
        </nav>
      ) : null}

      <div
        id={panelId}
        className="room-operation-tabpanel"
        role="tabpanel"
        aria-labelledby={hideNavigation || !selected ? undefined : `room-operation-tab-${selected}`}
        aria-label={hideNavigation && selected ? selected : undefined}
        tabIndex={-1}
      >
        {loading && !payload ? (
          <div className="room-operations-loading" role="status">
            <Loader2 className="is-spinning" aria-hidden="true" />
            Loading {selected || "Room operations"}
          </div>
        ) : null}

        {selected === "overview" && payload ? <Overview payload={payload} /> : null}

        {selected === "report" && payload ? (
          <ReportView
            payload={payload}
            access={access}
            loading={loading}
            working={working}
            onAction={onAction}
            onPageChange={onPageChange}
          />
        ) : null}

        {selected === "members" && payload ? (
          <MembersView
            payload={payload}
            access={access}
            loading={loading}
            working={working}
            onAction={onAction}
            onPageChange={onPageChange}
          />
        ) : null}

        {selected === "moderation" && payload ? (
          <ModerationView
            payload={payload}
            access={access}
            loading={loading}
            working={working}
            onAction={onAction}
            onPageChange={onPageChange}
          />
        ) : null}

        {selected === "lifecycle" && payload ? (
          <Lifecycle
            payload={payload}
            working={working}
            onAction={onAction}
            onExport={onExport}
          />
        ) : null}
      </div>
    </>
  );
}
