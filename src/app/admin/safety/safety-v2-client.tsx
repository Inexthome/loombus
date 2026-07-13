"use client";

import Link from "next/link";
import {
  AlertOctagon,
  AlertTriangle,
  ArrowLeft,
  Ban,
  Bot,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ExternalLink,
  FileSearch,
  Filter,
  Flame,
  Loader2,
  MessageCircleWarning,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  UserRound,
  UsersRound,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ProfileAvatar, getProfileDisplayName } from "@/components/profile-avatar";
import { supabase } from "@/lib/supabase/client";

type SafetyMetadata = Record<string, unknown> | null;

type SafetyEvent = {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  metadata: SafetyMetadata;
  created_at: string;
  actor_id: string | null;
};

type SafetyMember = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_admin: boolean | null;
  account_status: string | null;
  enforcement_reason: string | null;
  enforcement_note: string | null;
  enforced_at: string | null;
  suspended_until: string | null;
  age_band: string | null;
  teen_safety_mode: boolean;
  guardian_required: boolean;
};

type AccountStatus =
  | "active"
  | "warned"
  | "suspended"
  | "banned"
  | "deactivated"
  | "deletion_requested"
  | "unknown";

type SafetyOutcome = "blocked" | "warned";
type SafetyStage = "rule_based" | "ai_assisted" | "unknown";
type PatternSeverity = "watch" | "elevated" | "high";
type AccountEnforcementAction = "warn_user" | "suspend_user" | "ban_user";

type PatternSignal = {
  key: string;
  label: string;
  description: string;
  count: number;
  severity: PatternSeverity;
  Icon: LucideIcon;
};

type RepeatSignal = {
  actorId: string;
  total: number;
  blocked: number;
  warned: number;
  latestAt: string | null;
  latestEvent: SafetyEvent | null;
  categories: string[];
  surfaces: string[];
  severity: PatternSeverity;
};

type MetricDefinition = {
  label: string;
  value: number;
  detail: string;
  Icon: LucideIcon;
  priority?: boolean;
};

