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
  HeartPulse,
  LifeBuoy,
  LineChart,
  ListChecks,
  Radio,
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

type AdminAttentionItem = {
  id: string;
  source_type: string;
  source_id: string;
  source_status: string | null;
  title: string;
  summary: string | null;
  action_url: string;
  priority: "normal" | "high" | "urgent";
  generation: number;
  opened_at: string;
  source_updated_at: string | null;
};

type AccessState = "checking" | "allowed" | "denied" | "error";

type AdminModule = {
  href: string;
  title: string;
  description: string;
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
    title: "Trust, safety & moderation",
    description:
      "Investigate reports, safety signals, enforcement decisions, recovery work, and the audit trail.",
    modules: [
      { href: "/admin/reports", title: "Reports", description: "Review member-submitted reports and record moderation outcomes.", Icon: ShieldAlert, countKey: "newReports" },
      { href: "/admin/safety", title: "Safety Queue", description: "Review pre-submit safety blocks and warnings from current safety checks.", Icon: AlertTriangle },
      { href: "/admin/age-safety", title: "Age Safety", description: "Review age-safety operations and the controls attached to them.", Icon: ShieldCheck },
      { href: "/admin/enforcement", title: "Enforcement & Appeals", description: "Review enforcement cases, member consequences, and appeal workflows.", Icon: ListChecks },
      { href: "/admin/deleted", title: "Deleted Discussions", description: "Inspect and restore soft-deleted discussions through the recovery workflow.", Icon: ArchiveRestore, countKey: "deletedDiscussions" },
      { href: "/admin/deleted-replies", title: "Deleted Replies", description: "Inspect and restore soft-deleted replies through the recovery workflow.", Icon: ArchiveRestore, countKey: "deletedReplies" },
      { href: "/admin/audit", title: "Audit Log", description: "Review recorded platform activity, actors, targets, and system events.", Icon: ClipboardList },
    ],
  },
  {
    title: "Members, support & billing",
    description:
      "Inspect member status, support work, AI entitlements, billing references, and booking payments.",
    modules: [
      { href: "/admin/users", title: "Member Lookup", description: "Search members and review account, plan, and billing identity status.", Icon: Users, countKey: "members" },
      { href: "/admin/support", title: "Support Requests", description: "Review structured support requests, statuses, and internal Admin notes.", Icon: LifeBuoy, countKey: "supportRequests" },
      { href: "/admin/ai-access", title: "AI Access", description: "Review and manage the existing Premium AI entitlement controls.", Icon: Bot },
      { href: "/admin/billing", title: "Billing Diagnostics", description: "Inspect subscription synchronization and Extra AI Pack fulfillment.", Icon: CreditCard },
      { href: "/admin/professional-booking/payments", title: "Booking Payments", description: "Review payment operations and unresolved booking disputes.", Icon: CreditCard },
    ],
  },
  {
    title: "Platform operations",
    description:
      "Operate product workflows, review system health, and inspect the platform's active operational surfaces.",
    modules: [
      { href: "/admin/platform", title: "Platform Operations", description: "Review Marketplace, Businesses, Jobs, Events, Requests, Services, Rooms, Local, Matches, and related modules.", Icon: ListChecks },
      { href: "/admin/labs", title: "Labs Review", description: "Review feature requests, workflow status, Admin notes, and vote totals.", Icon: FlaskConical, countKey: "labsInWorkflow" },
      { href: "/admin/health", title: "Platform Health", description: "Inspect configuration, database visibility, AI failures, reports, and operational warnings.", Icon: HeartPulse },
      { href: "/admin/topic-memory", title: "Topic Memory", description: "Review recurring topics, Reality Lenses, tags, and AI idea coverage.", Icon: Sparkles },
    ],
  },
  {
    title: "Knowledge & publishing",
    description:
      "Review publication workflows and the knowledge surfaces that require administrator judgment.",
    modules: [
      { href: "/admin/library-review", title: "Library Review", description: "Review author submissions and publishing decisions for Loombus Library.", Icon: ClipboardList },
    ],
  },
  {
    title: "Legal & governance",
    description:
      "Open restricted legal workflows, evidence preparation, retention controls, and reporting tools.",
    modules: [
      { href: "/admin/legal-operations", title: "Legal Operations", description: "Open the primary legal operations workspace and its active case tools.", Icon: ShieldCheck },
      { href: "/admin/legal-operations/disclosure-preparation", title: "Disclosure Preparation", description: "Prepare and review disclosure material through the existing legal workflow.", Icon: ClipboardList },
      { href: "/admin/legal-operations/protected-party-review", title: "Protected Party Review", description: "Review protected-party handling through the restricted legal workflow.", Icon: ShieldAlert },
      { href: "/admin/legal-operations/data-map", title: "Legal Data Map", description: "Inspect the legal data map and its recorded data relationships.", Icon: ListChecks },
      { href: "/admin/legal-operations/export-integrity", title: "Export Integrity", description: "Review export-integrity controls before protected material leaves the system.", Icon: ShieldCheck },
      { href: "/admin/legal-operations/retention", title: "Legal Retention", description: "Review retention requirements and the controls attached to preserved records.", Icon: ArchiveRestore },
      { href: "/admin/legal-operations/transparency-reporting", title: "Transparency Reporting", description: "Review the reporting workflow for legal and governance transparency outputs.", Icon: LineChart },
    ],
  },
  {
    title: "The Floor",
    description:
      "Resolve calls and operate reviewed programming and research workflows for The Floor.",
    modules: [
      { href: "/admin/floor-resolutions", title: "Floor Call Resolutions", description: "Approve or reject proposed outcomes before they affect a member's public track record.", Icon: LineChart },
      { href: "/admin/floor-program", title: "Floor Operations Desk", description: "Schedule programming, publish reviewed research, and manage editorial assignments.", Icon: Radio },
    ],
  },
];

