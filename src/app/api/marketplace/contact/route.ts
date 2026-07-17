import { NextRequest, NextResponse } from "next/server";
import { getAccountEnforcementResult } from "@/lib/account-enforcement";
import { logAuditEvent } from "@/lib/audit-log";
import { createNotification } from "@/lib/notifications";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";
import {
  createRequestSupabase,
  createRoomServiceSupabase,
} from "@/lib/room-operations";
import { MarketplaceError, cleanUuid } from "@/lib/marketplace-server-core";
import { findPublicMarketplaceListingById } from "@/lib/marketplace-public-server";

const CONTACT_COOLDOWN_SECONDS = 5;

type SensitiveProfile = {
  age_band: string | null;
  teen_safety_mode: boolean | null;
  guardian_required: boolean | null;
};

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json(code ? { error: message, code } : { error: message }, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function ageRestriction(profile: SensitiveProfile | null, role: "buyer" | "seller") {
  const ageBand = profile?.age_band ?? "unknown";
  if (ageBand === "under_13" || profile?.guardian_required) {
    return {
      code: "under_13_not_allowed",
      message: "Loombus is not available to children under 13.",
    };
  }
  if (ageBand === "unknown") {
    return {
      code: role === "buyer" ? "age_gate_required" : "seller_age_gate_required",
      message:
        role === "buyer"
          ? "Complete age safety before contacting a Marketplace seller."
          : "This seller must complete age safety before private messages can start.",
    };
  }
  return null;
}

async function findExistingConversation(
  service: ReturnType<typeof createRoomServiceSupabase>,
  buyerId: string,
  sellerId: string
) {
  const { data: buyerMemberships, error } = await service
    .from("private_conversation_members")
    .select("conversation_id")
    .eq("user_id", buyerId)
    .is("deleted_at", null);
  if (error) throw error;

  const ids = [
    ...new Set(
      (buyerMemberships ?? []).map((row: { conversation_id?: string | null }) =>
        String(row.conversation_id ?? "")
      )
    ),
  ].filter(Boolean);
  if (ids.length === 0) return null;

  const { data } = await service
    .from("private_conversation_members")
    .select("conversation_id")
    .eq("user_id", sellerId)
    .in("conversation_id", ids)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  return data?.conversation_id ? String(data.conversation_id) : null;
}

export async function POST(request: NextRequest) {
  try {
    const requestClient = createRequestSupabase(request);
    const access = await verifyRequestAccountAccess(requestClient);
    if (!access.ok) return jsonError(access.error, access.status, access.code);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonError("Invalid Marketplace contact request.", 400);
    }

    const listingId = cleanUuid(
      (body as Record<string, unknown>).listingId,
      "listing id"
    );
    const listing = await findPublicMarketplaceListingById(listingId);
    if (!listing) return jsonError("Listing not found.", 404, "listing_not_found");
    if (listing.sellerId === access.user.id) {
      return jsonError("You cannot contact yourself about your own listing.", 400);
    }

    const service = createRoomServiceSupabase();
    const [sellerBaseResult, buyerSensitiveResult, sellerSensitiveResult, blockResult] =
      await Promise.all([
        service
          .from("profiles")
          .select(
            "id, full_name, username, account_status, enforcement_reason, suspended_until"
          )
          .eq("id", listing.sellerId)
          .maybeSingle(),
        service
          .from("profile_sensitive")
          .select("age_band, teen_safety_mode, guardian_required")
          .eq("id", access.user.id)
          .maybeSingle(),
        service
          .from("profile_sensitive")
          .select("age_band, teen_safety_mode, guardian_required")
          .eq("id", listing.sellerId)
          .maybeSingle(),
        service
          .from("user_blocks")
          .select("id")
          .or(
            `and(blocker_id.eq.${access.user.id},blocked_id.eq.${listing.sellerId}),and(blocker_id.eq.${listing.sellerId},blocked_id.eq.${access.user.id})`
          )
          .limit(1),
      ]);

    const sellerBase = sellerBaseResult.data;
    if (!sellerBase || !getAccountEnforcementResult(sellerBase).allowed) {
      return jsonError("You cannot message this seller.", 403);
    }
    if ((blockResult.data ?? []).length > 0) {
      return jsonError("You cannot message this seller.", 403);
    }

    const buyerRestriction = ageRestriction(
      (buyerSensitiveResult.data ?? null) as SensitiveProfile | null,
      "buyer"
    );
    if (buyerRestriction) {
      return jsonError(buyerRestriction.message, 403, buyerRestriction.code);
    }
    const sellerRestriction = ageRestriction(
      (sellerSensitiveResult.data ?? null) as SensitiveProfile | null,
      "seller"
    );
    if (sellerRestriction) {
      return jsonError(sellerRestriction.message, 403, sellerRestriction.code);
    }

    const { data: existingContact } = await service
      .from("marketplace_contact_threads")
      .select("conversation_id")
      .eq("listing_id", listing.id)
      .eq("buyer_id", access.user.id)
      .maybeSingle();

    if (existingContact?.conversation_id) {
      await service
        .from("private_conversation_members")
        .update({ deleted_at: null, archived_at: null })
        .eq("conversation_id", existingContact.conversation_id)
        .in("user_id", [access.user.id, listing.sellerId]);

      return NextResponse.json({
        conversationId: existingContact.conversation_id,
        created: false,
      });
    }

    const cooldownSince = new Date(
      Date.now() - CONTACT_COOLDOWN_SECONDS * 1000
    ).toISOString();
    const { data: recentAction } = await service
      .from("action_rate_events")
      .select("id")
      .eq("user_id", access.user.id)
      .eq("action_key", "marketplace_contact")
      .gte("created_at", cooldownSince)
      .limit(1)
      .maybeSingle();
    if (recentAction) {
      return jsonError("Please wait before contacting another seller.", 429);
    }

    await service.from("action_rate_events").insert({
      user_id: access.user.id,
      action_key: "marketplace_contact",
      target_id: listing.id,
    });

    let conversationId = await findExistingConversation(
      service,
      access.user.id,
      listing.sellerId
    );
    const now = new Date().toISOString();

    if (!conversationId) {
      const { data: conversation, error: conversationError } = await service
        .from("private_conversations")
        .insert({ created_by: access.user.id, updated_at: now })
        .select("id")
        .single();
      if (conversationError || !conversation) {
        return jsonError(
          conversationError?.message ?? "Unable to start the conversation.",
          500
        );
      }
      conversationId = String(conversation.id);

      const { error: memberError } = await service
        .from("private_conversation_members")
        .insert([
          { conversation_id: conversationId, user_id: access.user.id },
          { conversation_id: conversationId, user_id: listing.sellerId },
        ]);
      if (memberError) return jsonError(memberError.message, 500);
    }

    const { data: contactThread, error: contactError } = await service
      .from("marketplace_contact_threads")
      .insert({
        listing_id: listing.id,
        buyer_id: access.user.id,
        seller_id: listing.sellerId,
        conversation_id: conversationId,
      })
      .select("id")
      .single();

    if (contactError || !contactThread) {
      const { data: racedContact } = await service
        .from("marketplace_contact_threads")
        .select("conversation_id")
        .eq("listing_id", listing.id)
        .eq("buyer_id", access.user.id)
        .maybeSingle();
      if (racedContact?.conversation_id) {
        return NextResponse.json({
          conversationId: racedContact.conversation_id,
          created: false,
        });
      }
      return jsonError(contactError?.message ?? "Unable to save the inquiry.", 500);
    }

    const listingUrl = `https://loombus.com/marketplace/${listing.slug}`;
    const messageBody = `Marketplace inquiry: ${listing.title}\n${listingUrl}`;
    const { data: message, error: messageError } = await service
      .from("private_messages")
      .insert({
        conversation_id: conversationId,
        sender_id: access.user.id,
        message_type: "text",
        body: messageBody,
        created_at: now,
      })
      .select("id")
      .single();
    if (messageError || !message) {
      await service
        .from("marketplace_contact_threads")
        .delete()
        .eq("id", contactThread.id);
      return jsonError(messageError?.message ?? "Unable to send the inquiry.", 500);
    }

    await Promise.all([
      service
        .from("private_conversations")
        .update({ updated_at: now, last_message_at: now })
        .eq("id", conversationId),
      service
        .from("private_conversation_members")
        .update({ deleted_at: null, archived_at: null })
        .eq("conversation_id", conversationId)
        .in("user_id", [access.user.id, listing.sellerId]),
    ]);

    const { data: buyerProfile } = await service
      .from("profiles")
      .select("full_name, username")
      .eq("id", access.user.id)
      .maybeSingle();
    const buyerName =
      buyerProfile?.full_name?.trim() ||
      buyerProfile?.username?.trim() ||
      "A Loombus member";

    const { data: sellerMembership } = await service
      .from("private_conversation_members")
      .select("muted_at")
      .eq("conversation_id", conversationId)
      .eq("user_id", listing.sellerId)
      .maybeSingle();

    if (!sellerMembership?.muted_at) {
      await createNotification({
        user_id: listing.sellerId,
        actor_id: access.user.id,
        type: "new_message",
        target_type: "conversation",
        target_id: conversationId,
        message: `${buyerName} asked about “${listing.title}.”`,
      });
    }

    await logAuditEvent({
      actor_id: access.user.id,
      action: "marketplace.seller_contacted",
      target_type: "marketplace_listing",
      target_id: listing.id,
      metadata: {
        seller_id: listing.sellerId,
        conversation_id: conversationId,
        message_id: message.id,
      },
    });

    return NextResponse.json({ conversationId, created: true });
  } catch (error) {
    if (error instanceof MarketplaceError) {
      return jsonError(error.message, error.status, error.code);
    }
    console.error("Marketplace seller contact failed:", error);
    return jsonError(
      error instanceof Error ? error.message : "Unable to contact the seller.",
      500
    );
  }
}