function getMetadataString(metadata: SafetyMetadata, key: string) {
  const value = metadata?.[key];

  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function normalizeOutcome(action: string): SafetyOutcome {
  return action === "content_safety.blocked" ? "blocked" : "warned";
}

function normalizeStage(metadata: SafetyMetadata): SafetyStage {
  const stage = getMetadataString(metadata, "stage");
  if (stage === "rule_based" || stage === "ai_assisted") return stage;
  return "unknown";
}

function normalizeAccountStatus(value: string | null | undefined): AccountStatus {
  if (
    value === "active" ||
    value === "warned" ||
    value === "suspended" ||
    value === "banned" ||
    value === "deactivated" ||
    value === "deletion_requested"
  ) {
    return value;
  }

  return value ? "unknown" : "active";
}

function accountStatusLabel(status: AccountStatus) {
  if (status === "deletion_requested") return "Deletion requested";
  if (status === "unknown") return "Needs review";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function accountTone(status: AccountStatus) {
  if (status === "active") return "success";
  if (status === "warned") return "warning";
  if (status === "suspended") return "attention";
  if (status === "banned") return "danger";
  if (status === "deletion_requested") return "violet";
  return "muted";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Not recorded";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function formatAgeBand(value: string | null | undefined) {
  if (value === "under_13") return "Under 13";
  if (value === "teen") return "Teen";
  if (value === "adult") return "Adult";
  return "Unknown";
}

function getSurfaceLabel(targetType: string) {
  if (targetType === "private_message") return "Private messages";
  if (targetType === "discussion") return "Discussions";
  if (targetType === "reply") return "Replies";
  if (targetType === "profile") return "Profiles";
  return targetType || "Content";
}

function getEventTitle(event: SafetyEvent) {
  return getMetadataString(event.metadata, "category") || "Safety review";
}

function getEventMessage(event: SafetyEvent) {
  return getMetadataString(event.metadata, "message");
}

function getEventPreview(event: SafetyEvent) {
  return getMetadataString(event.metadata, "content_preview");
}

function getSearchText(event: SafetyEvent, member: SafetyMember | undefined) {
  return [
    event.id,
    event.action,
    event.target_type,
    event.target_id,
    event.actor_id,
    member?.username,
    member?.full_name,
    member?.account_status,
    JSON.stringify(event.metadata ?? {}),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getPatternPreviewText(event: SafetyEvent) {
  return [getEventTitle(event), getEventMessage(event), getEventPreview(event)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function patternSeverity(count: number): PatternSeverity {
  if (count >= 6) return "high";
  if (count >= 3) return "elevated";
  return "watch";
}

function repeatSeverity(blocked: number, warned: number, total: number): PatternSeverity {
  if (blocked >= 3 || total >= 6) return "high";
  if (blocked >= 2 || warned >= 3 || total >= 4) return "elevated";
  return "watch";
}

function repeatSeverityLabel(severity: PatternSeverity) {
  if (severity === "high") return "Urgent review";
  if (severity === "elevated") return "Elevated review";
  return "Watch";
}

function eventTone(event: SafetyEvent) {
  if (normalizeOutcome(event.action) === "blocked") return "danger";
  if (getMetadataString(event.metadata, "teen_message_involved") === "true") return "attention";
  if (normalizeStage(event.metadata) === "ai_assisted") return "violet";
  return "warning";
}

function eventFocus(event: SafetyEvent, repeatActors: Set<string>) {
  const teen = getMetadataString(event.metadata, "teen_message_involved") === "true";
  const repeat = Boolean(event.actor_id && repeatActors.has(event.actor_id));
  return { teen, repeat };
}

export default function SafetyV2Client() {
  const [events, setEvents] = useState<SafetyEvent[]>([]);
  const [members, setMembers] = useState<Record<string, SafetyMember>>({});
  const [currentAdminId, setCurrentAdminId] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [surfaceFilter, setSurfaceFilter] = useState("all");
  const [focusFilter, setFocusFilter] = useState("all");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [workingAction, setWorkingAction] = useState("");

  const loadSafety = useCallback(async (manualRefresh = false) => {
    if (manualRefresh) setRefreshing(true);
    else setLoading(true);
    setMessage("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        window.location.href = "/login?next=%2Fadmin%2Fsafety";
        return;
      }

      const response = await fetch("/api/admin/safety", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({}));

      if (response.status === 401) {
        window.location.href = "/login?next=%2Fadmin%2Fsafety";
        return;
      }

      if (response.status === 403) {
        setAuthorized(false);
        setAuthChecked(true);
        setEvents([]);
        setMembers({});
        setMessage(result.error ?? "Admin access required.");
        return;
      }

      if (!response.ok) {
        setMessage(result.error ?? "Unable to load safety operations.");
        setAuthChecked(true);
        return;
      }

      const loadedEvents = (result.events ?? []) as SafetyEvent[];
      const memberMap: Record<string, SafetyMember> = {};

      for (const member of (result.members ?? []) as SafetyMember[]) {
        memberMap[member.id] = member;
      }

      setEvents(loadedEvents);
      setMembers(memberMap);
      setCurrentAdminId(result.currentAdminId ?? "");
      setAuthorized(true);
      setAuthChecked(true);

      setSelectedEventId((current) => {
        if (current && loadedEvents.some((event) => event.id === current)) return current;

        const params = new URLSearchParams(window.location.search);
        const requested = (params.get("event") ?? params.get("search") ?? "")
          .trim()
          .toLowerCase();

        if (requested) {
          const match = loadedEvents.find((event) => {
            const member = event.actor_id ? memberMap[event.actor_id] : undefined;
            return getSearchText(event, member).includes(requested);
          });
          if (match) return match.id;
        }

        return loadedEvents[0]?.id ?? null;
      });
    } catch {
      setMessage("Unable to load safety operations.");
      setAuthChecked(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadSafety();
  }, [loadSafety]);

  const repeatSignals = useMemo<RepeatSignal[]>(() => {
    const grouped = new Map<
      string,
      {
        total: number;
        blocked: number;
        warned: number;
        latestAt: string | null;
        latestEvent: SafetyEvent | null;
        categories: Set<string>;
        surfaces: Set<string>;
      }
    >();

    for (const event of events) {
      if (!event.actor_id) continue;

      const current = grouped.get(event.actor_id) ?? {
        total: 0,
        blocked: 0,
        warned: 0,
        latestAt: null,
        latestEvent: null,
        categories: new Set<string>(),
        surfaces: new Set<string>(),
      };

      current.total += 1;
      if (normalizeOutcome(event.action) === "blocked") current.blocked += 1;
      else current.warned += 1;

      const category = getEventTitle(event);
      if (category) current.categories.add(category);
      if (event.target_type) current.surfaces.add(event.target_type);

      if (
        !current.latestAt ||
        new Date(event.created_at).getTime() > new Date(current.latestAt).getTime()
      ) {
        current.latestAt = event.created_at;
        current.latestEvent = event;
      }

      grouped.set(event.actor_id, current);
    }

    return [...grouped.entries()]
      .filter(([, group]) => group.total >= 2)
      .map(([actorId, group]) => ({
        actorId,
        total: group.total,
        blocked: group.blocked,
        warned: group.warned,
        latestAt: group.latestAt,
        latestEvent: group.latestEvent,
        categories: [...group.categories].slice(0, 4),
        surfaces: [...group.surfaces].slice(0, 4),
        severity: repeatSeverity(group.blocked, group.warned, group.total),
      }))
      .sort((a, b) => {
        if (b.blocked !== a.blocked) return b.blocked - a.blocked;
        if (b.total !== a.total) return b.total - a.total;
        return new Date(b.latestAt ?? 0).getTime() - new Date(a.latestAt ?? 0).getTime();
      })
      .slice(0, 12);
  }, [events]);

  const repeatActors = useMemo(
    () => new Set(repeatSignals.map((signal) => signal.actorId)),
    [repeatSignals]
  );

  const patternSignals = useMemo<PatternSignal[]>(() => {
    const counts = {
      repeat: repeatSignals.length,
      aiWarnings: events.filter(
        (event) =>
          normalizeOutcome(event.action) === "warned" &&
          normalizeStage(event.metadata) === "ai_assisted"
      ).length,
      teen: events.filter(
        (event) => getMetadataString(event.metadata, "teen_message_involved") === "true"
      ).length,
      provocation: events.filter((event) => {
        const text = getPatternPreviewText(event);
        return text.includes("rage bait") || text.includes("broad shaming");
      }).length,
      spam: events.filter((event) => {
        const text = getPatternPreviewText(event);
        return text.includes("spam") || text.includes("repetition");
      }).length,
      hostile: events.filter((event) => {
        const text = getPatternPreviewText(event);
        return ["hostile", "harassment", "abusive", "personal attack", "degrading"].some(
          (term) => text.includes(term)
        );
      }).length,
      manipulation: events.filter((event) => {
        const text = getPatternPreviewText(event);
        return ["manipulation", "deception", "coordinated", "fake engagement"].some(
          (term) => text.includes(term)
        );
      }).length,
    };

    const signals: PatternSignal[] = [
      {
        key: "repeat",
        label: "Repeat safety events",
        description: "Members appearing multiple times in blocked or warned pre-submit events.",
        count: counts.repeat,
        severity: patternSeverity(counts.repeat),
        Icon: UsersRound,
      },
      {
        key: "aiWarnings",
        label: "AI-assisted warnings",
        description: "AI safety review flagged content that may need human context review.",
        count: counts.aiWarnings,
        severity: patternSeverity(counts.aiWarnings),
        Icon: Bot,
      },
      {
        key: "teen",
        label: "Teen safety events",
        description: "Private-message safety events involving at least one teen-safety account.",
        count: counts.teen,
        severity: patternSeverity(counts.teen),
        Icon: ShieldAlert,
      },
      {
        key: "provocation",
        label: "Provocation or broad shaming",
        description: "Content framed to provoke, shame broadly, or lower discussion quality.",
        count: counts.provocation,
        severity: patternSeverity(counts.provocation),
        Icon: Flame,
      },
      {
        key: "spam",
        label: "Spam-like repetition",
        description: "Repetitive or spam-like submissions caught before publishing.",
        count: counts.spam,
        severity: patternSeverity(counts.spam),
        Icon: MessageCircleWarning,
      },
      {
        key: "hostile",
        label: "Hostile escalation",
        description: "Hostility, harassment, abusive framing, or personal attack signals.",
        count: counts.hostile,
        severity: patternSeverity(counts.hostile),
        Icon: AlertOctagon,
      },
      {
        key: "manipulation",
        label: "Manipulation or deception",
        description: "Signals related to manipulation, deception, coordination, or fake engagement.",
        count: counts.manipulation,
        severity: patternSeverity(counts.manipulation),
        Icon: WandSparkles,
      },
    ];

    return signals.filter((signal) => signal.count > 0).sort((a, b) => b.count - a.count);
  }, [events, repeatSignals]);

  const filteredEvents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return events.filter((event) => {
      const outcome = normalizeOutcome(event.action);
      const stage = normalizeStage(event.metadata);
      const focus = eventFocus(event, repeatActors);
      const member = event.actor_id ? members[event.actor_id] : undefined;

      if (outcomeFilter !== "all" && outcome !== outcomeFilter) return false;
      if (stageFilter !== "all" && stage !== stageFilter) return false;
      if (surfaceFilter !== "all" && event.target_type !== surfaceFilter) return false;
      if (focusFilter === "repeat" && !focus.repeat) return false;
      if (focusFilter === "teen" && !focus.teen) return false;
      if (focusFilter === "urgent") {
        const signal = event.actor_id
          ? repeatSignals.find((item) => item.actorId === event.actor_id)
          : null;
        if (signal?.severity !== "high") return false;
      }
      if (query && !getSearchText(event, member).includes(query)) return false;

      return true;
    });
  }, [
    events,
    focusFilter,
    members,
    outcomeFilter,
    repeatActors,
    repeatSignals,
    searchQuery,
    stageFilter,
    surfaceFilter,
  ]);

  useEffect(() => {
    if (filteredEvents.length === 0) {
      setSelectedEventId(null);
      return;
    }

    if (!selectedEventId || !filteredEvents.some((event) => event.id === selectedEventId)) {
      setSelectedEventId(filteredEvents[0].id);
    }
  }, [filteredEvents, selectedEventId]);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId]
  );
  const selectedMember = selectedEvent?.actor_id ? members[selectedEvent.actor_id] : undefined;
  const selectedRepeatSignal = selectedEvent?.actor_id
    ? repeatSignals.find((signal) => signal.actorId === selectedEvent.actor_id) ?? null
    : null;

  const metrics = useMemo<MetricDefinition[]>(() => {
    const blocked = events.filter((event) => normalizeOutcome(event.action) === "blocked").length;
    const warned = events.length - blocked;
    const teen = events.filter(
      (event) => getMetadataString(event.metadata, "teen_message_involved") === "true"
    ).length;
    const urgent = repeatSignals.filter((signal) => signal.severity === "high").length;

    return [
      {
        label: "Blocked",
        value: blocked,
        detail: "Stopped before publication",
        Icon: Ban,
        priority: true,
      },
      {
        label: "Warned",
        value: warned,
        detail: "User correction requested",
        Icon: TriangleAlert,
      },
      {
        label: "Repeat members",
        value: repeatSignals.length,
        detail: "Two or more safety events",
        Icon: UsersRound,
      },
      {
        label: "Urgent review",
        value: urgent,
        detail: "Highest repeat-risk tier",
        Icon: AlertOctagon,
        priority: urgent > 0,
      },
      {
        label: "Teen safety",
        value: teen,
        detail: "Events with teen context",
        Icon: ShieldAlert,
      },
      {
        label: "AI-assisted",
        value: events.filter((event) => normalizeStage(event.metadata) === "ai_assisted").length,
        detail: "AI review stage",
        Icon: Sparkles,
      },
    ];
  }, [events, repeatSignals]);

  function clearFilters() {
    setSearchQuery("");
    setOutcomeFilter("all");
    setStageFilter("all");
    setSurfaceFilter("all");
    setFocusFilter("all");
  }

  function selectEvent(eventId: string) {
    setSelectedEventId(eventId);
    const url = new URL(window.location.href);
    url.searchParams.set("event", eventId);
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
  }

  function getEnforcementReason(event: SafetyEvent) {
    const category = getEventTitle(event);
    return category
      ? `Pre-submit safety event: ${category}`
      : "Pre-submit safety event reviewed in Safety Operations";
  }

  async function enforceAccount(
    event: SafetyEvent,
    action: AccountEnforcementAction
  ) {
    if (!event.actor_id || workingAction) return;

    if (event.actor_id === currentAdminId) {
      setMessage("You cannot enforce your own Admin account.");
      return;
    }

    const actionLabel =
      action === "warn_user"
        ? "warn this member"
        : action === "suspend_user"
          ? "suspend this member for 7 days"
          : "ban this member";

    if (!window.confirm(`Confirm that you want to ${actionLabel}. This changes account access.`)) {
      return;
    }

    setWorkingAction(`${event.id}:${action}`);
    setMessage("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        window.location.href = "/login?next=%2Fadmin%2Fsafety";
        return;
      }

      const suspendedUntil =
        action === "suspend_user"
          ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          : null;

      const response = await fetch("/api/admin/moderation/actions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action,
          targetUserId: event.actor_id,
          enforcementReason: getEnforcementReason(event),
          enforcementNote: `Action taken from Safety Operations event ${event.id}.`,
          suspendedUntil,
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(result.error ?? "Unable to update account enforcement.");
        return;
      }

      setMembers((current) => {
        const member = current[event.actor_id!];
        if (!member) return current;

        return {
          ...current,
          [event.actor_id!]: {
            ...member,
            account_status: result.accountStatus ?? member.account_status,
            enforcement_reason: result.enforcementReason ?? null,
            enforcement_note: result.enforcementNote ?? null,
            enforced_at: result.enforcedAt ?? null,
            suspended_until: result.suspendedUntil ?? null,
          },
        };
      });

      setMessage(
        action === "warn_user"
          ? "Member warning recorded."
          : action === "suspend_user"
            ? "Member suspended for 7 days."
            : "Member banned."
      );
    } catch {
      setMessage("Unable to update account enforcement.");
    } finally {
      setWorkingAction("");
    }
  }

  if (!authChecked || loading) {
    return (
      <main className="safety-v2-page">
        <div className="safety-v2-shell safety-v2-loading">
          <Loader2 aria-hidden="true" className="safety-v2-spinner" size={24} />
          <span>Loading Safety Operations…</span>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="safety-v2-page">
        <div className="safety-v2-shell">
          <section className="safety-v2-state-card">
            <ShieldAlert aria-hidden="true" size={28} />
            <p className="safety-v2-eyebrow">Admin only</p>
            <h1>Safety Operations is restricted.</h1>
            <p>{message || "An active Admin account is required to review platform safety events."}</p>
            <Link href="/admin">
              <ArrowLeft aria-hidden="true" size={16} />
              Back to Admin
            </Link>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="safety-v2-page">
      <div className="safety-v2-shell">
        <section className="safety-v2-hero">
          <div className="safety-v2-hero-copy">
            <Link href="/admin" className="safety-v2-back-link">
              <ArrowLeft aria-hidden="true" size={15} />
              Admin Operations
            </Link>
            <p className="safety-v2-eyebrow">Trust and safety</p>
            <h1>Safety Operations</h1>
            <p>
              Review pre-submit blocks and warnings, identify repeated patterns, and apply
              account enforcement only after human context review.
            </p>
          </div>

          <div className="safety-v2-hero-actions">
            <button type="button" onClick={() => void loadSafety(true)} disabled={refreshing}>
              <RefreshCw
                aria-hidden="true"
                size={16}
                className={refreshing ? "safety-v2-spin" : ""}
              />
              {refreshing ? "Refreshing" : "Refresh queue"}
            </button>
            <div>
              <Link href="/admin/reports">Open Reports</Link>
              <Link href="/admin/audit">Open Audit</Link>
            </div>
          </div>
        </section>

        <section className="safety-v2-metrics" aria-label="Safety metrics">
          {metrics.map(({ label, value, detail, Icon, priority }) => (
            <article key={label} className={`safety-v2-metric${priority ? " is-priority" : ""}`}>
              <Icon aria-hidden="true" size={17} />
              <span>{label}</span>
              <strong>{value}</strong>
              <p>{detail}</p>
            </article>
          ))}
        </section>

        {message ? (
          <div className="safety-v2-notice" role="status">
            <AlertTriangle aria-hidden="true" size={17} />
            <span>{message}</span>
            <button type="button" onClick={() => setMessage("")} aria-label="Dismiss message">
              ×
            </button>
          </div>
        ) : null}

        <section className="safety-v2-toolbar">
          <label className="safety-v2-search">
            <Search aria-hidden="true" size={17} />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search member, category, preview, event ID…"
            />
          </label>

          <div className="safety-v2-selects">
            <label>
              <span>Outcome</span>
              <select value={outcomeFilter} onChange={(event) => setOutcomeFilter(event.target.value)}>
                <option value="all">All outcomes</option>
                <option value="blocked">Blocked</option>
                <option value="warned">Warned</option>
              </select>
            </label>
            <label>
              <span>Stage</span>
              <select value={stageFilter} onChange={(event) => setStageFilter(event.target.value)}>
                <option value="all">All stages</option>
                <option value="rule_based">Rule-based</option>
                <option value="ai_assisted">AI-assisted</option>
                <option value="unknown">Unspecified</option>
              </select>
            </label>
            <label>
              <span>Surface</span>
              <select value={surfaceFilter} onChange={(event) => setSurfaceFilter(event.target.value)}>
                <option value="all">All surfaces</option>
                <option value="discussion">Discussions</option>
                <option value="reply">Replies</option>
                <option value="private_message">Private messages</option>
                <option value="profile">Profiles</option>
              </select>
            </label>
            <label>
              <span>Review focus</span>
              <select value={focusFilter} onChange={(event) => setFocusFilter(event.target.value)}>
                <option value="all">All events</option>
                <option value="repeat">Repeat members</option>
                <option value="urgent">Urgent repeat risk</option>
                <option value="teen">Teen safety</option>
              </select>
            </label>
            <button type="button" onClick={clearFilters} className="safety-v2-clear-button">
              <RotateCcw aria-hidden="true" size={15} />
              Clear
            </button>
          </div>
        </section>

        <section className="safety-v2-workspace">
          <aside className="safety-v2-queue">
            <div className="safety-v2-queue-heading">
              <div>
                <p className="safety-v2-eyebrow">Event queue</p>
                <h2>{filteredEvents.length} safety events</h2>
              </div>
              <Filter aria-hidden="true" size={18} />
            </div>

            {filteredEvents.length ? (
              <div className="safety-v2-queue-list">
                {filteredEvents.map((event) => {
                  const member = event.actor_id ? members[event.actor_id] : undefined;
                  const outcome = normalizeOutcome(event.action);
                  const focus = eventFocus(event, repeatActors);
                  const selected = event.id === selectedEventId;
                  const preview = getEventPreview(event) || getEventMessage(event);

                  return (
                    <button
                      key={event.id}
                      type="button"
                      className="safety-v2-queue-item"
                      data-selected={selected ? "true" : "false"}
                      onClick={() => selectEvent(event.id)}
                    >
                      <div className="safety-v2-queue-item-topline">
                        <span className={`safety-v2-pill is-${eventTone(event)}`}>{outcome}</span>
                        <span>{formatDateTime(event.created_at)}</span>
                      </div>
                      <h3>{getEventTitle(event)}</h3>
                      <p>{preview || "No content preview was recorded for this event."}</p>
                      <div className="safety-v2-queue-member">
                        <ProfileAvatar profile={member} size="sm" />
                        <span>{getProfileDisplayName(member, "Unknown member")}</span>
                        {focus.repeat ? <strong>Repeat</strong> : null}
                        {focus.teen ? <strong>Teen</strong> : null}
                        <ChevronRight aria-hidden="true" size={16} />
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="safety-v2-empty-queue">
                <FileSearch aria-hidden="true" size={24} />
                <h3>No events match.</h3>
                <p>Clear or broaden the filters to continue reviewing the queue.</p>
                <button type="button" onClick={clearFilters}>Clear filters</button>
              </div>
            )}
          </aside>

          <section className="safety-v2-detail">
            {selectedEvent ? (
              <>
                <header className="safety-v2-detail-header">
                  <div>
                    <div className="safety-v2-detail-badges">
                      <span className={`safety-v2-pill is-${eventTone(selectedEvent)}`}>
                        {normalizeOutcome(selectedEvent.action)}
                      </span>
                      <span className="safety-v2-pill is-muted">
                        {getSurfaceLabel(selectedEvent.target_type)}
                      </span>
                      <span className="safety-v2-pill is-muted">
                        {normalizeStage(selectedEvent.metadata).replaceAll("_", " ")}
                      </span>
                    </div>
                    <p className="safety-v2-eyebrow">Selected event</p>
                    <h2>{getEventTitle(selectedEvent)}</h2>
                    <p>{formatDateTime(selectedEvent.created_at)}</p>
                  </div>
                  <Link href={`/admin/audit?search=${encodeURIComponent(selectedEvent.id)}`}>
                    Audit context
                    <ExternalLink aria-hidden="true" size={14} />
                  </Link>
                </header>

                <div className="safety-v2-detail-body">
                  <section className="safety-v2-member-card">
                    <div className="safety-v2-member-identity">
                      <ProfileAvatar profile={selectedMember} size="xl" />
                      <div>
                        <p className="safety-v2-eyebrow">Member context</p>
                        <h3>{getProfileDisplayName(selectedMember, "Unknown member")}</h3>
                        <p>
                          {selectedMember?.username
                            ? `@${selectedMember.username}`
                            : selectedEvent.actor_id || "No actor recorded"}
                        </p>
                      </div>
                    </div>

                    {selectedMember ? (
                      <div className="safety-v2-member-badges">
                        <span
                          className={`safety-v2-pill is-${accountTone(
                            normalizeAccountStatus(selectedMember.account_status)
                          )}`}
                        >
                          {accountStatusLabel(normalizeAccountStatus(selectedMember.account_status))}
                        </span>
                        <span className="safety-v2-pill is-muted">
                          Age: {formatAgeBand(selectedMember.age_band)}
                        </span>
                        {selectedMember.teen_safety_mode ? (
                          <span className="safety-v2-pill is-attention">Teen Safety</span>
                        ) : null}
                        {selectedMember.guardian_required ? (
                          <span className="safety-v2-pill is-danger">Guardian required</span>
                        ) : null}
                        {selectedMember.is_admin ? (
                          <span className="safety-v2-pill is-violet">Admin</span>
                        ) : null}
                      </div>
                    ) : null}
                  </section>

                  {selectedRepeatSignal ? (
                    <section className={`safety-v2-repeat-summary is-${selectedRepeatSignal.severity}`}>
                      <AlertOctagon aria-hidden="true" size={20} />
                      <div>
                        <p className="safety-v2-eyebrow">Repeat-member signal</p>
                        <h3>{repeatSeverityLabel(selectedRepeatSignal.severity)}</h3>
                        <p>
                          {selectedRepeatSignal.total} total events, {selectedRepeatSignal.blocked} blocked,
                          and {selectedRepeatSignal.warned} warned in the current 250-event window.
                        </p>
                      </div>
                    </section>
                  ) : null}

                  {getEventMessage(selectedEvent) ? (
                    <section className="safety-v2-section-card">
                      <p className="safety-v2-eyebrow">Safety explanation</p>
                      <p>{getEventMessage(selectedEvent)}</p>
                    </section>
                  ) : null}

                  {getEventPreview(selectedEvent) ? (
                    <section className="safety-v2-section-card">
                      <p className="safety-v2-eyebrow">Recorded short preview</p>
                      <blockquote>{getEventPreview(selectedEvent)}</blockquote>
                    </section>
                  ) : null}

                  <section className="safety-v2-info-grid">
                    <Info label="Event ID" value={selectedEvent.id} />
                    <Info label="Target ID" value={selectedEvent.target_id || "Not recorded"} />
                    <Info
                      label="Stage"
                      value={normalizeStage(selectedEvent.metadata).replaceAll("_", " ")}
                    />
                    <Info
                      label="Outcome"
                      value={getMetadataString(selectedEvent.metadata, "outcome") || normalizeOutcome(selectedEvent.action)}
                    />
                    <Info
                      label="Provider"
                      value={getMetadataString(selectedEvent.metadata, "provider") || "Rule-based"}
                    />
                    <Info
                      label="Model"
                      value={getMetadataString(selectedEvent.metadata, "model_name") || "Not recorded"}
                    />
                    <Info
                      label="Content length"
                      value={getMetadataString(selectedEvent.metadata, "content_length") || "Not recorded"}
                    />
                    <Info
                      label="Teen context"
                      value={
                        getMetadataString(selectedEvent.metadata, "teen_message_involved") === "true"
                          ? `Sender ${getMetadataString(selectedEvent.metadata, "sender_age_band") || "unknown"}; recipient ${getMetadataString(selectedEvent.metadata, "recipient_age_band") || "unknown"}`
                          : "No teen context recorded"
                      }
                    />
                  </section>

                  {selectedMember ? (
                    <section className="safety-v2-section-card">
                      <div className="safety-v2-section-heading">
                        <div>
                          <p className="safety-v2-eyebrow">Account standing</p>
                          <h3>Current enforcement context</h3>
                        </div>
                        <Link href={`/admin/users?member=${encodeURIComponent(selectedMember.id)}`}>
                          Member Operations
                          <ExternalLink aria-hidden="true" size={14} />
                        </Link>
                      </div>
                      <div className="safety-v2-info-grid is-compact">
                        <Info label="Status" value={accountStatusLabel(normalizeAccountStatus(selectedMember.account_status))} />
                        <Info label="Reason" value={selectedMember.enforcement_reason || "No enforcement reason"} />
                        <Info label="Enforced at" value={formatDateTime(selectedMember.enforced_at)} />
                        <Info label="Suspended until" value={formatDateTime(selectedMember.suspended_until)} />
                      </div>
                      {selectedMember.enforcement_note ? (
                        <p className="safety-v2-internal-note">{selectedMember.enforcement_note}</p>
                      ) : null}
                    </section>
                  ) : null}

                  {selectedEvent.actor_id ? (
                    <section className="safety-v2-action-card">
                      <div>
                        <p className="safety-v2-eyebrow">Human enforcement decision</p>
                        <h3>Apply an account action only after reviewing context.</h3>
                        <p>
                          Safety signals are not automatic findings. These actions use the existing
                          moderation endpoint, audit logging, and member notification behavior.
                        </p>
                      </div>
                      <div className="safety-v2-action-buttons">
                        <button
                          type="button"
                          onClick={() => void enforceAccount(selectedEvent, "warn_user")}
                          disabled={Boolean(workingAction) || selectedEvent.actor_id === currentAdminId}
                        >
                          <TriangleAlert aria-hidden="true" size={16} />
                          {workingAction === `${selectedEvent.id}:warn_user` ? "Working" : "Warn member"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void enforceAccount(selectedEvent, "suspend_user")}
                          disabled={Boolean(workingAction) || selectedEvent.actor_id === currentAdminId}
                          className="is-warning"
                        >
                          <Clock3 aria-hidden="true" size={16} />
                          {workingAction === `${selectedEvent.id}:suspend_user` ? "Working" : "Suspend 7 days"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void enforceAccount(selectedEvent, "ban_user")}
                          disabled={Boolean(workingAction) || selectedEvent.actor_id === currentAdminId}
                          className="is-danger"
                        >
                          <Ban aria-hidden="true" size={16} />
                          {workingAction === `${selectedEvent.id}:ban_user` ? "Working" : "Ban member"}
                        </button>
                      </div>
                    </section>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="safety-v2-empty-detail">
                <ShieldCheck aria-hidden="true" size={30} />
                <h2>{events.length ? "Select a safety event." : "No safety events yet."}</h2>
                <p>
                  {events.length
                    ? "Choose an item from the queue to review its member, signal, and enforcement context."
                    : "Blocked and warned pre-submit events will appear here when recorded."}
                </p>
              </div>
            )}
          </section>
        </section>

        <section className="safety-v2-intelligence">
          <div className="safety-v2-section-heading">
            <div>
              <p className="safety-v2-eyebrow">Pattern intelligence</p>
              <h2>Signals across the current event window</h2>
              <p>
                Internal review indicators only. They do not label members publicly or trigger
                automatic enforcement.
              </p>
            </div>
          </div>

          {patternSignals.length ? (
            <div className="safety-v2-pattern-grid">
              {patternSignals.map(({ key, label, description, count, severity, Icon }) => (
                <article key={key} className={`safety-v2-pattern-card is-${severity}`}>
                  <Icon aria-hidden="true" size={19} />
                  <div>
                    <span>{count}</span>
                    <h3>{label}</h3>
                    <p>{description}</p>
                    <strong>{severity} signal</strong>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="safety-v2-inline-empty">
              <CheckCircle2 aria-hidden="true" size={20} />
              No pattern signals are visible in the current safety-event window.
            </div>
          )}
        </section>

        <section className="safety-v2-repeat-section">
          <div className="safety-v2-section-heading">
            <div>
              <p className="safety-v2-eyebrow">Repeat-member review</p>
              <h2>Members with multiple safety events</h2>
              <p>Use event history as a review signal. Confirm the underlying context before acting.</p>
            </div>
          </div>

          {repeatSignals.length ? (
            <div className="safety-v2-repeat-grid">
              {repeatSignals.map((signal) => {
                const member = members[signal.actorId];
                return (
                  <article key={signal.actorId} className={`safety-v2-repeat-card is-${signal.severity}`}>
                    <div className="safety-v2-repeat-card-head">
                      <ProfileAvatar profile={member} size="md" />
                      <div>
                        <h3>{getProfileDisplayName(member, "Unknown member")}</h3>
                        <p>{member?.username ? `@${member.username}` : signal.actorId}</p>
                      </div>
                      <span>{repeatSeverityLabel(signal.severity)}</span>
                    </div>
                    <div className="safety-v2-repeat-counts">
                      <Info label="Total" value={String(signal.total)} />
                      <Info label="Blocked" value={String(signal.blocked)} />
                      <Info label="Warned" value={String(signal.warned)} />
                    </div>
                    <div className="safety-v2-tags">
                      {signal.categories.map((category) => <span key={category}>{category}</span>)}
                      {signal.surfaces.map((surface) => (
                        <span key={surface}>{getSurfaceLabel(surface)}</span>
                      ))}
                    </div>
                    <p className="safety-v2-repeat-latest">Latest: {formatDateTime(signal.latestAt)}</p>
                    <div className="safety-v2-repeat-actions">
                      {signal.latestEvent ? (
                        <button type="button" onClick={() => selectEvent(signal.latestEvent!.id)}>
                          Review latest event
                          <ChevronRight aria-hidden="true" size={14} />
                        </button>
                      ) : null}
                      <Link href={`/admin/users?member=${encodeURIComponent(signal.actorId)}`}>
                        Review member
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="safety-v2-inline-empty">
              <CheckCircle2 aria-hidden="true" size={20} />
              No member appears more than once in the current safety-event window.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="safety-v2-info">
      <span>{label}</span>
      <p>{value}</p>
    </div>
  );
}
