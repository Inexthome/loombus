"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Compass,
  Crown,
  Database,
  Gauge,
  PenLine,
  RefreshCw,
  Search,
  Sparkles,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  getAiUsageLabel,
  getSubscriptionDisplay,
} from "@/lib/subscription-plans";
import { supabase } from "@/lib/supabase/client";

type AiEntitlement = {
  tier: string;
  ai_assisted_enabled: boolean;
  monthly_summary_limit: number;
  monthly_writing_limit: number;
  monthly_research_limit: number;
  monthly_discovery_limit: number;
};

type FeatureUsage = {
  featureKey: string;
  bucket: string;
  label: string;
  total: number;
  metered: number;
  generated: number;
  cached: number;
  failed: number;
  lastUsedAt: string | null;
};

type LimitBucketUsage = {
  bucket: string;
  label: string;
  limit: number | null;
  usage: number;
  remaining: number | null;
};

type RecentAiEvent = {
  id: string;
  feature_key: string;
  target_type: string | null;
  target_id: string | null;
  provider: string | null;
  model_name: string | null;
  cached: boolean;
  success: boolean;
  created_at: string;
};

type AiUsageResponse = {
  ok: boolean;
  isAdmin: boolean;
  entitlement: AiEntitlement;
  currentMonth: {
    start: string;
    limit: number | null;
    meteredUsage: number;
    generatedUsage: number;
    cachedUsage: number;
    failedUsage: number;
    remaining: number | null;
    featureUsage: FeatureUsage[];
    limitBuckets: LimitBucketUsage[];
  };
  recentEvents: RecentAiEvent[];
};

type EventStatus = "generated" | "cached" | "failed";

const featureLabels: Record<string, string> = {
  thread_summary: "Thread summaries",
  key_takeaways: "Key takeaways",
  what_changed: "What changed",
  disagreement_map: "Disagreement maps",
  discussion_quality_check: "Quality checks",
  discussion_clarity_rewrite: "Clarity rewrites",
  research_summary: "Research summaries",
  writing_assist: "Writing assist",
  moderation_assist: "Moderation assist",
  discovery: "Discovery assist",
};

