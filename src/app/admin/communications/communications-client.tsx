"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Campaign = {
  id: string;
  subject: string;
  status: "prepared" | "sending" | "sent" | "failed";
  sender_email: string;
  eligible_count: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  completed_at: string | null;
};

type BroadcastState = {
  campaign: Campaign | null;
  preview: {
    subject: string;
    sender: string;
    eligibleCount: number;
    optedOutCount: number;
    totalAccounts: number;
  };
  providerConfigured: boolean;
};

type DeliveryDiagnostics = {
  retryableCount: number;
  exhaustedCount: number;
  failureReasons: Array<{ message: string; count: number }>;
  configuredSenders: {
    campaign?: string | null;
    broadcast: string | null;
    product: string | null;
    digest: string | null;
  };
};

type AccessState = "checking" | "allowed" | "denied" | "error";

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error("Your Admin session has expired.");
  return token;
}

async function callApi(path: string, method: "GET" | "POST", body?: unknown) {
  const token = await getAccessToken();
  const response = await fetch(path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || "Member email request failed.");
  return payload;
}

export default function AdminCommunicationsClient() {
  const [access, setAccess] = useState<AccessState>("checking");
  const [state, setState] = useState<BroadcastState | null>(null);
  const [diagnostics, setDiagnostics] = useState<DeliveryDiagnostics | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const [broadcastPayload, diagnosticPayload] = await Promise.all([
      callApi("/api/admin/member-email", "GET"),
      callApi("/api/admin/member-email/diagnostics", "GET"),
    ]);
    setState(broadcastPayload as BroadcastState);
    setDiagnostics(diagnosticPayload as DeliveryDiagnostics);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!userData.user) {
          window.location.replace("/login?next=/admin/communications");
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
          setAccess("denied");
          return;
        }
        setAccess("allowed");
        await load();
      } catch (error) {
        console.error(error);
        if (!mounted) return;
        setAccess("error");
        setMessage(error instanceof Error ? error.message : "Unable to load Admin Communications.");
      }
    })();
    return () => {
      mounted = false;
    };
  }, [load]);

  const processedProgress = useMemo(() => {
    const campaign = state?.campaign;
    if (!campaign || campaign.eligible_count === 0) return 0;
    return Math.min(
      100,
      Math.round(((campaign.sent_count + campaign.failed_count) / campaign.eligible_count) * 100)
    );
  }, [state?.campaign]);

  async function prepare() {
    setBusy(true);
    setMessage("");
    try {
      await callApi("/api/admin/member-email", "POST", { action: "prepare" });
      await load();
      setMessage("Campaign recipient snapshot prepared. No email has been sent yet.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to prepare campaign.");
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    setBusy(true);
    setMessage("Sending the next delivery batch…");
    try {
      await callApi("/api/admin/member-email", "POST", { action: "send_batch" });
      await load();
      setMessage("Batch processed. Review the delivery result before continuing.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Campaign sending stopped.");
      await load().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  async function resetFailed() {
    setBusy(true);
    setMessage("");
    try {
      await callApi("/api/admin/member-email/diagnostics", "POST", { action: "reset_failed" });
      await load();
      setMessage("Failed recipients were reset. Only retry after the provider or sender problem is corrected.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to reset failed recipients.");
    } finally {
      setBusy(false);
    }
  }

  if (access === "checking") {
    return (
      <section className="communications-editorial-state" aria-live="polite">
        <p className="communications-editorial-kicker">Access</p>
        <h2>Verifying Admin access…</h2>
        <p>Checking the current account role before campaign data is loaded.</p>
      </section>
    );
  }

  if (access === "denied") {
    return (
      <section className="communications-editorial-state">
        <p className="communications-editorial-kicker">Restricted</p>
        <h2>Admin access is required.</h2>
        <p>This communications workspace is limited to the existing Loombus Admin role.</p>
        <Link href="/discussions" className="communications-editorial-text-link">
          Return to Loombus
        </Link>
      </section>
    );
  }

  if (access === "error" || !state) {
    return (
      <section className="communications-editorial-state">
        <p className="communications-editorial-kicker">Unavailable</p>
        <h2>Communications could not be loaded.</h2>
        <p>{message}</p>
      </section>
    );
  }

  const campaign = state.campaign;
  const canPrepare = !campaign;
  const retryable = diagnostics?.retryableCount ?? 0;
  const exhausted = diagnostics?.exhaustedCount ?? 0;
  const hasFailures = Boolean(campaign && campaign.failed_count > 0);
  const canSend = Boolean(
    campaign &&
      campaign.status !== "sent" &&
      state.providerConfigured &&
      (!hasFailures || retryable > 0)
  );

  return (
    <main className="communications-editorial-page">
      <section className="communications-editorial-index" aria-label="Campaign readiness">
        <article><span>Accounts</span><strong>{state.preview.totalAccounts}</strong></article>
        <article><span>Eligible</span><strong>{state.preview.eligibleCount}</strong></article>
        <article><span>Opted out</span><strong>{state.preview.optedOutCount}</strong></article>
        <article><span>Provider</span><strong>{state.providerConfigured ? "Configured" : "Not configured"}</strong></article>
      </section>

      <section className="communications-editorial-campaign">
        <header className="communications-editorial-section-heading">
          <div>
            <p className="communications-editorial-kicker">Approved campaign</p>
            <h2>{state.preview.subject}</h2>
            <p>From {state.preview.sender}</p>
          </div>
          <span className="communications-editorial-status">{campaign?.status || "not prepared"}</span>
        </header>

        <div className="communications-editorial-message-preview">
          <p>We&apos;ve missed having you on Loombus.</p>
          <p>A lot has been happening since your last visit—new discussions, new ideas, and new ways to discover what&apos;s worth paying attention to.</p>
          <p>Come back and see what you&apos;ve been missing.</p>
          <p>Loombus is built for thoughtful conversations, useful perspectives, and signal over noise.</p>
          <p>We&apos;d love to have you back.</p>
          <p>— The Loombus Team</p>
          <span className="communications-editorial-cta-preview">See What&apos;s New</span>
        </div>

        {campaign ? (
          <section className="communications-editorial-progress" aria-label="Processing progress">
            <div className="communications-editorial-progress-heading">
              <span>Processing progress</span>
              <strong>{processedProgress}%</strong>
            </div>
            <div className="communications-editorial-progress-track" aria-hidden="true">
              <div style={{ width: `${processedProgress}%` }} />
            </div>
            <dl>
              <div><dt>Delivered to provider</dt><dd>{campaign.sent_count}</dd></div>
              <div><dt>Failed</dt><dd>{campaign.failed_count}</dd></div>
              <div><dt>Snapshotted</dt><dd>{campaign.eligible_count}</dd></div>
            </dl>
          </section>
        ) : null}

        {hasFailures && diagnostics ? (
          <section className="communications-editorial-notice" aria-live="polite">
            <strong>Delivery problem detected.</strong>
            <p>{campaign?.sent_count ?? 0} messages were accepted by the provider; {campaign?.failed_count ?? 0} failed.</p>
            {diagnostics.failureReasons.map((reason) => (
              <p key={reason.message}><strong>{reason.count}×</strong> {reason.message}</p>
            ))}
            <p>Retryable now: {retryable}. Retry limit reached: {exhausted}.</p>
            {diagnostics.configuredSenders.product && diagnostics.configuredSenders.product !== diagnostics.configuredSenders.campaign ? (
              <p>Existing product email sender: {diagnostics.configuredSenders.product}. Campaign sender: {diagnostics.configuredSenders.campaign}.</p>
            ) : null}
          </section>
        ) : null}

        {!state.providerConfigured ? (
          <p className="communications-editorial-notice">RESEND_API_KEY is not available to this deployment. Sending remains disabled until the existing Loombus email provider is configured.</p>
        ) : null}

        {message ? <p className="communications-editorial-feedback" aria-live="polite">{message}</p> : null}

        <div className="communications-editorial-actions">
          <button type="button" onClick={() => void prepare()} disabled={!canPrepare || busy}>
            {campaign ? "Recipients prepared" : busy ? "Preparing…" : "Prepare recipients"}
          </button>
          <button type="button" onClick={() => void send()} disabled={!canSend || busy} className="is-primary">
            {busy ? "Working…" : campaign?.status === "sent" ? "Campaign sent" : hasFailures ? "Retry next batch" : "Send next batch"}
          </button>
          {exhausted > 0 ? (
            <button type="button" onClick={() => void resetFailed()} disabled={busy}>
              Reset failed recipients
            </button>
          ) : null}
        </div>
      </section>
    </main>
  );
}
