"use client";

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArchiveRestore,
  Bot,
  ChevronRight,
  ClipboardList,
  CreditCard,
  FlaskConical,
  Gauge,
  HeartPulse,
  LifeBuoy,
  ListChecks,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type CountValue = number | null;

type AdminCounts = {
  totalReports: CountValue;
  newReports: CountValue;
  dismissedReports: CountValue;
  actionedReports: CountValue;
  profileReports: CountValue;
  deletedDiscussions: CountValue;
  deletedReplies: CountValue;
  labsRequests: CountValue;
  labsInWorkflow: CountValue;
  supportRequests: CountValue;
  members: CountValue;
};

type AccessState = "checking" | "allowed" | "denied" | "error";

type AdminModule = {
  href: string;
  title: string;
  description: string;
  action: string;
  Icon: LucideIcon;
  countKey?: keyof AdminCounts;
};

type AdminModuleGroup = {
  title: string;
  description: string;
  modules: AdminModule[];
};

type CountResult = {
  count: number | null;
  error: { message: string } | null;
};

const EMPTY_COUNTS: AdminCounts = {
  totalReports: null,
  newReports: null,
  dismissedReports: null,
  actionedReports: null,
  profileReports: null,
  deletedDiscussions: null,
  deletedReplies: null,
  labsRequests: null,
  labsInWorkflow: null,
  supportRequests: null,
  members: null,
};

const MODULE_GROUPS: AdminModuleGroup[] = [
  {
    title: "Moderation & safety",
    description:
      "Review reports, safety signals, soft-deleted content, support requests, and the permanent audit trail.",
    modules: [
      {
        href: "/admin/reports",
        title: "Reports",
        description:
          "Review member-submitted reports for discussions, replies, and profiles, then record the moderation outcome.",
        action: "Open reports",
        Icon: ShieldAlert,
        countKey: "newReports",
      },
      {
        href: "/admin/safety",
        title: "Safety Queue",
        description:
          "Review pre-submit safety blocks and warnings from the existing rule-based and AI-assisted checks.",
        action: "Open safety queue",
        Icon: AlertTriangle,
      },
      {
        href: "/admin/support",
        title: "Support Requests",
        description:
          "Review structured support submissions, update request status, and preserve internal Admin notes.",
        action: "Open support",
        Icon: LifeBuoy,
        countKey: "supportRequests",
      },
      {
        href: "/admin/deleted",
        title: "Deleted Discussions",
        description:
          "Inspect and restore soft-deleted discussions through the existing recovery workflow.",
        action: "Review discussions",
        Icon: ArchiveRestore,
        countKey: "deletedDiscussions",
      },
      {
        href: "/admin/deleted-replies",
        title: "Deleted Replies",
        description:
          "Inspect and restore soft-deleted replies without inventing a separate recovery system.",
        action: "Review replies",
        Icon: ArchiveRestore,
        countKey: "deletedReplies",
      },
      {
        href: "/admin/audit",
        title: "Audit Log",
        description:
          "Review platform activity, moderation actions, actors, targets, and recorded system events.",
        action: "Open audit log",
        Icon: ClipboardList,
      },
    ],
  },
  {
    title: "Members, access & billing",
    description:
      "Use the existing member lookup, AI-entitlement, and billing-diagnostics tools without exposing unsupported account actions.",
    modules: [
      {
        href: "/admin/users",
        title: "Member Lookup",
        description:
          "Search members and review account status, Premium access, and billing-identity presence.",
        action: "Open members",
        Icon: Users,
        countKey: "members",
      },
      {
        href: "/admin/ai-access",
        title: "AI Access",
        description:
          "Manage Premium AI-assisted access and review the entitlement controls already used by Loombus.",
        action: "Open AI access",
        Icon: Bot,
      },
      {
        href: "/admin/billing",
        title: "Billing Diagnostics",
        description:
          "Review Stripe configuration presence, subscription synchronization, and Extra AI Pack fulfillment.",
        action: "Open billing",
        Icon: CreditCard,
      },
    ],
  },
  {
    title: "Product & platform operations",
    description:
      "Review the existing Labs workflow, platform-health diagnostics, Topic Memory coverage, and public-module moderation.",
    modules: [
      {
        href: "/admin/platform",
        title: "Platform Operations",
        description:
          "Review Marketplace, Business Directory, Jobs, Events, Requests, Services, Rooms, and Appointments from one role-protected administrator workspace.",
        action: "Open platform operations",
        Icon: ListChecks,
      },
      {
        href: "/admin/labs",
        title: "Labs Review",
        description:
          "Review feature requests, update their workflow status, preserve Admin notes, and inspect real vote totals.",
        action: "Open Labs review",
        Icon: FlaskConical,
        countKey: "labsInWorkflow",
      },
      {
        href: "/admin/health",
        title: "Platform Health",
        description:
          "Review configuration presence, database visibility, AI failures, reports, and operational warnings.",
        action: "Open health",
        Icon: HeartPulse,
      },
      {
        href: "/admin/topic-memory",
        title: "Topic Memory",
        description:
          "Review recurring topics, Reality Lenses, tags, and AI idea coverage through the current Admin tool.",
        action: "Open Topic Memory",
        Icon: Sparkles,
      },
    ],
  },
];

