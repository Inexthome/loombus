import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const MAX_SELECTED_CLAIMS = 20;

type SelectedClaimInput = {
  id?: unknown;
  statement?: unknown;
  claimType?: unknown;
  status?: unknown;
  role?: unknown;
};

function asNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isAllowedTopic(value: string) {
  return value !== "Other";
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const token = authHeader.slice("Bearer ".length);
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: userResult, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userResult.user) {
      return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    }

    const body = await request.json();
    const knowledgeObjectId = asNonEmptyString(body.knowledgeObjectId);
    const sourceUpdatedAt = asNonEmptyString(body.sourceUpdatedAt);
    const topic = asNonEmptyString(body.topic);
    const selectedClaims = Array.isArray(body.selectedClaims)
      ? (body.selectedClaims as SelectedClaimInput[])
      : [];

    if (!knowledgeObjectId || !sourceUpdatedAt || !topic) {
      return NextResponse.json(
        { error: "Knowledge object, source version, and topic are required." },
        { status: 400 }
      );
    }
    if (!isAllowedTopic(topic)) {
      return NextResponse.json(
        { error: "Choose a specific discussion topic for knowledge promotion." },
        { status: 400 }
      );
    }
    if (selectedClaims.length > MAX_SELECTED_CLAIMS) {
      return NextResponse.json(
        { error: `Select no more than ${MAX_SELECTED_CLAIMS} claims.` },
        { status: 400 }
      );
    }

    const { data: knowledge, error: knowledgeError } = await supabase
      .from("library_knowledge_objects")
      .select("id, user_id, title, summary, knowledge_type, status, updated_at")
      .eq("id", knowledgeObjectId)
      .eq("user_id", userResult.user.id)
      .single();

    if (knowledgeError || !knowledge) {
      return NextResponse.json({ error: "Knowledge object not found." }, { status: 404 });
    }
    if (knowledge.updated_at !== sourceUpdatedAt) {
      return NextResponse.json(
        {
          error: "This knowledge object changed after you opened the promotion review. Review it again before publishing.",
          code: "knowledge_version_changed",
        },
        { status: 409 }
      );
    }

    const summary = (knowledge.summary as string | null)?.trim() || null;
    const { data: readinessMemberships, error: readinessMembershipError } = await supabase
      .from("library_knowledge_claims")
      .select("claim_id")
      .eq("knowledge_object_id", knowledgeObjectId);

    if (readinessMembershipError) {
      return NextResponse.json({ error: "Unable to verify knowledge promotion readiness." }, { status: 500 });
    }

    const readinessClaimIds = [...new Set((readinessMemberships ?? []).map((row) => row.claim_id as string))];
    if (knowledge.status !== "synthesized" || !summary || readinessClaimIds.length === 0) {
      return NextResponse.json(
        {
          error: "Finish synthesizing this knowledge object, add a summary, and link at least one claim before promotion.",
          code: "knowledge_not_ready",
        },
        { status: 409 }
      );
    }

    const { data: readinessEvidence, error: readinessEvidenceError } = await supabase
      .from("library_research_claim_evidence")
      .select("claim_id")
      .in("claim_id", readinessClaimIds)
      .limit(1);

    if (readinessEvidenceError) {
      return NextResponse.json({ error: "Unable to verify evidence-backed knowledge readiness." }, { status: 500 });
    }
    if (!(readinessEvidence ?? []).length) {
      return NextResponse.json(
        {
          error: "At least one linked claim needs explicit evidence before this knowledge object can be promoted.",
          code: "knowledge_not_evidence_backed",
        },
        { status: 409 }
      );
    }

    const requestedById = new Map<string, Required<SelectedClaimInput>>();
    for (const raw of selectedClaims) {
      const id = asNonEmptyString(raw.id);
      const statement = asNonEmptyString(raw.statement);
      const claimType = asNonEmptyString(raw.claimType);
      const status = asNonEmptyString(raw.status);
      const role = asNonEmptyString(raw.role);
      if (!id || !statement || !claimType || !status || !role || requestedById.has(id)) {
        return NextResponse.json({ error: "Selected claim snapshot is invalid." }, { status: 400 });
      }
      requestedById.set(id, { id, statement, claimType, status, role });
    }

    let approvedClaims: Array<{
      id: string;
      statement: string;
      claim_type: string;
      status: string;
      role: string;
    }> = [];

    if (requestedById.size) {
      const ids = Array.from(requestedById.keys());
      const { data: memberships, error: membershipError } = await supabase
        .from("library_knowledge_claims")
        .select("claim_id, role")
        .eq("knowledge_object_id", knowledgeObjectId)
        .in("claim_id", ids);

      const { data: claims, error: claimError } = await supabase
        .from("library_research_claims")
        .select("id, statement, claim_type, status")
        .eq("user_id", userResult.user.id)
        .in("id", ids);

      if (membershipError || claimError) {
        return NextResponse.json({ error: "Unable to verify selected claims." }, { status: 500 });
      }

      const roleByClaimId = new Map(
        (memberships ?? []).map((row) => [row.claim_id as string, row.role as string])
      );
      const claimById = new Map((claims ?? []).map((row) => [row.id as string, row]));

      approvedClaims = ids.map((id) => {
        const requested = requestedById.get(id)!;
        const current = claimById.get(id);
        const role = roleByClaimId.get(id);
        if (
          !current ||
          !role ||
          current.statement !== requested.statement ||
          current.claim_type !== requested.claimType ||
          current.status !== requested.status ||
          role !== requested.role
        ) {
          throw new Error("SELECTED_CLAIM_VERSION_CHANGED");
        }
        return {
          id,
          statement: current.statement as string,
          claim_type: current.claim_type as string,
          status: current.status as string,
          role,
        };
      });
    }

    const discussionBodyParts: string[] = [summary];
    if (approvedClaims.length) {
      discussionBodyParts.push(
        "Selected claims:",
        ...approvedClaims.map((claim) => `• ${claim.statement}`)
      );
    }
    discussionBodyParts.push(
      "Shared from a private Loombus Library knowledge workspace. Private research notes, evidence links, and saved passages are not included."
    );

    const createResponse = await fetch(new URL("/api/discussions/create", request.url), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: knowledge.title,
        topic,
        discussionType: "open_discussion",
        discussionMetadata: {
          purpose: "Discuss a member-approved Library knowledge synthesis.",
          framing: "open_discussion",
        },
        body: discussionBodyParts.join("\n\n"),
        tags: [],
      }),
    });

    const createResult = await createResponse.json().catch(() => ({}));
    if (!createResponse.ok) {
      return NextResponse.json(createResult, { status: createResponse.status });
    }

    const discussionId = createResult.discussion?.id as string | undefined;
    if (!discussionId) {
      return NextResponse.json(
        { error: "Discussion was created, but Loombus could not record knowledge promotion provenance." },
        { status: 500 }
      );
    }

    const promotionResult = await supabase
      .from("library_knowledge_discussion_promotions")
      .insert({
        user_id: userResult.user.id,
        knowledge_object_id: knowledge.id,
        discussion_id: discussionId,
        published_title: knowledge.title,
        published_summary: knowledge.summary,
        source_knowledge_type: knowledge.knowledge_type,
        source_knowledge_status: knowledge.status,
        source_updated_at: knowledge.updated_at,
      })
      .select("id")
      .single();

    if (promotionResult.error || !promotionResult.data) {
      console.error(
        "Library knowledge promotion provenance save failed:",
        promotionResult.error?.message
      );
      return NextResponse.json(
        {
          error: "Discussion was created, but its private knowledge provenance could not be saved.",
          code: "library_knowledge_promotion_link_failed",
          discussionId,
        },
        { status: 500 }
      );
    }

    if (approvedClaims.length) {
      const { error: snapshotError } = await supabase
        .from("library_knowledge_discussion_claims")
        .insert(
          approvedClaims.map((claim) => ({
            promotion_id: promotionResult.data.id,
            claim_id: claim.id,
            published_statement: claim.statement,
            published_claim_type: claim.claim_type,
            published_claim_status: claim.status,
            published_role: claim.role,
          }))
        );

      if (snapshotError) {
        console.error(
          "Library knowledge promotion claim snapshots failed:",
          snapshotError.message
        );
        return NextResponse.json(
          {
            error: "Discussion was created, but selected-claim provenance could not be fully saved.",
            code: "library_knowledge_promotion_claims_failed",
            discussionId,
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      discussion: createResult.discussion,
      knowledgePromotionLinked: true,
      publishedClaimCount: approvedClaims.length,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "SELECTED_CLAIM_VERSION_CHANGED") {
      return NextResponse.json(
        {
          error: "A selected claim changed after you opened the promotion review. Review it again before publishing.",
          code: "selected_claim_version_changed",
        },
        { status: 409 }
      );
    }
    console.error("Library knowledge discussion promotion failed:", error);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}
