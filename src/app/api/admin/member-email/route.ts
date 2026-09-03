import { NextResponse, type NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const CAMPAIGN_KEY = "loombus-misses-you-2026-09";
const CAMPAIGN_SUBJECT = "Loombus misses you";
const DEFAULT_FROM = "Loombus <hello@mail.loombus.com>";
const BATCH_SIZE = 20;

type AuthUser = {
  id: string;
  email?: string;
  email_confirmed_at?: string;
};

type MarketingPreference = {
  user_id: string;
  enabled: boolean;
  unsubscribe_token: string;
};

type Campaign = {
  id: string;
  campaign_key: string;
  subject: string;
  status: "prepared" | "sending" | "sent" | "failed";
  sender_email: string;
  eligible_count: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function getBroadcastSender() {
  return (
    process.env.PRODUCT_FROM_EMAIL ||
    process.env.DIGEST_FROM_EMAIL ||
    process.env.BROADCAST_FROM_EMAIL ||
    DEFAULT_FROM
  );
}

function getEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return null;
  return { supabaseUrl, anonKey, serviceRoleKey };
}

function getRequestClient(request: NextRequest, supabaseUrl: string, anonKey: string) {
  const authorization = request.headers.get("authorization") ?? "";
  return createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: authorization ? { Authorization: authorization } : {} },
  });
}

function getServiceClient(supabaseUrl: string, serviceRoleKey: string) {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function requireAdmin(request: NextRequest) {
  const env = getEnv();
  if (!env) return { error: jsonError("Server configuration error.", 500) } as const;

  const requestClient = getRequestClient(request, env.supabaseUrl, env.anonKey);
  const { data: userData, error: userError } = await requestClient.auth.getUser();
  if (userError || !userData.user) {
    return { error: jsonError("Unauthorized.", 401) } as const;
  }

  const service = getServiceClient(env.supabaseUrl, env.serviceRoleKey);
  const { data: profile, error: profileError } = await service
    .from("profiles")
    .select("is_admin")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError) return { error: jsonError("Unable to verify Admin access.", 500) } as const;
  if (!profile?.is_admin) return { error: jsonError("Admin access required.", 403) } as const;

  return { service, userId: userData.user.id } as const;
}

async function listAllAuthUsers(service: SupabaseClient): Promise<AuthUser[]> {
  const users: AuthUser[] = [];
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const batch = (data.users ?? []) as AuthUser[];
    users.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
  }

  return users;
}

async function ensurePreferences(service: SupabaseClient, users: AuthUser[]) {
  const userIds = users.map((user) => user.id);
  if (userIds.length === 0) return new Map<string, MarketingPreference>();

  const existing = new Map<string, MarketingPreference>();
  for (let start = 0; start < userIds.length; start += 500) {
    const ids = userIds.slice(start, start + 500);
    const { data, error } = await service
      .from("marketing_email_preferences")
      .select("user_id, enabled, unsubscribe_token")
      .in("user_id", ids);
    if (error) throw error;
    for (const row of (data ?? []) as MarketingPreference[]) existing.set(row.user_id, row);
  }

  const missing = users
    .filter((user) => !existing.has(user.id))
    .map((user) => ({ user_id: user.id }));

  if (missing.length > 0) {
    const { data, error } = await service
      .from("marketing_email_preferences")
      .insert(missing)
      .select("user_id, enabled, unsubscribe_token");
    if (error) throw error;
    for (const row of (data ?? []) as MarketingPreference[]) existing.set(row.user_id, row);
  }

  return existing;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildCampaignEmail(siteUrl: string, unsubscribeToken: string) {
  const openUrl = `${siteUrl}/discussions`;
  const unsubscribeUrl = `${siteUrl}/email/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}&scope=marketing`;
  const safeOpenUrl = escapeHtml(openUrl);
  const safeUnsubscribeUrl = escapeHtml(unsubscribeUrl);

  const text = [
    "We've missed having you on Loombus.",
    "",
    "A lot has been happening since your last visit—new discussions, new ideas, and new ways to discover what's worth paying attention to.",
    "",
    "Come back and see what you've been missing.",
    "",
    "Loombus is built for thoughtful conversations, useful perspectives, and signal over noise.",
    "",
    "We'd love to have you back.",
    "",
    "— The Loombus Team",
    "",
    `See What's New: ${openUrl}`,
    `Unsubscribe from Loombus member emails: ${unsubscribeUrl}`,
  ].join("\n");

  const html = `
    <div style="margin:0;background:#090909;padding:32px 16px;font-family:Arial,sans-serif;color:#f5f5f5;">
      <div style="max-width:620px;margin:0 auto;background:#111;border:1px solid #292929;border-radius:18px;padding:36px;">
        <div style="color:#CBAB5B;font-size:22px;font-weight:700;letter-spacing:.02em;margin-bottom:28px;">Loombus</div>
        <h1 style="font-size:30px;line-height:1.2;margin:0 0 22px;color:#fff;">We've missed having you on Loombus.</h1>
        <p style="font-size:16px;line-height:1.7;color:#ddd;">A lot has been happening since your last visit—new discussions, new ideas, and new ways to discover what's worth paying attention to.</p>
        <p style="font-size:16px;line-height:1.7;color:#ddd;">Come back and see what you've been missing.</p>
        <p style="font-size:16px;line-height:1.7;color:#ddd;">Loombus is built for thoughtful conversations, useful perspectives, and signal over noise.</p>
        <p style="font-size:16px;line-height:1.7;color:#ddd;">We'd love to have you back.</p>
        <p style="margin:28px 0;">
          <a href="${safeOpenUrl}" style="display:inline-block;background:#CBAB5B;color:#111;padding:13px 22px;border-radius:999px;text-decoration:none;font-weight:700;">See What's New</a>
        </p>
        <p style="font-size:14px;line-height:1.6;color:#aaa;margin-bottom:28px;">— The Loombus Team</p>
        <div style="border-top:1px solid #292929;padding-top:18px;font-size:12px;line-height:1.6;color:#777;">
          This is a Loombus member update from service@loombus.com.<br />
          <a href="${safeUnsubscribeUrl}" style="color:#aaa;">Unsubscribe from member emails</a>
        </div>
      </div>
    </div>
  `;

  return { html, text };
}

async function sendWithResend(args: {
  apiKey: string;
  from: string;
  to: string;
  html: string;
  text: string;
}) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${args.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: args.from,
      to: args.to,
      reply_to: "service@loombus.com",
      subject: CAMPAIGN_SUBJECT,
      html: args.html,
      text: args.text,
    }),
  });

  const result = await response.json().catch(() => ({}));
  return {
    ok: response.ok,
    id: typeof result?.id === "string" ? result.id : null,
    error: response.ok
      ? null
      : typeof result?.message === "string"
        ? result.message
        : `Resend returned HTTP ${response.status}.`,
  };
}

