import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const MIN_SELECTION = 20;
const MAX_SELECTION = 4000;

type FeedbackKind = "claim" | "knowledge";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function integer(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
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

    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) {
      return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    }

    const body = await request.json();
    const kind = body.kind as FeedbackKind;
    const discussionId = text(body.discussionId);
    const selectedText = text(body.selectedText);
    const startOffset = integer(body.startOffset);
    const endOffset = integer(body.endOffset);
    const bodySha256 = text(body.bodySha256);

    if (!discussionId || !["claim", "knowledge"].includes(kind)) {
      return NextResponse.json({ error: "Discussion feedback request is incomplete." }, { status: 400 });
    }
    if (selectedText.length < MIN_SELECTION || selectedText.length > MAX_SELECTION) {
      return NextResponse.json({ error: `Select between ${MIN_SELECTION} and ${MAX_SELECTION} characters.` }, { status: 400 });
    }
    if (startOffset === null || endOffset === null || startOffset < 0 || endOffset <= startOffset) {
      return NextResponse.json({ error: "Selection range is invalid." }, { status: 400 });
    }
    if (!/^[0-9a-f]{64}$/.test(bodySha256)) {
      return NextResponse.json({ error: "Discussion text version is invalid." }, { status: 400 });
    }

    const { data: discussion, error: discussionError } = await supabase
      .from("discussions")
      .select("id, title, topic, body")
      .eq("id", discussionId)
      .single();

    if (discussionError || !discussion) {
      return NextResponse.json({ error: "This discussion is unavailable." }, { status: 404 });
    }

    const canonicalBody = String(discussion.body ?? "");
    const canonicalHash = sha256(canonicalBody);
    if (canonicalHash !== bodySha256) {
      return NextResponse.json({ error: "The discussion changed after you selected this text. Select it again." }, { status: 409 });
    }
    if (endOffset > canonicalBody.length || canonicalBody.slice(startOffset, endOffset) !== selectedText) {
      return NextResponse.json({ error: "The selected text no longer matches the discussion. Select it again." }, { status: 409 });
    }

    const userId = authData.user.id;
    const sourceTitle = String(discussion.title ?? "").trim();
    const sourceTopic = String(discussion.topic ?? "").trim();

    if (kind === "claim") {
      const statement = text(body.statement);
      const claimType = text(body.claimType) || "claim";
      const status = text(body.status) || "draft";
      const rationale = text(body.rationale);

      if (!statement || statement.length > 2000) {
        return NextResponse.json({ error: "Claim statement must be between 1 and 2000 characters." }, { status: 400 });
      }
      if (!["claim", "question", "conclusion"].includes(claimType)) {
        return NextResponse.json({ error: "Claim type is invalid." }, { status: 400 });
      }
      if (!["draft", "working", "supported", "contested"].includes(status)) {
        return NextResponse.json({ error: "Claim status is invalid." }, { status: 400 });
      }
      if (rationale.length > 5000) {
        return NextResponse.json({ error: "Claim rationale is too long." }, { status: 400 });
      }

      const { data: claim, error: claimError } = await supabase
        .from("library_research_claims")
        .insert({
          user_id: userId,
          statement,
          claim_type: claimType,
          status,
          rationale: rationale || null,
        })
        .select("id, statement, claim_type, status")
        .single();

      if (claimError || !claim) {
        return NextResponse.json({ error: "Unable to create the private Library claim." }, { status: 500 });
      }

      const { error: provenanceError } = await supabase
        .from("library_discussion_claim_derivations")
        .insert({
          user_id: userId,
          discussion_id: discussionId,
          claim_id: claim.id,
          source_discussion_title: sourceTitle,
          source_discussion_topic: sourceTopic,
          selected_text: selectedText,
          start_offset: startOffset,
          end_offset: endOffset,
          body_sha256: canonicalHash,
          derived_statement: claim.statement,
          derived_claim_type: claim.claim_type,
          derived_claim_status: claim.status,
        });

      if (provenanceError) {
        await supabase.from("library_research_claims").delete().eq("id", claim.id).eq("user_id", userId);
        return NextResponse.json({ error: "The claim was not saved because its discussion provenance could not be recorded." }, { status: 500 });
      }

      return NextResponse.json({ kind: "claim", id: claim.id });
    }

    const title = text(body.title);
    const summary = text(body.summary);
    const knowledgeType = text(body.knowledgeType) || "synthesis";
    const status = text(body.status) || "draft";

    if (!title || title.length > 160) {
      return NextResponse.json({ error: "Knowledge title must be between 1 and 160 characters." }, { status: 400 });
    }
    if (summary.length > 10000) {
      return NextResponse.json({ error: "Knowledge summary is too long." }, { status: 400 });
    }
    if (!["synthesis", "finding", "open_question"].includes(knowledgeType)) {
      return NextResponse.json({ error: "Knowledge type is invalid." }, { status: 400 });
    }
    if (!["draft", "working", "synthesized"].includes(status)) {
      return NextResponse.json({ error: "Knowledge status is invalid." }, { status: 400 });
    }

    const { data: knowledge, error: knowledgeError } = await supabase
      .from("library_knowledge_objects")
      .insert({
        user_id: userId,
        title,
        summary: summary || null,
        knowledge_type: knowledgeType,
        status,
      })
      .select("id, title, summary, knowledge_type, status")
      .single();

    if (knowledgeError || !knowledge) {
      return NextResponse.json({ error: "Unable to create the private Library knowledge object." }, { status: 500 });
    }

    const { error: provenanceError } = await supabase
      .from("library_discussion_knowledge_derivations")
      .insert({
        user_id: userId,
        discussion_id: discussionId,
        knowledge_object_id: knowledge.id,
        source_discussion_title: sourceTitle,
        source_discussion_topic: sourceTopic,
        selected_text: selectedText,
        start_offset: startOffset,
        end_offset: endOffset,
        body_sha256: canonicalHash,
        derived_title: knowledge.title,
        derived_summary: knowledge.summary,
        derived_knowledge_type: knowledge.knowledge_type,
        derived_knowledge_status: knowledge.status,
      });

    if (provenanceError) {
      await supabase.from("library_knowledge_objects").delete().eq("id", knowledge.id).eq("user_id", userId);
      return NextResponse.json({ error: "The knowledge object was not saved because its discussion provenance could not be recorded." }, { status: 500 });
    }

    return NextResponse.json({ kind: "knowledge", id: knowledge.id });
  } catch (error) {
    console.error("Library discussion feedback create failed:", error);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}