const PUBLIC_RESOURCES = [
  { href: "/support", title: "Support Center", description: "Member-facing help and support." },
  { href: "/privacy-security", title: "Privacy & Security", description: "Privacy and account-security center." },
  { href: "/premium", title: "Premium & Plans", description: "Current plan presentation and billing paths." },
  { href: "/labs", title: "Loombus Labs", description: "Public request board and voting experience." },
  { href: "/ai-usage", title: "AI Usage", description: "Signed-in AI usage and limits." },
  { href: "/guidelines", title: "Guidelines", description: "Current behavior and discussion-quality standards." },
];

function countValue(result: CountResult): CountValue {
  return result.error ? null : result.count ?? 0;
}

function formatCount(value: CountValue) {
  return value === null ? "—" : value.toLocaleString();
}

function ModuleRow({ module, counts }: { module: AdminModule; counts: AdminCounts }) {
  const count = module.countKey ? counts[module.countKey] : undefined;
  return (
    <Link href={module.href} className="admin-ops-module-row">
      <span className="admin-ops-module-icon"><module.Icon aria-hidden="true" /></span>
      <span className="admin-ops-module-copy"><strong>{module.title}</strong><span>{module.description}</span></span>
      {module.countKey ? <span className="admin-ops-module-count" aria-label={`${module.title} count`}>{formatCount(count ?? null)}</span> : null}
      <ChevronRight className="admin-ops-row-chevron" aria-hidden="true" />
    </Link>
  );
}

function AttentionIcon({ sourceType }: { sourceType: string }) {
  if (sourceType === "admin_support_request") return <LifeBuoy aria-hidden="true" />;
  if (sourceType === "admin_labs_request") return <FlaskConical aria-hidden="true" />;
  if (sourceType === "admin_library_review") return <ClipboardList aria-hidden="true" />;
  if (sourceType === "admin_booking_dispute") return <CreditCard aria-hidden="true" />;
  if (sourceType === "admin_identity_review") return <Users aria-hidden="true" />;
  return <ShieldAlert aria-hidden="true" />;
}

async function readAdminCounts() {
  const results = await Promise.all([
    supabase.from("reports").select("id", { count: "exact", head: true }),
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "dismissed"),
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "actioned"),
    supabase.from("reports").select("id", { count: "exact", head: true }).not("reported_profile_id", "is", null),
    supabase.from("discussions").select("id", { count: "exact", head: true }).not("deleted_at", "is", null),
    supabase.from("replies").select("id", { count: "exact", head: true }).not("deleted_at", "is", null),
    supabase.from("labs_feature_requests").select("id", { count: "exact", head: true }),
    supabase.from("labs_feature_requests").select("id", { count: "exact", head: true }).in("status", ["submitted", "reviewing"]),
    supabase.from("support_requests").select("id", { count: "exact", head: true }).in("status", ["new", "reviewing"]),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
  ]);
  const [totalReports, newReports, dismissedReports, actionedReports, profileReports, deletedDiscussions, deletedReplies, labsRequests, labsInWorkflow, supportRequests, members] = results as CountResult[];
  return {
    counts: {
      totalReports: countValue(totalReports), newReports: countValue(newReports), dismissedReports: countValue(dismissedReports), actionedReports: countValue(actionedReports), profileReports: countValue(profileReports), deletedDiscussions: countValue(deletedDiscussions), deletedReplies: countValue(deletedReplies), labsRequests: countValue(labsRequests), labsInWorkflow: countValue(labsInWorkflow), supportRequests: countValue(supportRequests), members: countValue(members),
    } satisfies AdminCounts,
    failedQueries: results.filter((result) => result.error).length,
  };
}

