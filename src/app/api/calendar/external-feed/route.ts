import { NextRequest, NextResponse } from "next/server";
import {
  createCalendarFeedServiceClient,
  createCalendarFeedToken,
} from "@/lib/calendar-feed-credentials";
import { getResolvedGeneralSubscriptionForUser } from "@/lib/general-subscriptions";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";
import { createRequestSupabase } from "@/lib/room-operations";
import { evaluateSubscriptionEntitlement } from "@/lib/subscription-entitlements";

type AccountContext =
  | {
      ok: true;
      userId: string;
      isAdmin: boolean;
    }
  | {
      ok: false;
      response: NextResponse;
    };

type CredentialMetadataRow = {
  token_hint: string;
  created_at: string;
  updated_at: string;
  revoked_at: string | null;
};

function json(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function errorJson(message: string, status: number) {
  return json({ error: message }, status);
}

function credentialMetadata(row: CredentialMetadataRow | null) {
  if (!row) return null;

  return {
    tokenHint: row.token_hint,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    revokedAt: row.revoked_at,
  };
}

async function getAccountContext(request: NextRequest): Promise<AccountContext> {
  let requestClient;

  try {
    requestClient = createRequestSupabase(request);
  } catch {
    return {
      ok: false,
      response: errorJson("Server configuration error.", 500),
    };
  }

  const access = await verifyRequestAccountAccess(requestClient);
  if (!access.ok) {
    return {
      ok: false,
      response: errorJson(access.error, access.status),
    };
  }

  return {
    ok: true,
    userId: access.user.id,
    isAdmin: Boolean(access.profile.is_admin),
  };
}

async function canUseExternalCalendarSync(userId: string, isAdmin: boolean) {
  if (isAdmin) return true;

  const subscription = await getResolvedGeneralSubscriptionForUser(userId);
  return evaluateSubscriptionEntitlement(
    subscription.plan,
    "external_calendar_sync"
  ).allowed;
}

export async function GET(request: NextRequest) {
  const context = await getAccountContext(request);
  if (!context.ok) return context.response;

  try {
    const service = createCalendarFeedServiceClient();
    const [{ data, error }, entitlement] = await Promise.all([
      service
        .from("calendar_feed_credentials")
        .select("token_hint, created_at, updated_at, revoked_at")
        .eq("user_id", context.userId)
        .maybeSingle(),
      canUseExternalCalendarSync(context.userId, context.isAdmin)
        .then((allowed) => ({ available: true as const, allowed }))
        .catch((error) => {
          console.error("Unable to resolve calendar-sync entitlement:", error);
          return { available: false as const, allowed: false };
        }),
    ]);

    if (error) {
      return errorJson("Calendar feed storage is unavailable.", 503);
    }

    const credential = (data ?? null) as CredentialMetadataRow | null;
    return json({
      canUseExternalCalendarSync: entitlement.allowed,
      entitlementAvailable: entitlement.available,
      configured: Boolean(credential && !credential.revoked_at),
      credential: credentialMetadata(credential),
    });
  } catch (error) {
    console.error("Unable to load calendar-feed credential:", error);
    return errorJson("Calendar feed storage is unavailable.", 503);
  }
}

export async function POST(request: NextRequest) {
  const context = await getAccountContext(request);
  if (!context.ok) return context.response;

  let allowed = false;
  try {
    allowed = await canUseExternalCalendarSync(context.userId, context.isAdmin);
  } catch (error) {
    console.error("Unable to resolve calendar-sync entitlement:", error);
    return errorJson("Unable to verify calendar-sync access.", 503);
  }

  if (!allowed) {
    return errorJson("Premium Pro is required for external calendar sync.", 403);
  }

  const body = await request.json().catch(() => null);
  const action =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>).action
      : null;

  if (action !== "generate" && action !== "rotate") {
    return errorJson("Choose generate or rotate for the calendar feed.", 400);
  }

  try {
    const service = createCalendarFeedServiceClient();
    const { data: existing, error: existingError } = await service
      .from("calendar_feed_credentials")
      .select("created_at")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (existingError) {
      return errorJson("Calendar feed storage is unavailable.", 503);
    }

    const generated = createCalendarFeedToken();
    const now = new Date().toISOString();
    const { data, error } = await service
      .from("calendar_feed_credentials")
      .upsert(
        {
          user_id: context.userId,
          token_hash: generated.tokenHash,
          token_hint: generated.tokenHint,
          created_at: existing?.created_at ?? now,
          updated_at: now,
          revoked_at: null,
        },
        { onConflict: "user_id" }
      )
      .select("token_hint, created_at, updated_at, revoked_at")
      .single();

    if (error || !data) {
      return errorJson("Unable to create the private calendar feed.", 503);
    }

    return json(
      {
        canUseExternalCalendarSync: true,
        entitlementAvailable: true,
        configured: true,
        token: generated.token,
        tokenShownOnce: true,
        feedReady: false,
        credential: credentialMetadata(data as CredentialMetadataRow),
      },
      existing ? 200 : 201
    );
  } catch (error) {
    console.error("Unable to create calendar-feed credential:", error);
    return errorJson("Unable to create the private calendar feed.", 503);
  }
}

export async function DELETE(request: NextRequest) {
  const context = await getAccountContext(request);
  if (!context.ok) return context.response;

  try {
    const service = createCalendarFeedServiceClient();
    const now = new Date().toISOString();
    const { data, error } = await service
      .from("calendar_feed_credentials")
      .update({ revoked_at: now, updated_at: now })
      .eq("user_id", context.userId)
      .select("token_hint, created_at, updated_at, revoked_at")
      .maybeSingle();

    if (error) {
      return errorJson("Unable to revoke the private calendar feed.", 503);
    }

    return json({
      configured: false,
      revoked: Boolean(data),
      credential: credentialMetadata((data ?? null) as CredentialMetadataRow | null),
    });
  } catch (error) {
    console.error("Unable to revoke calendar-feed credential:", error);
    return errorJson("Unable to revoke the private calendar feed.", 503);
  }
}