const PUBLIC_RESOURCES = [
  {
    href: "/support",
    title: "Support Center",
    description: "Review the member-facing help and support entry point.",
  },
  {
    href: "/privacy-security",
    title: "Privacy & Security",
    description: "Review the member-facing privacy and account-security center.",
  },
  {
    href: "/premium",
    title: "Premium & Plans",
    description: "Review current plan presentation and supported billing paths.",
  },
  {
    href: "/labs",
    title: "Loombus Labs",
    description: "Review the public request board and Premium Plus voting experience.",
  },
  {
    href: "/ai-usage",
    title: "AI Usage",
    description: "Review the signed-in AI usage and limit dashboard.",
  },
  {
    href: "/guidelines",
    title: "Guidelines",
    description: "Review the current behavior and discussion-quality standards.",
  },
];

function countValue(result: CountResult): CountValue {
  return result.error ? null : result.count ?? 0;
}

function formatCount(value: CountValue) {
  return value === null ? "—" : value.toLocaleString();
}

function sumCounts(...values: CountValue[]): CountValue {
  if (values.some((value) => value === null)) return null;
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

function MetricCard({
  label,
  value,
  description,
  priority = false,
}: {
  label: string;
  value: CountValue;
  description: string;
  priority?: boolean;
}) {
  return (
    <article className={`admin-ops-metric${priority ? " is-priority" : ""}`}>
      <p>{label}</p>
      <strong>{formatCount(value)}</strong>
      <span>{description}</span>
    </article>
  );
}

function ModuleCard({ module, counts }: { module: AdminModule; counts: AdminCounts }) {
  const count = module.countKey ? counts[module.countKey] : undefined;

  return (
    <Link href={module.href} className="admin-ops-module-card">
      <div className="admin-ops-module-topline">
        <span className="admin-ops-module-icon">
          <module.Icon aria-hidden="true" />
        </span>
        {module.countKey ? (
          <span className="admin-ops-count-badge">{formatCount(count ?? null)}</span>
        ) : null}
      </div>
      <div className="admin-ops-module-copy">
        <h3>{module.title}</h3>
        <p>{module.description}</p>
      </div>
      <span className="admin-ops-module-action">
        {module.action}
        <ChevronRight aria-hidden="true" />
      </span>
    </Link>
  );
}

async function readAdminCounts() {
  const results = await Promise.all([
    supabase.from("reports").select("id", { count: "exact", head: true }),
    supabase
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "new"),
    supabase
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "dismissed"),
    supabase
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "actioned"),
    supabase
      .from("reports")
      .select("id", { count: "exact", head: true })
      .not("reported_profile_id", "is", null),
    supabase
      .from("discussions")
      .select("id", { count: "exact", head: true })
      .not("deleted_at", "is", null),
    supabase
      .from("replies")
      .select("id", { count: "exact", head: true })
      .not("deleted_at", "is", null),
    supabase
      .from("labs_feature_requests")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("labs_feature_requests")
      .select("id", { count: "exact", head: true })
      .in("status", ["submitted", "reviewing", "planned"]),
    supabase
      .from("support_requests")
      .select("id", { count: "exact", head: true })
      .in("status", ["new", "reviewing"]),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
  ]);

  const [
    totalReports,
    newReports,
    dismissedReports,
    actionedReports,
    profileReports,
    deletedDiscussions,
    deletedReplies,
    labsRequests,
    labsInWorkflow,
    supportRequests,
    members,
  ] = results as CountResult[];

  return {
    counts: {
      totalReports: countValue(totalReports),
      newReports: countValue(newReports),
      dismissedReports: countValue(dismissedReports),
      actionedReports: countValue(actionedReports),
      profileReports: countValue(profileReports),
      deletedDiscussions: countValue(deletedDiscussions),
      deletedReplies: countValue(deletedReplies),
      labsRequests: countValue(labsRequests),
      labsInWorkflow: countValue(labsInWorkflow),
      supportRequests: countValue(supportRequests),
      members: countValue(members),
    } satisfies AdminCounts,
    failedQueries: results.filter((result) => result.error).length,
  };
}