async function readAttentionItems() {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error("Admin session unavailable.");
  const response = await fetch("/api/admin/attention", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error ?? "Unable to load Admin Needs Attention.");
  return (result.items ?? []) as AdminAttentionItem[];
}

export default function AdminOperationsClient() {
  const [accessState, setAccessState] = useState<AccessState>("checking");
  const [counts, setCounts] = useState<AdminCounts>(EMPTY_COUNTS);
  const [attentionItems, setAttentionItems] = useState<AdminAttentionItem[]>([]);
  const [attentionAvailable, setAttentionAvailable] = useState(false);
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [loadMessage, setLoadMessage] = useState("");
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);

  const refreshOperations = useCallback(async () => {
    setLoadingCounts(true);
    setLoadMessage("");
    const [countResult, attentionResult] = await Promise.allSettled([readAdminCounts(), readAttentionItems()]);

    if (countResult.status === "fulfilled") {
      setCounts(countResult.value.counts);
      if (countResult.value.failedQueries > 0) {
        setLoadMessage(`${countResult.value.failedQueries} operational total${countResult.value.failedQueries === 1 ? "" : "s"} could not be verified. Unavailable values are shown as a dash.`);
      }
    } else {
      setCounts(EMPTY_COUNTS);
      setLoadMessage("Operational totals could not be refreshed. Unavailable values are shown as a dash.");
    }

    if (attentionResult.status === "fulfilled") {
      setAttentionItems(attentionResult.value);
      setAttentionAvailable(true);
    } else {
      setAttentionItems([]);
      setAttentionAvailable(false);
      setLoadMessage((current) => current || "Admin Needs Attention could not be verified. The queue is shown as unavailable rather than zero.");
    }

    setLoadedAt(new Date());
    setLoadingCounts(false);
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
        const { data: profile, error: profileError } = await supabase.from("profiles").select("is_admin").eq("id", userData.user.id).maybeSingle();
        if (profileError) throw profileError;
        if (!mounted) return;
        if (!profile?.is_admin) {
          setAccessState("denied");
          return;
        }
        setAccessState("allowed");
        await refreshOperations();
      } catch (error) {
        console.error("Unable to verify Admin access.", error);
        if (!mounted) return;
        setAccessState("error");
        setLoadMessage("Admin access could not be verified. Refresh the page or open Support if the problem continues.");
      }
    }
    void loadAdminAccess();
    return () => { mounted = false; };
  }, [refreshOperations]);

  const urgentCount = useMemo(() => attentionItems.filter((item) => item.priority === "urgent").length, [attentionItems]);
  const activeQueue: CountValue = attentionAvailable ? attentionItems.length : null;

  if (accessState === "checking") {
    return <main className="admin-ops-page"><section className="admin-ops-state" aria-live="polite"><ShieldCheck aria-hidden="true" /><p className="admin-ops-eyebrow">Admin</p><h1>Verifying access…</h1><p>Checking the current account role before operational data is loaded.</p></section></main>;
  }

  if (accessState === "denied") {
    return <main className="admin-ops-page"><section className="admin-ops-state"><ShieldAlert aria-hidden="true" /><p className="admin-ops-eyebrow">Admin</p><h1>Admin access is required.</h1><p>This area is restricted to accounts with the existing Loombus Admin role.</p><div className="admin-ops-state-actions"><Link href="/discussions" className="admin-ops-primary-action">Return to Loombus</Link><Link href="/support" className="admin-ops-secondary-action">Open Support</Link></div></section></main>;
  }

  if (accessState === "error") {
    return <main className="admin-ops-page"><section className="admin-ops-state"><AlertTriangle aria-hidden="true" /><p className="admin-ops-eyebrow">Admin</p><h1>Access could not be verified.</h1><p>{loadMessage}</p><div className="admin-ops-state-actions"><button type="button" className="admin-ops-primary-action" onClick={() => window.location.reload()}>Reload page</button><Link href="/support" className="admin-ops-secondary-action">Open Support</Link></div></section></main>;
  }

  return (
    <main className="admin-ops-page">
      <div className="admin-ops-shell">
        <header className="admin-ops-header">
          <div className="admin-ops-header-copy"><p className="admin-ops-eyebrow">Loombus Admin</p><h1>Operations</h1><p>Review what needs attention, investigate issues, and open the administrator tools responsible for each workflow.</p></div>
          <div className="admin-ops-header-actions">
            <button type="button" className="admin-ops-primary-action" onClick={() => void refreshOperations()} disabled={loadingCounts}><RefreshCw className={loadingCounts ? "is-spinning" : ""} aria-hidden="true" />{loadingCounts ? "Refreshing…" : "Refresh"}</button>
            <Link href="/discussions" className="admin-ops-secondary-action">View Loombus</Link>
            <span className="admin-ops-refresh-time">{loadedAt ? `Updated ${loadedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Awaiting totals"}</span>
          </div>
        </header>

        {loadMessage ? <div className="admin-ops-notice" role="status"><AlertTriangle aria-hidden="true" /><span>{loadMessage}</span></div> : null}

        <section className="admin-ops-signal-strip" aria-label="Operational overview">
          <div className={(activeQueue ?? 0) > 0 ? "is-attention" : ""}><span>Needs attention</span><strong>{formatCount(activeQueue)}</strong></div>
          <div className={urgentCount > 0 ? "is-attention" : ""}><span>Urgent</span><strong>{attentionAvailable ? urgentCount : "—"}</strong></div>
          <div><span>Active support</span><strong>{formatCount(counts.supportRequests)}</strong></div>
          <div><span>Members</span><strong>{formatCount(counts.members)}</strong></div>
        </section>

        <section className="admin-ops-section" aria-labelledby="admin-attention-title">
          <div className="admin-ops-section-heading">
            <div><p className="admin-ops-eyebrow">Source-linked queue</p><h2 id="admin-attention-title">Needs attention</h2></div>
            <p>Items remain until their underlying workflow is resolved. There is no independent dismiss action.</p>
          </div>
          <div className="admin-ops-attention-list">
            {!attentionAvailable ? (
              <div className="admin-ops-attention-row" role="status"><span><AlertTriangle aria-hidden="true" /></span><div><strong>Queue unavailable</strong><small>Admin Needs Attention could not be verified.</small></div><b>—</b></div>
            ) : attentionItems.length === 0 ? (
              <div className="admin-ops-attention-row"><span><ShieldCheck aria-hidden="true" /></span><div><strong>No unresolved Admin actions</strong><small>Source-linked workflows are currently clear.</small></div><b>0 open</b></div>
            ) : attentionItems.map((item) => (
              <Link href={item.action_url} className="admin-ops-attention-row" key={item.id}>
                <span><AttentionIcon sourceType={item.source_type} /></span>
                <div><strong>{item.title}</strong><small>{item.summary || `${item.source_type.replaceAll("_", " ")} · ${item.source_status || "action required"}`}</small></div>
                <b>{item.priority === "urgent" ? "Urgent" : item.priority === "high" ? "High" : "Open"}</b>
                <ChevronRight aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>

        <section className="admin-ops-history" aria-label="Moderation history totals">
          <div><span>Total reports</span><strong>{formatCount(counts.totalReports)}</strong></div>
          <div><span>Actioned</span><strong>{formatCount(counts.actionedReports)}</strong></div>
          <div><span>Dismissed</span><strong>{formatCount(counts.dismissedReports)}</strong></div>
          <div><span>Profile reports</span><strong>{formatCount(counts.profileReports)}</strong></div>
        </section>

        <div className="admin-ops-directory">
          {MODULE_GROUPS.map((group) => <section className="admin-ops-directory-section" key={group.title}><div className="admin-ops-directory-heading"><h2>{group.title}</h2><p>{group.description}</p></div><div className="admin-ops-module-list">{group.modules.map((module) => <ModuleRow key={module.href} module={module} counts={counts} />)}</div></section>)}
        </div>

        <section className="admin-ops-public-section">
          <div className="admin-ops-directory-heading"><p className="admin-ops-eyebrow">Public surfaces</p><h2>Member experience</h2><p>Open the member-facing surfaces most closely connected to administration and policy.</p></div>
          <div className="admin-ops-public-grid">{PUBLIC_RESOURCES.map((resource) => <Link key={resource.href} href={resource.href} className="admin-ops-public-link"><span><strong>{resource.title}</strong><small>{resource.description}</small></span><ChevronRight aria-hidden="true" /></Link>)}</div>
        </section>

        <footer className="admin-ops-footer"><div><Activity aria-hidden="true" /><span>Needs Attention is source-linked and durable. Informational recovery totals stay informational unless a source explicitly requires Admin action.</span></div><Link href="/admin/health">Platform health <ChevronRight aria-hidden="true" /></Link></footer>
      </div>
    </main>
  );
}
