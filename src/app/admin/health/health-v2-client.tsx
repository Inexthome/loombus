"use client";

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  ChevronRight,
  Clipboard,
  Cloud,
  CreditCard,
  Database,
  Gauge,
  KeyRound,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Smartphone,
  TriangleAlert,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type HealthSeverity = "notice" | "attention" | "warning";
type HealthStatus = "healthy" | "attention" | "degraded";
type ServiceStatus = HealthStatus | "not_configured";

type CountResult = {
  key: string;
  label: string;
  count: number | null;
  ok: boolean;
  error: string | null;
};

type HealthWarning = {
  key: string;
  severity: HealthSeverity;
  message: string;
  detail: string | null;
  destination: string | null;
};

type ServiceCheck = {
  key: string;
  label: string;
  status: ServiceStatus;
  summary: string;
  detail: string;
  destination: string | null;
};

type HealthResponse = {
  currentAdminId: string;
  generatedAt: string;
  lookback: {
    dayAgo: string;
    weekAgo: string;
  };
  status: HealthStatus;
  dataAccessMode: "service_role" | "unavailable" | string;
  config: Record<string, boolean>;
  missingConfig: string[];
  databaseCounts: CountResult[];
  operationalSignals: CountResult[];
  warnings: HealthWarning[];
  serviceChecks: ServiceCheck[];
};

type ConfigDefinition = {
  key: string;
  label: string;
  required?: boolean;
};

type ConfigGroup = {
  key: string;
  label: string;
  description: string;
  Icon: LucideIcon;
  items: ConfigDefinition[];
};

const CONFIG_GROUPS: ConfigGroup[] = [
  {
    key: "core",
    label: "Core runtime",
    description: "Application URL and Supabase server connectivity.",
    Icon: Server,
    items: [
      { key: "supabaseUrl", label: "Supabase URL", required: true },
      { key: "supabaseAnonKey", label: "Supabase anon key", required: true },
      { key: "supabaseServiceRole", label: "Supabase service role", required: true },
      { key: "siteUrl", label: "Site URL", required: true },
    ],
  },
  {
    key: "ai",
    label: "AI providers",
    description: "Generation credentials, feature models, and optional fallback.",
    Icon: Bot,
    items: [
      { key: "openAiApiKey", label: "OpenAI API key", required: true },
      { key: "openAiSummaryModel", label: "Summary model" },
      { key: "openAiTakeawaysModel", label: "Takeaways model" },
      { key: "openAiWhatChangedModel", label: "What-changed model" },
      { key: "openAiDisagreementModel", label: "Disagreement model" },
      { key: "openAiQualityCheckModel", label: "Quality-check model" },
      { key: "openAiRewriteModel", label: "Rewrite model" },
      { key: "openAiReplySuggestionsModel", label: "Reply-suggestions model" },
      { key: "anthropicApiKey", label: "Anthropic API key" },
      { key: "anthropicFallbackModel", label: "Anthropic fallback model" },
    ],
  },
  {
    key: "billing",
    label: "Billing",
    description: "Stripe sessions, webhooks, subscriptions, and Extra AI Packs.",
    Icon: CreditCard,
    items: [
      { key: "stripeSecretKey", label: "Stripe secret key" },
      { key: "stripeWebhookSecret", label: "Stripe webhook secret" },
      { key: "premiumMonthlyPrice", label: "Premium monthly price" },
      { key: "premiumMonthlyFallbackPrice", label: "Premium monthly fallback price" },
      { key: "premiumAnnualPrice", label: "Premium annual price" },
      { key: "premiumPlusMonthlyPrice", label: "Premium Plus monthly price" },
      { key: "premiumPlusAnnualPrice", label: "Premium Plus annual price" },
      { key: "extraAiPackPrice", label: "Extra AI Pack price" },
    ],
  },
  {
    key: "email",
    label: "Email delivery",
    description: "Transactional messages, sender identity, and digest scheduling.",
    Icon: Mail,
    items: [
      { key: "resendApiKey", label: "Resend API key" },
      { key: "digestFromEmail", label: "Digest from email" },
      { key: "digestCronSecret", label: "Digest cron secret" },
    ],
  },
  {
    key: "push",
    label: "Mobile push",
    description: "Apple Push Notification service and Firebase Cloud Messaging.",
    Icon: Smartphone,
    items: [
      { key: "apnsTeamId", label: "APNs team ID" },
      { key: "apnsKeyId", label: "APNs key ID" },
      { key: "apnsPrivateKey", label: "APNs private key" },
      { key: "apnsBundleId", label: "APNs bundle ID" },
      { key: "apnsEnvironment", label: "APNs environment" },
      { key: "firebaseServiceAccount", label: "Firebase service account" },
      { key: "firebaseProjectId", label: "Firebase project ID" },
      { key: "firebaseClientEmail", label: "Firebase client email" },
      { key: "firebasePrivateKey", label: "Firebase private key" },
    ],
  },
];

