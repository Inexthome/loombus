"use client";

import Link from "next/link";
import {
  ArrowRight,
  Check,
  CirclePause,
  MoreHorizontal,
  Play,
  Target,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import {
  type DashboardAction,
  type DashboardDiscussion,
  type DashboardMetric,
  type DashboardPurposeGoal,
  type DashboardPurposeGoalStatus,
  type DashboardTopicSignal,
  formatDashboardDate,
  getGoalStatusLabel,
} from "./dashboard-v2-model";

export function DashboardSectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="dashboard-v2-section-heading">
      <div>
        <p className="dashboard-v2-eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {description ? <p className="dashboard-v2-section-description">{description}</p> : null}
      </div>
      {action ? (
        <Link href={action.href} className="dashboard-v2-heading-link">
          {action.label}
          <ArrowRight aria-hidden="true" size={16} />
        </Link>
      ) : null}
    </div>
  );
}

export function DashboardMetricCard({ metric }: { metric: DashboardMetric }) {
  return (
    <Link href={metric.href} className="dashboard-v2-metric-card">
      <p>{metric.label}</p>
      <strong>{metric.value}</strong>
      <span>{metric.description}</span>
      <ArrowRight aria-hidden="true" size={16} />
    </Link>
  );
}

export function DashboardAttentionCard({ item }: { item: DashboardAction }) {
  return (
    <Link href={item.href} className={`dashboard-v2-attention-card is-${item.tone}`}>
      <div>
        <span className="dashboard-v2-attention-tone">{item.tone}</span>
        <h3>{item.title}</h3>
        <p>{item.description}</p>
      </div>
      <span className="dashboard-v2-attention-action">
        {item.action}
        <ArrowRight aria-hidden="true" size={16} />
      </span>
    </Link>
  );
}

export function DashboardQuickAction({
  title,
  description,
  href,
  label,
  icon: Icon,
  stat,
}: {
  title: string;
  description: string;
  href: string;
  label: string;
  icon: LucideIcon;
  stat?: string;
}) {
  return (
    <Link href={href} className="dashboard-v2-quick-card">
      <div className="dashboard-v2-quick-card-topline">
        <span className="dashboard-v2-quick-icon">
          <Icon aria-hidden="true" size={19} />
        </span>
        {stat ? <span className="dashboard-v2-quick-stat">{stat}</span> : null}
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      <span className="dashboard-v2-quick-action">
        {label}
        <ArrowRight aria-hidden="true" size={15} />
      </span>
    </Link>
  );
}

export function DashboardTopicCard({ signal }: { signal: DashboardTopicSignal }) {
  const totalSignal =
    signal.discussions + signal.repliesReceived + signal.savedByReaders + signal.resolved;

  return (
    <Link
      href={`/discussions?topic=${encodeURIComponent(signal.topic)}`}
      className="dashboard-v2-topic-card"
    >
      <div className="dashboard-v2-topic-heading">
        <div>
          <span>Topic signal</span>
          <h3>{signal.topic}</h3>
        </div>
        <strong>{totalSignal}</strong>
      </div>
      <dl>
        <div>
          <dt>Started</dt>
          <dd>{signal.discussions}</dd>
        </div>
        <div>
          <dt>Replies</dt>
          <dd>{signal.repliesReceived}</dd>
        </div>
        <div>
          <dt>Saves</dt>
          <dd>{signal.savedByReaders}</dd>
        </div>
        <div>
          <dt>Resolved</dt>
          <dd>{signal.resolved}</dd>
        </div>
      </dl>
    </Link>
  );
}

export function DashboardDiscussionCard({ discussion }: { discussion: DashboardDiscussion }) {
  const resolved = discussion.discussion_status === "resolved";

  return (
    <Link href={`/discussions/${discussion.id}`} className="dashboard-v2-discussion-card">
      <div className="dashboard-v2-discussion-topline">
        <span>{discussion.topic?.trim() || "Discussion"}</span>
        <span className={resolved ? "is-resolved" : ""}>{resolved ? "Resolved" : "Open"}</span>
      </div>
      <h3>{discussion.title}</h3>
      <p>{formatDashboardDate(discussion.created_at)}</p>
      <ArrowRight aria-hidden="true" size={16} />
    </Link>
  );
}

export function DashboardGoalCard({
  goal,
  working,
  onStatusChange,
  onDelete,
}: {
  goal: DashboardPurposeGoal;
  working: boolean;
  onStatusChange: (goalId: string, status: DashboardPurposeGoalStatus) => void;
  onDelete: (goalId: string) => void;
}) {
  const nextStatus: DashboardPurposeGoalStatus =
    goal.status === "active" ? "paused" : goal.status === "paused" ? "active" : "active";

  return (
    <article className={`dashboard-v2-goal-card is-${goal.status}`}>
      <div className="dashboard-v2-goal-topline">
        <span className="dashboard-v2-goal-icon">
          <Target aria-hidden="true" size={18} />
        </span>
        <span className="dashboard-v2-goal-status">
          {goal.status === "completed" ? <Check aria-hidden="true" size={13} /> : null}
          {getGoalStatusLabel(goal.status)}
        </span>
      </div>
      <h3>{goal.title}</h3>
      {goal.purpose_lane ? <p className="dashboard-v2-goal-lane">{goal.purpose_lane}</p> : null}
      {goal.private_note ? <p className="dashboard-v2-goal-note">{goal.private_note}</p> : null}
      <p className="dashboard-v2-goal-date">Updated {formatDashboardDate(goal.updated_at)}</p>
      <div className="dashboard-v2-goal-actions">
        {goal.status !== "completed" ? (
          <button
            type="button"
            disabled={working}
            onClick={() => onStatusChange(goal.id, nextStatus)}
          >
            {goal.status === "active" ? (
              <CirclePause aria-hidden="true" size={15} />
            ) : (
              <Play aria-hidden="true" size={15} />
            )}
            {goal.status === "active" ? "Pause" : "Resume"}
          </button>
        ) : (
          <button
            type="button"
            disabled={working}
            onClick={() => onStatusChange(goal.id, "active")}
          >
            <Play aria-hidden="true" size={15} />
            Reopen
          </button>
        )}
        {goal.status !== "completed" ? (
          <button
            type="button"
            disabled={working}
            onClick={() => onStatusChange(goal.id, "completed")}
          >
            <Check aria-hidden="true" size={15} />
            Complete
          </button>
        ) : null}
        <button
          type="button"
          disabled={working}
          onClick={() => onDelete(goal.id)}
          className="is-danger"
          aria-label={`Delete ${goal.title}`}
        >
          <Trash2 aria-hidden="true" size={15} />
          Delete
        </button>
      </div>
    </article>
  );
}

export function DashboardEmptyState({
  icon: Icon = MoreHorizontal,
  title,
  description,
  href,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  href: string;
  action: string;
}) {
  return (
    <div className="dashboard-v2-empty-state">
      <span>
        <Icon aria-hidden="true" size={20} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      <Link href={href}>
        {action}
        <ArrowRight aria-hidden="true" size={15} />
      </Link>
    </div>
  );
}