async function loadCampaign(service: SupabaseClient) {
  const { data, error } = await service
    .from("member_email_campaigns")
    .select("id, campaign_key, subject, status, sender_email, eligible_count, sent_count, failed_count, created_at, started_at, completed_at")
    .eq("campaign_key", CAMPAIGN_KEY)
    .maybeSingle<Campaign>();
  if (error) throw error;
  return data;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;

  try {
    const users = await listAllAuthUsers(auth.service);
    const preferences = await ensurePreferences(auth.service, users);
    const eligibleCount = users.filter((user) => {
      const preference = preferences.get(user.id);
      return Boolean(user.email && user.email_confirmed_at && preference?.enabled !== false);
    }).length;
    const optedOutCount = users.filter((user) => preferences.get(user.id)?.enabled === false).length;
    const campaign = await loadCampaign(auth.service);

    return NextResponse.json({
      campaign,
      preview: {
        subject: CAMPAIGN_SUBJECT,
        sender: getBroadcastSender(),
        eligibleCount,
        optedOutCount,
        totalAccounts: users.length,
      },
      providerConfigured: Boolean(process.env.RESEND_API_KEY),
    });
  } catch (error) {
    console.error("Unable to load member-email broadcast state.", error);
    return jsonError("Unable to load member email broadcast state.", 500);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const action = body?.action;

  try {
    if (action === "prepare") {
      const existing = await loadCampaign(auth.service);
      if (existing) return NextResponse.json({ campaign: existing, alreadyPrepared: true });

      const users = await listAllAuthUsers(auth.service);
      const preferences = await ensurePreferences(auth.service, users);
      const eligible = users.filter((user) => {
        const preference = preferences.get(user.id);
        return Boolean(user.email && user.email_confirmed_at && preference?.enabled !== false);
      });
      const sender = getBroadcastSender();

      const { data: campaign, error: campaignError } = await auth.service
        .from("member_email_campaigns")
        .insert({
          campaign_key: CAMPAIGN_KEY,
          subject: CAMPAIGN_SUBJECT,
          sender_email: sender,
          created_by: auth.userId,
          eligible_count: eligible.length,
        })
        .select("id, campaign_key, subject, status, sender_email, eligible_count, sent_count, failed_count, created_at, started_at, completed_at")
        .single<Campaign>();
      if (campaignError) throw campaignError;

      if (eligible.length > 0) {
        const rows = eligible.map((user) => ({
          campaign_id: campaign.id,
          user_id: user.id,
          email: user.email!,
        }));
        for (let start = 0; start < rows.length; start += 500) {
          const { error } = await auth.service
            .from("member_email_campaign_recipients")
            .insert(rows.slice(start, start + 500));
          if (error) throw error;
        }
      }

      return NextResponse.json({ campaign, alreadyPrepared: false });
    }

    if (action === "send_batch") {
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) return jsonError("Resend is not configured.", 503);

      const campaign = await loadCampaign(auth.service);
      if (!campaign) return jsonError("Prepare the campaign before sending.", 409);
      if (campaign.status === "sent") return NextResponse.json({ campaign, done: true, processed: 0 });

      const sender = getBroadcastSender();
      if (campaign.sender_email !== sender) {
        const { error: senderUpdateError } = await auth.service
          .from("member_email_campaigns")
          .update({ sender_email: sender, updated_at: new Date().toISOString() })
          .eq("id", campaign.id);
        if (senderUpdateError) throw senderUpdateError;
        campaign.sender_email = sender;
      }

      const now = new Date().toISOString();
      if (campaign.status === "prepared") {
        await auth.service
          .from("member_email_campaigns")
          .update({ status: "sending", started_at: now, updated_at: now })
          .eq("id", campaign.id);
      }

      const { data: recipients, error: recipientsError } = await auth.service
        .from("member_email_campaign_recipients")
        .select("user_id, email, attempt_count")
        .eq("campaign_id", campaign.id)
        .in("status", ["pending", "failed"])
        .lt("attempt_count", 3)
        .order("created_at", { ascending: true })
        .limit(BATCH_SIZE);
      if (recipientsError) throw recipientsError;

      let processed = 0;
      for (const recipient of recipients ?? []) {
        const { data: preference, error: preferenceError } = await auth.service
          .from("marketing_email_preferences")
          .select("enabled, unsubscribe_token")
          .eq("user_id", recipient.user_id)
          .maybeSingle<Pick<MarketingPreference, "enabled" | "unsubscribe_token">>();
        if (preferenceError) throw preferenceError;

        if (!preference?.enabled) {
          await auth.service
            .from("member_email_campaign_recipients")
            .update({ status: "suppressed", updated_at: new Date().toISOString() })
            .eq("campaign_id", campaign.id)
            .eq("user_id", recipient.user_id);
          processed += 1;
          continue;
        }

        const attemptCount = Number(recipient.attempt_count ?? 0) + 1;
        await auth.service
          .from("member_email_campaign_recipients")
          .update({ status: "sending", attempt_count: attemptCount, updated_at: new Date().toISOString() })
          .eq("campaign_id", campaign.id)
          .eq("user_id", recipient.user_id);

        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://loombus.com";
        const email = buildCampaignEmail(siteUrl, preference.unsubscribe_token);
        const result = await sendWithResend({
          apiKey,
          from: sender,
          to: recipient.email,
          html: email.html,
          text: email.text,
        });

        await auth.service
          .from("member_email_campaign_recipients")
          .update({
            status: result.ok ? "sent" : "failed",
            provider: "resend",
            provider_message_id: result.id,
            error_message: result.error,
            sent_at: result.ok ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          })
          .eq("campaign_id", campaign.id)
          .eq("user_id", recipient.user_id);
        processed += 1;
      }

      const { count: sentCount } = await auth.service
        .from("member_email_campaign_recipients")
        .select("user_id", { count: "exact", head: true })
        .eq("campaign_id", campaign.id)
        .eq("status", "sent");
      const { count: failedCount } = await auth.service
        .from("member_email_campaign_recipients")
        .select("user_id", { count: "exact", head: true })
        .eq("campaign_id", campaign.id)
        .eq("status", "failed");
      const { count: remainingCount } = await auth.service
        .from("member_email_campaign_recipients")
        .select("user_id", { count: "exact", head: true })
        .eq("campaign_id", campaign.id)
        .in("status", ["pending", "sending"]);
      const { count: retryableFailedCount } = await auth.service
        .from("member_email_campaign_recipients")
        .select("user_id", { count: "exact", head: true })
        .eq("campaign_id", campaign.id)
        .eq("status", "failed")
        .lt("attempt_count", 3);

      const done = (remainingCount ?? 0) === 0 && (retryableFailedCount ?? 0) === 0;
      const completedAt = done ? new Date().toISOString() : null;
      const finalStatus = done ? ((failedCount ?? 0) > 0 ? "failed" : "sent") : "sending";

      const { data: updatedCampaign, error: updateError } = await auth.service
        .from("member_email_campaigns")
        .update({
          status: finalStatus,
          sender_email: sender,
          sent_count: sentCount ?? 0,
          failed_count: failedCount ?? 0,
          completed_at: completedAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaign.id)
        .select("id, campaign_key, subject, status, sender_email, eligible_count, sent_count, failed_count, created_at, started_at, completed_at")
        .single<Campaign>();
      if (updateError) throw updateError;

      return NextResponse.json({ campaign: updatedCampaign, done, processed });
    }

    return jsonError("Unsupported action.", 400);
  } catch (error) {
    console.error("Member email broadcast action failed.", error);
    return jsonError("Member email broadcast action failed.", 500);
  }
}
