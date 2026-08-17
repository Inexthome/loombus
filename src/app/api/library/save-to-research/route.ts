import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const MIN_PASSAGE_CHARS = 20;
const MAX_PASSAGE_CHARS = 1200;

type PassageInput = {
  publicationId?: unknown;
  locator?: unknown;
  selectedText?: unknown;
  startOffset?: unknown;
  endOffset?: unknown;
  textSha256?: unknown;
};

function sha256Text(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function asNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
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
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );

    const { data: userResult, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userResult.user) {
      return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    }

    const body = await request.json();
    const passage = (body.passage ?? {}) as PassageInput;
    const publicationId = asNonEmptyString(passage.publicationId);
    const locator = asNonEmptyString(passage.locator);
    const selectedText = asNonEmptyString(passage.selectedText);
    const textSha256 = asNonEmptyString(passage.textSha256);
    const startOffset = asInteger(passage.startOffset);
    const endOffset = asInteger(passage.endOffset);

    if (!publicationId || !locator || !selectedText || !textSha256 || startOffset === null || endOffset === null) {
      return NextResponse.json({ error: "Passage context is incomplete." }, { status: 400 });
    }
    if (selectedText.length < MIN_PASSAGE_CHARS || selectedText.length > MAX_PASSAGE_CHARS) {
      return NextResponse.json({ error: `Select between ${MIN_PASSAGE_CHARS} and ${MAX_PASSAGE_CHARS} passage characters.` }, { status: 400 });
    }
    if (!/^[0-9a-f]{64}$/.test(textSha256) || startOffset < 0 || endOffset <= startOffset) {
      return NextResponse.json({ error: "Passage verification data is invalid." }, { status: 400 });
    }

    const [publicationResult, sectionResult] = await Promise.all([
      supabase.from("library_publications").select("id, status").eq("id", publicationId).single(),
      supabase
        .from("library_publication_sections")
        .select("section_key, content_text")
        .eq("publication_id", publicationId)
        .eq("section_key", locator)
        .single(),
    ]);

    if (publicationResult.error || !publicationResult.data || publicationResult.data.status !== "published") {
      return NextResponse.json({ error: "This publication is not available for research saves." }, { status: 404 });
    }
    if (sectionResult.error || !sectionResult.data) {
      return NextResponse.json({ error: "This passage chapter is no longer available." }, { status: 409 });
    }

    const sectionText = sectionResult.data.content_text as string;
    const canonicalHash = sha256Text(sectionText);
    if (canonicalHash !== textSha256) {
      return NextResponse.json({ error: "The chapter changed after this passage was selected. Select it again before saving." }, { status: 409 });
    }
    if (endOffset > sectionText.length || sectionText.slice(startOffset, endOffset) !== selectedText) {
      return NextResponse.json({ error: "The selected passage no longer matches this chapter. Select it again before saving." }, { status: 409 });
    }

    const { data, error: insertError } = await supabase
      .from("library_research_items")
      .insert({
        user_id: userResult.user.id,
        publication_id: publicationId,
        locator,
        selected_text: selectedText,
        start_offset: startOffset,
        end_offset: endOffset,
        text_sha256: textSha256,
      })
      .select("id, publication_id, locator, selected_text, start_offset, end_offset, text_sha256, created_at")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json({ saved: true, duplicate: true });
      }
      console.error("Library Save to Research insert failed:", insertError);
      return NextResponse.json({ error: "Unable to save this passage to Research." }, { status: 500 });
    }

    return NextResponse.json({ saved: true, duplicate: false, item: data });
  } catch (error) {
    console.error("Library Save to Research failed:", error);
    return NextResponse.json({ error: "Save to Research is temporarily unavailable." }, { status: 500 });
  }
}
