import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

type WelcomeEmailEventRow = {
  user_id: string;
  status: "sent" | "skipped" | "failed";
  sent_at: string | null;
  provider_message_id: string | null;
};

type ProfileRow = {
  username: string | null;
  full_name: string | null;
};

function getSupabaseForRequest(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authorization = request.headers.get("authorization") ?? "";

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment configuration.");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: authorization ? { Authorization: authorization } : {},
    },
  });
}

function getSupabaseServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildWelcomeEmail({
  siteUrl,
  displayName,
}: {
  siteUrl: string;
  displayName: string;
}) {
  const safeName = escapeHtml(displayName);
  const safeSiteUrl = escapeHtml(siteUrl);

  const subject = "Welcome to Loombus";

  const text = [
    `Welcome to Loombus, ${displayName}.`,
    "",
    "Loombus is built for high-signal discussions, thoughtful replies, and conversations worth returning to.",
    "",
    "Good first steps:",
    "- Complete your profile",
    "- Browse active discussions",
    "- Follow people whose contributions add signal",
    "- Start one focused discussion when you are ready",
    "",
    `Open Loombus: ${siteUrl}/dashboard`,
    `Manage notification settings: ${siteUrl}/profile`,
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111; max-width: 640px; margin: 0 auto;">
      <h1 style="font-size: 28px; margin-bottom: 12px;">Welcome to Loombus, ${safeName}.</h1>
      <p>Loombus is built for high-signal discussions, thoughtful replies, and conversations worth returning to.</p>

      <div style="margin: 24px 0; padding: 18px; border: 1px solid #ddd; border-radius: 14px;">
        <p style="margin-top: 0;"><strong>Good first steps:</strong></p>
        <ul>
          <li>Complete your profile.</li>
          <li>Browse active discussions.</li>
          <li>Follow people whose contributions add signal.</li>
          <li>Start one focused discussion when you are ready.</li>
        </ul>
      </div>

      <p>
        <a href="${safeSiteUrl}/dashboard" style="display: inline-block; background: #111; color: #fff; padding: 12px 18px; border-radius: 999px; text-decoration: none;">
          Open Loombus
        </a>
      </p>

      <p style="font-size: 13px; color: #666;">
        You can manage notification settings from your profile:
        <a href="${safeSiteUrl}/profile">${safeSiteUrl}/profile</a>
      </p>
    </div>
  `;

  return { subject, html, text };
}

async function sendEmailWithResend(args: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: args.from,
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
    }),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      ok: false,
      id: null,
      error:
        typeof result?.message === "string"
          ? result.message
          : `Resend returned HTTP ${response.status}.`,
    };
  }

  return {
    ok: true,
    id: typeof result?.id === "string" ? result.id : null,
    error: null,
  };
}

export async function POST(request: NextRequest) {
  let authSupabase;

  try {
    authSupabase = getSupabaseForRequest(request);
  } catch {
    return jsonError("Server configuration error.", 500);
  }

  const {
    data: { user },
    error: userError,
  } = await authSupabase.auth.getUser();

  if (userError || !user) {
    return jsonError("Unauthorized.", 401);
  }

  if (!user.email) {
    return jsonError("No deliverable email address.", 400);
  }

  const serviceSupabase = getSupabaseServiceClient();

  if (!serviceSupabase) {
    return jsonError("Welcome email service is not configured.", 503);
  }

  const { data: existingEvent, error: existingError } = await serviceSupabase
    .from("welcome_email_events")
    .select("user_id, status, sent_at, provider_message_id")
    .eq("user_id", user.id)
    .maybeSingle<WelcomeEmailEventRow>();

  if (existingError) {
    return jsonError("Unable to check welcome email status.", 500);
  }

  if (existingEvent?.status === "sent" || existingEvent?.status === "skipped") {
    return NextResponse.json({
      sent: false,
      skipped: true,
      status: existingEvent.status,
    });
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.PRODUCT_FROM_EMAIL || process.env.DIGEST_FROM_EMAIL;

  if (!resendApiKey || !fromEmail) {
    return jsonError("Welcome email provider is not configured.", 503);
  }

  const { data: profile } = await serviceSupabase
    .from("profiles")
    .select("username, full_name")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  const displayName =
    profile?.full_name?.trim() ||
    profile?.username?.trim() ||
    user.email.split("@")[0] ||
    "there";

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://loombus.com";

  const email = buildWelcomeEmail({ siteUrl, displayName });

  const sendResult = await sendEmailWithResend({
    apiKey: resendApiKey,
    from: fromEmail,
    to: user.email,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });

  if (!sendResult.ok) {
    await serviceSupabase.from("welcome_email_events").upsert(
      {
        user_id: user.id,
        email: user.email,
        status: "failed",
        provider: "resend",
        error_message: sendResult.error ?? "Unable to send welcome email.",
        sent_at: null,
      },
      { onConflict: "user_id" }
    );

    return jsonError("Unable to send welcome email.", 502);
  }

  const sentAt = new Date().toISOString();

  const { error: insertError } = await serviceSupabase
    .from("welcome_email_events")
    .upsert(
      {
        user_id: user.id,
        email: user.email,
        status: "sent",
        provider: "resend",
        provider_message_id: sendResult.id,
        error_message: null,
        sent_at: sentAt,
      },
      { onConflict: "user_id" }
    );

  if (insertError) {
    return jsonError("Welcome email sent, but delivery tracking failed.", 500);
  }

  return NextResponse.json({
    sent: true,
    skipped: false,
    status: "sent",
  });
}
