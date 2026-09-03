import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

type ResendEmailEvent = {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string[];
    subject?: string;
    bounce?: { message?: string; type?: string; subType?: string };
  };
};

const MAX_WEBHOOK_AGE_SECONDS = 300;

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function getHeader(request: NextRequest, svixName: string, webhookName: string) {
  return request.headers.get(svixName) || request.headers.get(webhookName);
}

function verifyWebhook(payload: string, request: NextRequest, secret: string) {
  const id = getHeader(request, "svix-id", "webhook-id");
  const timestamp = getHeader(request, "svix-timestamp", "webhook-timestamp");
  const signatureHeader = getHeader(request, "svix-signature", "webhook-signature");
  if (!id || !timestamp || !signatureHeader) return false;

  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - timestampNumber) > MAX_WEBHOOK_AGE_SECONDS) return false;

  const encodedSecret = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  let key: Buffer;
  try {
    key = Buffer.from(encodedSecret, "base64");
  } catch {
    return false;
  }

  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${payload}`)
    .digest();

  return signatureHeader.split(" ").some((candidate) => {
    const [version, value] = candidate.split(",", 2);
    if (version !== "v1" || !value) return false;
    try {
      const actual = Buffer.from(value, "base64");
      return actual.length === expected.length && timingSafeEqual(actual, expected);
    } catch {
      return false;
    }
  });
}

function suppressionKind(type: string) {
  if (type === "email.bounced") return "bounce" as const;
  if (type === "email.complained") return "complaint" as const;
  if (type === "email.suppressed") return "provider_suppression" as const;
  return null;
}

function eventDetail(event: ResendEmailEvent) {
  if (event.type === "email.bounced") {
    const bounce = event.data?.bounce;
    return [bounce?.type, bounce?.subType, bounce?.message].filter(Boolean).join(" · ") || "Email bounced.";
  }
  if (event.type === "email.complained") return "Recipient reported the message as spam.";
  if (event.type === "email.suppressed") return "Resend suppressed delivery to this address.";
  return null;
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  const service = getServiceClient();
  if (!webhookSecret || !service) {
    return NextResponse.json({ error: "Webhook service is not configured." }, { status: 503 });
  }

  const payload = await request.text();
  if (!verifyWebhook(payload, request, webhookSecret)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let event: ResendEmailEvent;
  try {
    event = JSON.parse(payload) as ResendEmailEvent;
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  const kind = suppressionKind(event.type || "");
  if (!kind) return NextResponse.json({ ok: true, ignored: true });

  const email = event.data?.to?.[0]?.trim().toLowerCase();
  const providerMessageId = event.data?.email_id || null;
  const providerEventId = getHeader(request, "svix-id", "webhook-id");
  if (!email || !providerEventId) {
    return NextResponse.json({ error: "Webhook recipient is missing." }, { status: 400 });
  }

  const { data: recipient, error: recipientError } = providerMessageId
    ? await service
        .from("member_email_campaign_recipients")
        .select("campaign_id,user_id")
        .eq("provider_message_id", providerMessageId)
        .maybeSingle()
    : { data: null, error: null };
  if (recipientError) {
    console.error("Unable to resolve Resend recipient.", recipientError);
    return NextResponse.json({ error: "Unable to resolve webhook recipient." }, { status: 500 });
  }

  const occurredAt = event.created_at || new Date().toISOString();
  const detail = eventDetail(event);
  const { error: suppressionError } = await service
    .from("email_delivery_suppressions")
    .upsert(
      {
        user_id: recipient?.user_id || null,
        email,
        kind,
        source: "resend_webhook",
        provider: "resend",
        provider_event_id: providerEventId,
        provider_message_id: providerMessageId,
        campaign_id: recipient?.campaign_id || null,
        detail,
        occurred_at: occurredAt,
        active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "provider_event_id", ignoreDuplicates: true }
    );
  if (suppressionError) {
    console.error("Unable to persist Resend suppression.", suppressionError);
    return NextResponse.json({ error: "Unable to persist webhook event." }, { status: 500 });
  }

  if (recipient?.campaign_id && recipient?.user_id) {
    await service
      .from("member_email_campaign_recipients")
      .update({
        status: "suppressed",
        error_message: detail,
        updated_at: new Date().toISOString(),
      })
      .eq("campaign_id", recipient.campaign_id)
      .eq("user_id", recipient.user_id);
  }

  if (kind === "complaint" && recipient?.user_id) {
    await service
      .from("marketing_email_preferences")
      .update({
        enabled: false,
        unsubscribed_at: occurredAt,
        unsubscribe_source: "provider",
        unsubscribed_campaign_id: recipient.campaign_id || null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", recipient.user_id);
  }

  return NextResponse.json({ ok: true });
}