const WARNING_DESTINATION_LABELS: Record<string, string> = {
  "/admin/audit": "Open Audit Operations",
  "/admin/reports": "Open Report Operations",
  "/admin/support": "Open Support Operations",
  "/admin/ai-access": "Open AI Access Operations",
  "/admin/billing": "Open Billing Operations",
  "/admin/billing?link=attention": "Review billing synchronization",
  "/admin/audit?search=welcome_email": "Review welcome-email events",
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Not recorded";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function formatRelativeTime(value: string | null | undefined) {
  if (!value) return "No timestamp";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "No timestamp";

  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function humanize(value: string) {
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getStatusIcon(status: ServiceStatus | HealthSeverity): LucideIcon {
  if (status === "healthy") return CheckCircle2;
  if (status === "warning" || status === "degraded") return XCircle;
  if (status === "attention") return AlertTriangle;
  return Gauge;
}

function getStatusClass(status: ServiceStatus | HealthSeverity) {
  if (status === "healthy") return "is-healthy";
  if (status === "warning" || status === "degraded") return "is-degraded";
  if (status === "attention") return "is-attention";
  return "is-notice";
}

function warningSearchText(warning: HealthWarning) {
  return [
    warning.key,
    warning.severity,
    warning.message,
    warning.detail,
    warning.destination,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export default function AdminHealthV2Client() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedWarningKey, setSelectedWarningKey] = useState("");
  const [warningSearch, setWarningSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [countSearch, setCountSearch] = useState("");
  const [countStateFilter, setCountStateFilter] = useState("all");
  const [copiedValue, setCopiedValue] = useState("");

  const loadHealth = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    setMessage("");

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      window.location.href = "/login";
      return;
    }

    try {
      const response = await fetch("/api/admin/health", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({}));

      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (response.status === 403) {
        setAuthorized(false);
        setAuthChecked(true);
        return;
      }

      if (!response.ok) {
        setAuthorized(true);
        setAuthChecked(true);
        setMessage(result.error ?? "Unable to load platform health operations.");
        return;
      }

      const loadedHealth = result as HealthResponse;
      const params = new URLSearchParams(window.location.search);
      const requestedWarning = params.get("warning");
      const initialWarning =
        requestedWarning &&
        loadedHealth.warnings.some((warning) => warning.key === requestedWarning)
          ? requestedWarning
          : loadedHealth.warnings[0]?.key ?? "";

      setHealth(loadedHealth);
      setAuthorized(true);
      setAuthChecked(true);
      setSelectedWarningKey(initialWarning);
    } catch {
      setAuthorized(true);
      setAuthChecked(true);
      setMessage("Unable to load platform health operations.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadHealth();
  }, [loadHealth]);

  const configuredCount = useMemo(
    () => (health ? Object.values(health.config).filter(Boolean).length : 0),
    [health]
  );
  const configTotal = health ? Object.keys(health.config).length : 0;
  const failedChecks = useMemo(() => {
    if (!health) return 0;
    return [...health.databaseCounts, ...health.operationalSignals].filter(
      (item) => !item.ok
    ).length;
  }, [health]);
  const attentionServices = useMemo(
    () =>
      health?.serviceChecks.filter((service) => service.status !== "healthy").length ?? 0,
    [health]
  );

  const filteredWarnings = useMemo(() => {
    if (!health) return [];
    const query = warningSearch.trim().toLowerCase();

    return health.warnings.filter((warning) => {
      if (severityFilter !== "all" && warning.severity !== severityFilter) {
        return false;
      }
      return !query || warningSearchText(warning).includes(query);
    });
  }, [health, severityFilter, warningSearch]);

  useEffect(() => {
    if (filteredWarnings.length === 0) {
      setSelectedWarningKey("");
      return;
    }

    if (!filteredWarnings.some((warning) => warning.key === selectedWarningKey)) {
      setSelectedWarningKey(filteredWarnings[0].key);
    }
  }, [filteredWarnings, selectedWarningKey]);

  const selectedWarning = useMemo(
    () =>
      health?.warnings.find((warning) => warning.key === selectedWarningKey) ?? null,
    [health, selectedWarningKey]
  );

  const filteredCounts = useMemo(() => {
    if (!health) return [];
    const query = countSearch.trim().toLowerCase();

    return [
      ...health.databaseCounts.map((item) => ({ ...item, group: "Database" })),
      ...health.operationalSignals.map((item) => ({ ...item, group: "Signal" })),
    ].filter((item) => {
      if (countStateFilter === "ok" && !item.ok) return false;
      if (countStateFilter === "error" && item.ok) return false;
      const haystack = [item.key, item.label, item.group, item.error]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return !query || haystack.includes(query);
    });
  }, [countSearch, countStateFilter, health]);

  function selectWarning(warning: HealthWarning) {
    setSelectedWarningKey(warning.key);
    const url = new URL(window.location.href);
    url.searchParams.set("warning", warning.key);
    window.history.replaceState({}, "", url);
  }

  async function copyValue(value: string) {
    await navigator.clipboard.writeText(value);
    setCopiedValue(value);
    window.setTimeout(() => setCopiedValue(""), 1800);
  }

  if (loading || !authChecked) {
    return (
      <main className="health-v2-page">
        <section className="health-v2-state">
          <Loader2 className="health-v2-spinner" aria-hidden="true" />
          <p>Platform Health Operations</p>
          <h1>Running Admin health checks…</h1>
        </section>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="health-v2-page">
        <section className="health-v2-state">
          <ShieldCheck aria-hidden="true" />
          <p>Platform Health Operations</p>
          <h1>Admin access is required.</h1>
          <Link href="/" className="health-v2-primary-action">
            Return home
          </Link>
        </section>
      </main>
    );
  }

  if (!health) {
    return (
      <main className="health-v2-page">
        <section className="health-v2-state">
          <TriangleAlert aria-hidden="true" />
          <p>Platform Health Operations</p>
          <h1>Health checks could not be loaded.</h1>
          <span>{message || "The Admin health endpoint returned no diagnostics."}</span>
          <button
            type="button"
            className="health-v2-primary-action"
            onClick={() => void loadHealth()}
          >
            Try again
          </button>
        </section>
      </main>
    );
  }

  const OverallIcon = getStatusIcon(health.status);

  return (
    <main className="health-v2-page">
      <div className="health-v2-shell">
        <header className="health-v2-hero">
          <div className="health-v2-hero-copy">
            <Link href="/admin" className="health-v2-back-link">
              <ArrowLeft aria-hidden="true" />
              Admin center
            </Link>
            <p className="health-v2-eyebrow">Platform Health Operations</p>
            <h1>See operational risk before members feel it.</h1>
            <p className="health-v2-intro">
              Read-only visibility across runtime configuration, Admin database access,
              AI activity, billing synchronization, email delivery, and mobile push.
            </p>
          </div>

          <div className="health-v2-hero-actions">
            <span className={`health-v2-status-pill ${getStatusClass(health.status)}`}>
              <OverallIcon aria-hidden="true" />
              {humanize(health.status)}
            </span>
            <button
              type="button"
              className="health-v2-primary-action"
              onClick={() => void loadHealth(true)}
              disabled={refreshing}
            >
              <RefreshCw className={refreshing ? "health-v2-spinner" : ""} aria-hidden="true" />
              {refreshing ? "Refreshing…" : "Refresh checks"}
            </button>
          </div>
        </header>

        <nav className="health-v2-links" aria-label="Related Admin operations">
          <Link href="/admin/billing">Billing</Link>
          <Link href="/admin/ai-access">AI Access</Link>
          <Link href="/admin/reports">Reports</Link>
          <Link href="/admin/support">Support</Link>
          <Link href="/admin/audit">Audit</Link>
        </nav>

        {message ? <div className="health-v2-message">{message}</div> : null}

        <section className="health-v2-metrics" aria-label="Platform health metrics">
          <article className="health-v2-metric is-priority">
            <OverallIcon aria-hidden="true" />
            <span>Overall posture</span>
            <strong>{humanize(health.status)}</strong>
            <small>{formatRelativeTime(health.generatedAt)}</small>
          </article>
          <article className="health-v2-metric">
            <KeyRound aria-hidden="true" />
            <span>Configured settings</span>
            <strong>{configuredCount}/{configTotal}</strong>
            <small>{health.missingConfig.length} not present</small>
          </article>
          <article className="health-v2-metric">
            <Database aria-hidden="true" />
            <span>Read checks</span>
            <strong>{failedChecks === 0 ? "Passing" : `${failedChecks} failed`}</strong>
            <small>{health.dataAccessMode === "service_role" ? "Service-role verified" : "Data access unavailable"}</small>
          </article>
          <article className="health-v2-metric">
            <Activity aria-hidden="true" />
            <span>Service attention</span>
            <strong>{attentionServices}</strong>
            <small>{health.warnings.length} warning records</small>
          </article>
        </section>

        <section className="health-v2-service-section">
          <div className="health-v2-section-heading">
            <div>
              <p>Service posture</p>
              <h2>Operational systems at a glance</h2>
            </div>
            <span>Generated {formatDateTime(health.generatedAt)}</span>
          </div>

          <div className="health-v2-service-grid">
            {health.serviceChecks.map((service) => {
              const Icon = getStatusIcon(service.status);
              return (
                <article key={service.key} className="health-v2-service-card">
                  <div className="health-v2-service-topline">
                    <span className={`health-v2-icon-box ${getStatusClass(service.status)}`}>
                      <Icon aria-hidden="true" />
                    </span>
                    <span className={`health-v2-status-text ${getStatusClass(service.status)}`}>
                      {humanize(service.status)}
                    </span>
                  </div>
                  <h3>{service.label}</h3>
                  <strong>{service.summary}</strong>
                  <p>{service.detail}</p>
                  {service.destination ? (
                    <Link href={service.destination}>
                      Review operations <ChevronRight aria-hidden="true" />
                    </Link>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>

        <section className="health-v2-workspace">
          <aside className="health-v2-queue">
            <div className="health-v2-panel-heading">
              <div>
                <p>Attention queue</p>
                <h2>Warnings and notices</h2>
              </div>
              <span>{filteredWarnings.length}</span>
            </div>

            <label className="health-v2-search-field">
              <Search aria-hidden="true" />
              <input
                value={warningSearch}
                onChange={(event) => setWarningSearch(event.target.value)}
                placeholder="Search warnings"
              />
            </label>

            <select
              value={severityFilter}
              onChange={(event) => setSeverityFilter(event.target.value)}
              className="health-v2-select"
              aria-label="Filter warnings by severity"
            >
              <option value="all">All severities</option>
              <option value="warning">Warnings</option>
              <option value="attention">Attention</option>
              <option value="notice">Notices</option>
            </select>

            <div className="health-v2-queue-list">
              {filteredWarnings.length === 0 ? (
                <div className="health-v2-empty-card">
                  <CheckCircle2 aria-hidden="true" />
                  <strong>No warnings match.</strong>
                  <span>Adjust the search or severity filter.</span>
                </div>
              ) : (
                filteredWarnings.map((warning) => {
                  const Icon = getStatusIcon(warning.severity);
                  return (
                    <button
                      key={warning.key}
                      type="button"
                      className={`health-v2-warning-row ${
                        warning.key === selectedWarningKey ? "is-selected" : ""
                      }`}
                      onClick={() => selectWarning(warning)}
                    >
                      <span className={`health-v2-icon-box ${getStatusClass(warning.severity)}`}>
                        <Icon aria-hidden="true" />
                      </span>
                      <span className="health-v2-warning-row-copy">
                        <strong>{warning.message}</strong>
                        <small>{humanize(warning.severity)}</small>
                      </span>
                      <ChevronRight aria-hidden="true" />
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          <section className="health-v2-detail">
            {selectedWarning ? (
              <>
                <div className="health-v2-detail-heading">
                  <div>
                    <p>Selected health record</p>
                    <h2>{selectedWarning.message}</h2>
                  </div>
                  <span className={`health-v2-status-pill ${getStatusClass(selectedWarning.severity)}`}>
                    {humanize(selectedWarning.severity)}
                  </span>
                </div>

                <div className="health-v2-detail-body">
                  <article className="health-v2-detail-card is-summary">
                    <h3>Operational meaning</h3>
                    <p>{selectedWarning.detail || "No additional diagnostic detail was returned."}</p>
                  </article>

                  <article className="health-v2-detail-card">
                    <h3>Record context</h3>
                    <dl>
                      <div><dt>Health key</dt><dd>{selectedWarning.key}</dd></div>
                      <div><dt>Severity</dt><dd>{humanize(selectedWarning.severity)}</dd></div>
                      <div><dt>Generated</dt><dd>{formatDateTime(health.generatedAt)}</dd></div>
                      <div><dt>Data access</dt><dd>{humanize(health.dataAccessMode)}</dd></div>
                    </dl>
                  </article>

                  <div className="health-v2-detail-actions">
                    {selectedWarning.destination ? (
                      <Link href={selectedWarning.destination} className="health-v2-primary-action">
                        {WARNING_DESTINATION_LABELS[selectedWarning.destination] ?? "Open related operations"}
                        <ChevronRight aria-hidden="true" />
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      className="health-v2-secondary-action"
                      onClick={() => void copyValue(selectedWarning.key)}
                    >
                      <Clipboard aria-hidden="true" />
                      {copiedValue === selectedWarning.key ? "Copied" : "Copy health key"}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="health-v2-healthy-detail">
                <CheckCircle2 aria-hidden="true" />
                <p>Attention queue</p>
                <h2>No active health warning is selected.</h2>
                <span>
                  The platform may be healthy, or the current filters may exclude all records.
                </span>
              </div>
            )}
          </section>
        </section>

        <section className="health-v2-config-section">
          <div className="health-v2-section-heading">
            <div>
              <p>Environment readiness</p>
              <h2>Safe configuration presence</h2>
            </div>
            <span>Values are never displayed</span>
          </div>

          <div className="health-v2-config-groups">
            {CONFIG_GROUPS.map((group) => {
              const configured = group.items.filter((item) => health.config[item.key]).length;
              return (
                <article key={group.key} className="health-v2-config-group">
                  <div className="health-v2-config-group-heading">
                    <span><group.Icon aria-hidden="true" /></span>
                    <div>
                      <h3>{group.label}</h3>
                      <p>{group.description}</p>
                    </div>
                    <strong>{configured}/{group.items.length}</strong>
                  </div>

                  <div className="health-v2-config-list">
                    {group.items.map((item) => {
                      const present = Boolean(health.config[item.key]);
                      return (
                        <div key={item.key} className="health-v2-config-row">
                          <span className={present ? "is-present" : "is-missing"}>
                            {present ? <CheckCircle2 aria-hidden="true" /> : <XCircle aria-hidden="true" />}
                          </span>
                          <div>
                            <strong>{item.label}</strong>
                            <small>{item.required ? "Core requirement" : "Feature setting"}</small>
                          </div>
                          <em>{present ? "Configured" : "Missing"}</em>
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="health-v2-count-section">
          <div className="health-v2-section-heading">
            <div>
              <p>Read-only diagnostics</p>
              <h2>Database visibility and operational signals</h2>
            </div>
            <span>{filteredCounts.length} checks shown</span>
          </div>

          <div className="health-v2-count-controls">
            <label className="health-v2-search-field">
              <Search aria-hidden="true" />
              <input
                value={countSearch}
                onChange={(event) => setCountSearch(event.target.value)}
                placeholder="Search checks"
              />
            </label>
            <select
              value={countStateFilter}
              onChange={(event) => setCountStateFilter(event.target.value)}
              className="health-v2-select"
              aria-label="Filter diagnostic checks"
            >
              <option value="all">All check states</option>
              <option value="ok">Passing</option>
              <option value="error">Errors</option>
            </select>
          </div>

          <div className="health-v2-count-grid">
            {filteredCounts.map((item) => (
              <article key={`${item.group}-${item.key}`} className="health-v2-count-card">
                <div>
                  <span>{item.group}</span>
                  <h3>{item.label}</h3>
                </div>
                <strong className={item.ok ? "is-ok" : "is-error"}>
                  {item.ok ? (item.count ?? 0).toLocaleString() : "Error"}
                </strong>
                {item.error ? <p>{item.error}</p> : <small>Read check completed successfully.</small>}
              </article>
            ))}
          </div>
        </section>

        <footer className="health-v2-footer">
          <div>
            <Cloud aria-hidden="true" />
            <span>Generated {formatDateTime(health.generatedAt)}</span>
          </div>
          <div>
            <Database aria-hidden="true" />
            <span>{health.dataAccessMode === "service_role" ? "Service-role operational reads" : "Operational reads unavailable"}</span>
          </div>
        </footer>
      </div>
    </main>
  );
}