function formatFeatureKey(value: string) {
  return (
    featureLabels[value] ??
    value
      .split("_")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

function formatDateTime(value: string | null) {
  if (!value) return "Not used this month";

  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatMonth(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function getEventStatus(event: RecentAiEvent): EventStatus {
  if (!event.success) return "failed";
  if (event.cached) return "cached";
  return "generated";
}

function getEventStatusLabel(status: EventStatus) {
  if (status === "failed") return "Failed";
  if (status === "cached") return "Cached";
  return "Generated";
}

function getBucketIcon(bucket: string) {
  const normalized = bucket.toLowerCase();

  if (normalized.includes("writing")) {
    return <PenLine aria-hidden="true" size={19} />;
  }

  if (normalized.includes("research")) {
    return <Search aria-hidden="true" size={19} />;
  }

  if (normalized.includes("discovery")) {
    return <Compass aria-hidden="true" size={19} />;
  }

  return <BrainCircuit aria-hidden="true" size={19} />;
}

function StatCard({
  icon,
  label,
  value,
  description,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  description: string;
}) {
  return (
    <article className="ai-usage-v2-stat-card">
      <div className="ai-usage-v2-stat-topline">
        <span className="ai-usage-v2-stat-icon">{icon}</span>
        <span className="ai-usage-v2-stat-label">{label}</span>
      </div>
      <strong className="ai-usage-v2-stat-value">{value}</strong>
      <p>{description}</p>
    </article>
  );
}

function StateCard({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <main className="ai-usage-v2-page">
      <section className="ai-usage-v2-state-card">
        {icon}
        <h1>{title}</h1>
        <p>{description}</p>
        {action ? <div className="ai-usage-v2-hero-actions">{action}</div> : null}
      </section>
    </main>
  );
}

export default function AiUsagePage() {
  const [usage, setUsage] = useState<AiUsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadUsage() {
      setLoadError("");

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData.session;

        if (!session) {
          window.location.replace("/login?next=%2Fai-usage");
          return;
        }

        const response = await fetch("/api/ai/usage", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          cache: "no-store",
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(result.error ?? "Unable to load AI usage.");
        }

        if (mounted) {
          setUsage(result as AiUsageResponse);
        }
      } catch (error) {
        if (mounted) {
          setLoadError(
            error instanceof Error ? error.message : "Unable to load AI usage."
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadUsage();

    return () => {
      mounted = false;
    };
  }, []);

  const subscriptionDisplay = getSubscriptionDisplay(usage?.entitlement ?? null);
  const aiUsageLabel = getAiUsageLabel(usage?.entitlement ?? null);

  const usagePercent = useMemo(() => {
    if (!usage?.currentMonth.limit || usage.currentMonth.limit <= 0) {
      return null;
    }

    return Math.min(
      100,
      Math.round(
        (usage.currentMonth.meteredUsage / usage.currentMonth.limit) * 100
      )
    );
  }, [usage]);

  if (loading) {
    return (
      <StateCard
        icon={<RefreshCw aria-hidden="true" size={28} />}
        title="Loading AI usage"
        description="Preparing your current plan, monthly meter, feature activity, and recent AI-assisted actions."
      />
    );
  }

  if (loadError) {
    return (
      <StateCard
        icon={<AlertTriangle aria-hidden="true" size={28} />}
        title="AI usage could not be loaded"
        description={loadError}
        action={
          <button
            type="button"
            className="ai-usage-v2-button ai-usage-v2-button-primary"
            onClick={() => window.location.reload()}
          >
            Try again
            <RefreshCw aria-hidden="true" size={16} />
          </button>
        }
      />
    );
  }

  if (!usage) {
    return (
      <StateCard
        icon={<BrainCircuit aria-hidden="true" size={28} />}
        title="No AI usage data is available"
        description="Your account is connected, but no AI usage summary was returned."
        action={
          <Link href="/dashboard" className="ai-usage-v2-button ai-usage-v2-button-primary">
            Return to Dashboard
            <ArrowRight aria-hidden="true" size={16} />
          </Link>
        }
      />
    );
  }

  const month = usage.currentMonth;
  const isUncapped = month.limit === null;
  const showUpgrade =
    !usage.entitlement.ai_assisted_enabled ||
    (month.remaining !== null && month.remaining === 0);

  return (
    <main className="ai-usage-v2-page">
      <div className="ai-usage-v2-shell">
        <section className="ai-usage-v2-hero">
          <div className="ai-usage-v2-hero-copy">
            <p className="ai-usage-v2-eyebrow">AI-assisted layer</p>
            <h1>Understand every AI action on your account.</h1>
            <p>
              Review what Loombus generated, what came from cache, what counted
              against your monthly meter, and which tools you used during {formatMonth(month.start)}.
            </p>
            <div className="ai-usage-v2-hero-actions">
              <Link href="/dashboard" className="ai-usage-v2-button ai-usage-v2-button-primary">
                Dashboard
                <ArrowRight aria-hidden="true" size={16} />
              </Link>
              {showUpgrade ? (
                <Link href="/premium" className="ai-usage-v2-button ai-usage-v2-button-quiet">
                  Review Premium
                  <Crown aria-hidden="true" size={16} />
                </Link>
              ) : null}
            </div>
          </div>

          <aside className="ai-usage-v2-plan-card" aria-label="Current AI plan">
            <div className="ai-usage-v2-plan-topline">
              <span className="ai-usage-v2-plan-icon">
                <Crown aria-hidden="true" size={21} />
              </span>
              <div>
                {usage.isAdmin ? (
                  <span className="ai-usage-v2-admin-badge">Admin account</span>
                ) : (
                  <span className="ai-usage-v2-plan-badge">{subscriptionDisplay.badge}</span>
                )}
              </div>
            </div>
            <h2>{subscriptionDisplay.label}</h2>
            <p className="ai-usage-v2-plan-description">
              {subscriptionDisplay.description}
            </p>
            <dl className="ai-usage-v2-plan-facts">
              <div>
                <dt>AI access</dt>
                <dd>{usage.entitlement.ai_assisted_enabled ? "Enabled" : "Not enabled"}</dd>
              </div>
              <div>
                <dt>Included usage</dt>
                <dd>{aiUsageLabel}</dd>
              </div>
              <div>
                <dt>Monthly cap</dt>
                <dd>{isUncapped ? "Uncapped" : month.limit}</dd>
              </div>
            </dl>
          </aside>
        </section>

        <section className="ai-usage-v2-overview-grid" aria-label="Monthly AI usage overview">
          <article className="ai-usage-v2-progress-card">
            <div className="ai-usage-v2-progress-heading">
              <div>
                <p>{formatMonth(month.start)} usage</p>
                <strong>{month.meteredUsage}</strong>
              </div>
              <span>{isUncapped ? "No monthly cap" : `${usagePercent ?? 0}% used`}</span>
            </div>
            {usagePercent !== null ? (
              <div
                className="ai-usage-v2-progress-track"
                role="progressbar"
                aria-label="Monthly AI usage"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={usagePercent}
              >
                <span style={{ width: `${usagePercent}%` }} />
              </div>
            ) : null}
            <p className="ai-usage-v2-progress-caption">
              {isUncapped
                ? "This account is not restricted by the normal monthly AI meter."
                : `${month.remaining ?? 0} of ${month.limit} included metered actions remain.`}
            </p>
          </article>

          <div className="ai-usage-v2-stats-grid">
            <StatCard
              icon={<Gauge aria-hidden="true" size={19} />}
              label="Metered"
              value={month.meteredUsage}
              description="Generated and failed non-cached attempts."
            />
            <StatCard
              icon={<Zap aria-hidden="true" size={19} />}
              label="Generated"
              value={month.generatedUsage}
              description="Successful new AI outputs."
            />
            <StatCard
              icon={<Database aria-hidden="true" size={19} />}
              label="Cached"
              value={month.cachedUsage}
              description="Reused results with no new generation."
            />
            <StatCard
              icon={<AlertTriangle aria-hidden="true" size={19} />}
              label="Failed"
              value={month.failedUsage}
              description="Non-cached attempts that did not complete."
            />
            <StatCard
              icon={<CheckCircle2 aria-hidden="true" size={19} />}
              label="Remaining"
              value={month.remaining === null ? "∞" : month.remaining}
              description={isUncapped ? "Normal monthly caps do not apply." : "Included metered actions still available."}
            />
          </div>
        </section>

        <section className="ai-usage-v2-section" aria-labelledby="buckets-heading">
          <div className="ai-usage-v2-section-heading">
            <div>
              <p className="ai-usage-v2-eyebrow">Limit buckets</p>
              <h2 id="buckets-heading">Separate limits for different kinds of help.</h2>
            </div>
            <span className="ai-usage-v2-section-icon">
              <BarChart3 aria-hidden="true" size={21} />
            </span>
          </div>
          <p className="ai-usage-v2-section-description">
            Thread understanding, writing, research, and discovery are tracked independently so one type of work does not obscure another.
          </p>

          <div className="ai-usage-v2-bucket-grid">
            {month.limitBuckets.map((bucket) => (
              <article key={bucket.bucket} className="ai-usage-v2-bucket-card">
                <span className="ai-usage-v2-bucket-icon">
                  {getBucketIcon(bucket.bucket)}
                </span>
                <h3>{bucket.label}</h3>
                <div className="ai-usage-v2-bucket-usage">
                  <strong>{bucket.usage}</strong>
                  <span>of {bucket.limit === null ? "∞" : bucket.limit}</span>
                </div>
                <p>
                  Remaining: {bucket.remaining === null ? "∞" : bucket.remaining}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="ai-usage-v2-section" aria-labelledby="feature-heading">
          <div className="ai-usage-v2-section-heading">
            <div>
              <p className="ai-usage-v2-eyebrow">Feature usage</p>
              <h2 id="feature-heading">See which tools are doing the work.</h2>
            </div>
            <span className="ai-usage-v2-section-icon">
              <Sparkles aria-hidden="true" size={21} />
            </span>
          </div>

          {month.featureUsage.length === 0 ? (
            <div className="ai-usage-v2-empty">
              You have not used any AI-assisted features this month yet.
            </div>
          ) : (
            <div className="ai-usage-v2-feature-grid">
              {month.featureUsage.map((feature) => (
                <article key={feature.featureKey} className="ai-usage-v2-feature-card">
                  <div className="ai-usage-v2-feature-heading">
                    <div>
                      <h3>{feature.label || formatFeatureKey(feature.featureKey)}</h3>
                      <p className="ai-usage-v2-feature-meta">
                        {feature.bucket} bucket · Last used {formatDateTime(feature.lastUsedAt)}
                      </p>
                    </div>
                    <span className="ai-usage-v2-total-badge">{feature.total} total</span>
                  </div>
                  <div className="ai-usage-v2-feature-metrics">
                    <div>
                      <strong>{feature.metered}</strong>
                      <span>Metered</span>
                    </div>
                    <div>
                      <strong>{feature.generated}</strong>
                      <span>Generated</span>
                    </div>
                    <div>
                      <strong>{feature.cached}</strong>
                      <span>Cached</span>
                    </div>
                    <div>
                      <strong>{feature.failed}</strong>
                      <span>Failed</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="ai-usage-v2-section" aria-labelledby="activity-heading">
          <div className="ai-usage-v2-section-heading">
            <div>
              <p className="ai-usage-v2-eyebrow">Recent activity</p>
              <h2 id="activity-heading">Latest AI-assisted actions.</h2>
            </div>
            <span className="ai-usage-v2-section-icon">
              <Clock3 aria-hidden="true" size={21} />
            </span>
          </div>

          {usage.recentEvents.length === 0 ? (
            <div className="ai-usage-v2-empty">
              No AI-assisted activity has been recorded yet.
            </div>
          ) : (
            <div className="ai-usage-v2-event-list">
              {usage.recentEvents.map((event) => {
                const status = getEventStatus(event);

                return (
                  <article key={event.id} className="ai-usage-v2-event-card">
                    <div className="ai-usage-v2-event-heading">
                      <div>
                        <strong>{formatFeatureKey(event.feature_key)}</strong>
                        <span>{formatDateTime(event.created_at)}</span>
                      </div>
                    </div>
                    <div className="ai-usage-v2-event-meta">
                      <span>
                        {event.provider ?? "No provider"}
                        {event.model_name ? ` · ${event.model_name}` : ""}
                      </span>
                      <span>{event.target_type ?? "No target"}</span>
                    </div>
                    <span className="ai-usage-v2-status" data-status={status}>
                      {getEventStatusLabel(status)}
                    </span>
                  </article>
                );
              })}
            </div>
          )}

          <p className="ai-usage-v2-section-description">
            Members can see feature, provider, model, target type, status, and timing. Raw provider error details remain private.
          </p>
        </section>

        <section className="ai-usage-v2-section" aria-labelledby="counts-heading">
          <div className="ai-usage-v2-section-heading">
            <div>
              <p className="ai-usage-v2-eyebrow">How counting works</p>
              <h2 id="counts-heading">Know what spends usage and what does not.</h2>
            </div>
            <span className="ai-usage-v2-section-icon">
              <BrainCircuit aria-hidden="true" size={21} />
            </span>
          </div>

          <div className="ai-usage-v2-explainer-grid">
            <article className="ai-usage-v2-explainer-card">
              <span className="ai-usage-v2-explainer-icon">
                <Zap aria-hidden="true" size={19} />
              </span>
              <div>
                <h3>Generated</h3>
                <p>A new successful AI output. It counts as a metered action.</p>
              </div>
            </article>
            <article className="ai-usage-v2-explainer-card">
              <span className="ai-usage-v2-explainer-icon">
                <Database aria-hidden="true" size={19} />
              </span>
              <div>
                <h3>Cached</h3>
                <p>An existing result shown again. It does not spend another generation.</p>
              </div>
            </article>
            <article className="ai-usage-v2-explainer-card">
              <span className="ai-usage-v2-explainer-icon">
                <AlertTriangle aria-hidden="true" size={19} />
              </span>
              <div>
                <h3>Failed</h3>
                <p>A non-cached attempt that started but did not complete. It is included in metered usage.</p>
              </div>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}