export default function AdminOperationsClient() {
  const [accessState, setAccessState] = useState<AccessState>("checking");
  const [counts, setCounts] = useState<AdminCounts>(EMPTY_COUNTS);
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [loadMessage, setLoadMessage] = useState("");
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);

  const refreshCounts = useCallback(async () => {
    setLoadingCounts(true);
    setLoadMessage("");

    try {
      const result = await readAdminCounts();
      setCounts(result.counts);
      setLoadedAt(new Date());
      if (result.failedQueries > 0) {
        setLoadMessage(
          `${result.failedQueries} operational total${result.failedQueries === 1 ? "" : "s"} could not be verified. Unavailable values are shown as a dash.`
        );
      }
    } catch (error) {
      console.error("Unable to load Admin Operations Center counts.", error);
      setLoadMessage(
        "Operational totals could not be refreshed. Existing Admin tools remain available below."
      );
    } finally {
      setLoadingCounts(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadAdminAccess() {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;

        if (!userData.user) {
          window.location.replace("/login?next=/admin");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", userData.user.id)
          .maybeSingle();

        if (profileError) throw profileError;
        if (!mounted) return;

        if (!profile?.is_admin) {
          setAccessState("denied");
          return;
        }

        setAccessState("allowed");
        await refreshCounts();
      } catch (error) {
        console.error("Unable to verify Admin access.", error);
        if (!mounted) return;
        setAccessState("error");
        setLoadMessage(
          "Admin access could not be verified. Refresh the page or open Support if the problem continues."
        );
      }
    }

    void loadAdminAccess();

    return () => {
      mounted = false;
    };
  }, [refreshCounts]);

  const deletedContent = useMemo(
    () => sumCounts(counts.deletedDiscussions, counts.deletedReplies),
    [counts.deletedDiscussions, counts.deletedReplies]
  );

  const activeQueue = useMemo(
    () => sumCounts(counts.newReports, counts.supportRequests, counts.labsInWorkflow),
    [counts.labsInWorkflow, counts.newReports, counts.supportRequests]
  );

  if (accessState === "checking") {
    return (
      <main className="admin-ops-page">
        <section className="admin-ops-state-card" aria-live="polite">
          <span className="admin-ops-state-icon">
            <ShieldCheck aria-hidden="true" />
          </span>
          <p className="admin-ops-eyebrow">Admin Operations Center</p>
          <h1>Verifying Admin access…</h1>
          <p>Loombus is confirming the current account role before loading operational data.</p>
        </section>
      </main>
    );
  }

  if (accessState === "denied") {
    return (
      <main className="admin-ops-page">
        <section className="admin-ops-state-card">
          <span className="admin-ops-state-icon is-warning">
            <ShieldAlert aria-hidden="true" />
          </span>
          <p className="admin-ops-eyebrow">Admin Operations Center</p>
          <h1>Admin access is required.</h1>
          <p>
            This workspace is restricted to accounts with the existing Loombus Admin role. No operational data has been loaded.
          </p>
          <div className="admin-ops-state-actions">
            <Link href="/discussions" className="admin-ops-primary-action">
              Return to Loombus
            </Link>
            <Link href="/support" className="admin-ops-secondary-action">
              Open Support
            </Link>
          </div>
        </section>
      </main>
    );
  }

  if (accessState === "error") {
    return (
      <main className="admin-ops-page">
        <section className="admin-ops-state-card">
          <span className="admin-ops-state-icon is-warning">
            <AlertTriangle aria-hidden="true" />
          </span>
          <p className="admin-ops-eyebrow">Admin Operations Center</p>
          <h1>Access could not be verified.</h1>
          <p>{loadMessage}</p>
          <div className="admin-ops-state-actions">
            <button
              type="button"
              className="admin-ops-primary-action"
              onClick={() => window.location.reload()}
            >
              Reload page
            </button>
            <Link href="/support" className="admin-ops-secondary-action">
              Open Support
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-ops-page">
      <div className="admin-ops-shell">
        <header className="admin-ops-hero">
          <div className="admin-ops-hero-copy">
            <p className="admin-ops-eyebrow">Admin Operations Center</p>
            <h1>Run Loombus from one verified workspace.</h1>
            <p>
              Review active queues, move into the existing operational tools, and keep moderation, support, member access, billing, Labs, and platform diagnostics connected without creating parallel Admin systems.
            </p>
            <div className="admin-ops-live-note">
              <span aria-hidden="true" />
              <p>
                Counts are direct reads from the current production tables. Unavailable values render as a dash rather than a false zero.
              </p>
            </div>
          </div>

          <div className="admin-ops-hero-actions">
            <button
              type="button"
              className="admin-ops-primary-action"
              onClick={() => void refreshCounts()}
              disabled={loadingCounts}
            >
              <RefreshCw className={loadingCounts ? "is-spinning" : ""} aria-hidden="true" />
              {loadingCounts ? "Refreshing…" : "Refresh overview"}
            </button>
            <Link href="/discussions" className="admin-ops-secondary-action">
              View Loombus
            </Link>
            <p>
              {loadedAt
                ? `Last refreshed ${loadedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
                : "Operational totals have not loaded yet."}
            </p>
          </div>
        </header>

        {loadMessage ? (
          <div className="admin-ops-notice" role="status">
            <AlertTriangle aria-hidden="true" />
            <span>{loadMessage}</span>
          </div>
        ) : null}

        <section className="admin-ops-metrics" aria-label="Operational overview">
          <MetricCard
            label="Active queue"
            value={activeQueue}
            description="New reports, active support requests, and Labs requests still in workflow."
            priority={(activeQueue ?? 0) > 0}
          />
          <MetricCard
            label="New reports"
            value={counts.newReports}
            description="Reports currently carrying the existing New status."
            priority={(counts.newReports ?? 0) > 0}
          />
          <MetricCard
            label="Active support"
            value={counts.supportRequests}
            description="Support requests currently New or Reviewing."
          />
          <MetricCard
            label="Members"
            value={counts.members}
            description="Profiles visible to the existing Admin role."
          />
        </section>

        <section className="admin-ops-snapshot" aria-labelledby="admin-ops-snapshot-title">
          <div className="admin-ops-section-heading">
            <div>
              <p className="admin-ops-eyebrow">Queue snapshot</p>
              <h2 id="admin-ops-snapshot-title">What needs attention now</h2>
            </div>
            <p>Each total links to the production workflow that owns the underlying records.</p>
          </div>

          <div className="admin-ops-priority-grid">
            <Link href="/admin/reports" className="admin-ops-priority-card">
              <ShieldAlert aria-hidden="true" />
              <div>
                <p>Moderation</p>
                <strong>{formatCount(counts.newReports)} new reports</strong>
                <span>{formatCount(counts.profileReports)} reports involve a profile.</span>
              </div>
              <ChevronRight aria-hidden="true" />
            </Link>

            <Link href="/admin/support" className="admin-ops-priority-card">
              <LifeBuoy aria-hidden="true" />
              <div>
                <p>Support</p>
                <strong>{formatCount(counts.supportRequests)} active requests</strong>
                <span>New and Reviewing support statuses.</span>
              </div>
              <ChevronRight aria-hidden="true" />
            </Link>

            <Link href="/admin/labs" className="admin-ops-priority-card">
              <FlaskConical aria-hidden="true" />
              <div>
                <p>Labs</p>
                <strong>{formatCount(counts.labsInWorkflow)} in workflow</strong>
                <span>{formatCount(counts.labsRequests)} total feature requests.</span>
              </div>
              <ChevronRight aria-hidden="true" />
            </Link>

            <Link href="/admin/deleted" className="admin-ops-priority-card">
              <ArchiveRestore aria-hidden="true" />
              <div>
                <p>Recovery</p>
                <strong>{formatCount(deletedContent)} soft-deleted items</strong>
                <span>
                  {formatCount(counts.deletedDiscussions)} discussions and {formatCount(counts.deletedReplies)} replies.
                </span>
              </div>
              <ChevronRight aria-hidden="true" />
            </Link>
          </div>
        </section>

        <section className="admin-ops-history" aria-label="Moderation history totals">
          <div>
            <span>Total reports</span>
            <strong>{formatCount(counts.totalReports)}</strong>
          </div>
          <div>
            <span>Actioned reports</span>
            <strong>{formatCount(counts.actionedReports)}</strong>
          </div>
          <div>
            <span>Dismissed reports</span>
            <strong>{formatCount(counts.dismissedReports)}</strong>
          </div>
          <div>
            <span>Profile reports</span>
            <strong>{formatCount(counts.profileReports)}</strong>
          </div>
        </section>

        {MODULE_GROUPS.map((group) => (
          <section className="admin-ops-module-section" key={group.title}>
            <div className="admin-ops-section-heading">
              <div>
                <p className="admin-ops-eyebrow">Operations</p>
                <h2>{group.title}</h2>
              </div>
              <p>{group.description}</p>
            </div>
            <div className="admin-ops-module-grid">
              {group.modules.map((module) => (
                <ModuleCard key={module.href} module={module} counts={counts} />
              ))}
            </div>
          </section>
        ))}

        <section className="admin-ops-resource-section">
          <div className="admin-ops-section-heading">
            <div>
              <p className="admin-ops-eyebrow">Public surfaces</p>
              <h2>Review the member experience</h2>
            </div>
            <p>
              These links open current public or signed-in surfaces. No announcement-management console is presented because no separate production Admin announcement route is connected here.
            </p>
          </div>

          <div className="admin-ops-resource-grid">
            {PUBLIC_RESOURCES.map((resource) => (
              <Link key={resource.href} href={resource.href} className="admin-ops-resource-link">
                <div>
                  <strong>{resource.title}</strong>
                  <span>{resource.description}</span>
                </div>
                <ChevronRight aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>

        <section className="admin-ops-integrity-card">
          <span className="admin-ops-integrity-icon">
            <Gauge aria-hidden="true" />
          </span>
          <div>
            <p className="admin-ops-eyebrow">Operational integrity</p>
            <h2>One landing center, existing systems underneath.</h2>
            <p>
              This page does not replace moderation, support, billing, member, Labs, health, or audit workflows. It verifies Admin access, reads real overview totals, and routes each action to the existing owner surface.
            </p>
          </div>
          <Link href="/admin/health" className="admin-ops-secondary-action">
            <Activity aria-hidden="true" />
            Review platform health
          </Link>
        </section>
      </div>
    </main>
  );
}
