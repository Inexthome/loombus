"use client";

import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  Building2,
  CalendarDays,
  Check,
  FileText,
  GraduationCap,
  Home,
  LifeBuoy,
  Lock,
  MessageCircle,
  ShieldCheck,
  Store,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  type RoomModel,
  ROOM_WORKSPACE_BLUEPRINT,
} from "./rooms-v2-model";

const ROOM_MODEL_ICONS: Record<RoomModel["id"], LucideIcon> = {
  "business-team": Building2,
  residents: Home,
  classroom: GraduationCap,
  "customer-support": Store,
  community: Users,
};

const WORKSPACE_ICONS: Record<(typeof ROOM_WORKSPACE_BLUEPRINT)[number]["id"], LucideIcon> = {
  discussions: MessageCircle,
  announcements: BellRing,
  calendar: CalendarDays,
  library: FileText,
  members: ShieldCheck,
};

export function RoomsSectionHeading({
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
    <div className="rooms-v2-section-heading">
      <div>
        <p className="rooms-v2-eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {description ? <p className="rooms-v2-section-description">{description}</p> : null}
      </div>
      {action ? (
        <Link href={action.href} className="rooms-v2-heading-link">
          {action.label}
          <ArrowRight aria-hidden="true" size={16} />
        </Link>
      ) : null}
    </div>
  );
}

export function RoomModelCard({
  model,
  selected = false,
  onSelect,
}: {
  model: RoomModel;
  selected?: boolean;
  onSelect?: (model: RoomModel) => void;
}) {
  const Icon = ROOM_MODEL_ICONS[model.id];
  const content = (
    <>
      <div className="rooms-v2-model-topline">
        <span className="rooms-v2-model-icon">
          <Icon aria-hidden="true" size={21} />
        </span>
        <span className="rooms-v2-model-category">{model.category}</span>
        {selected ? (
          <span className="rooms-v2-selected-mark">
            <Check aria-hidden="true" size={13} />
            Selected
          </span>
        ) : null}
      </div>
      <h3>{model.title}</h3>
      <p>{model.description}</p>
      <dl>
        <div>
          <dt>Designed for</dt>
          <dd>{model.audience}</dd>
        </div>
        <div>
          <dt>Calendar</dt>
          <dd>{model.calendarUse}</dd>
        </div>
        <div>
          <dt>Default access</dt>
          <dd>{model.defaultAccessSummary}</dd>
        </div>
        <div>
          <dt>Workflow</dt>
          <dd>{model.workflowSummary}</dd>
        </div>
      </dl>
      <div className="rooms-v2-model-examples">
        {model.examples.map((example) => (
          <span key={example}>{example}</span>
        ))}
      </div>
    </>
  );

  if (onSelect) {
    return (
      <button
        type="button"
        onClick={() => onSelect(model)}
        aria-pressed={selected}
        className={`rooms-v2-model-card${selected ? " is-selected" : ""}`}
      >
        {content}
      </button>
    );
  }

  return <article className="rooms-v2-model-card">{content}</article>;
}

export function RoomWorkspaceBlueprint() {
  return (
    <div className="rooms-v2-workspace-grid">
      {ROOM_WORKSPACE_BLUEPRINT.map((item) => {
        const Icon = WORKSPACE_ICONS[item.id];
        return (
          <article key={item.id} className="rooms-v2-capability-card">
            <span>
              <Icon aria-hidden="true" size={20} />
            </span>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
          </article>
        );
      })}
    </div>
  );
}

export function RoomsHonestEmptyState() {
  return (
    <section className="rooms-v2-empty-state">
      <div className="rooms-v2-empty-icon">
        <Lock aria-hidden="true" size={24} />
      </div>
      <div className="rooms-v2-empty-copy">
        <p className="rooms-v2-eyebrow">No connected rooms</p>
        <h2>Your private room list is empty.</h2>
        <p>
          The current production repository does not yet expose room records, memberships,
          invitations, events, or room content. This page therefore does not manufacture rooms or
          show sample activity as if it were real.
        </p>
      </div>
      <div className="rooms-v2-empty-actions">
        <Link href="/rooms/new" className="rooms-v2-button rooms-v2-button-primary">
          Plan a room
          <ArrowRight aria-hidden="true" size={16} />
        </Link>
        <Link href="/support" className="rooms-v2-button rooms-v2-button-quiet">
          <LifeBuoy aria-hidden="true" size={16} />
          Contact support
        </Link>
      </div>
    </section>
  );
}
