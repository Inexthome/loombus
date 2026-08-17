import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const MIN_PASSAGE_CHARS = 20;
const MAX_PASSAGE_CHARS = 1200;
const MAX_COMMENTARY_CHARS = 2500;

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
      { global: { headers: { Authorization: `Bearer ${token}` } } }
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
    const title = asNonEmptyString(body.title);
    const topic = asNonEmptyString(body.topic);
    const commentary = asNonEmptyString(body.commentary);

    if (!publicationId || !locator || !selectedText || !textSha256 || startOffset === null || endOffset === null) {
      return NextResponse.json({ error: "Passage context is incomplete." }, { status: 400 });
    }
    if (!title || !topic || !commentary) {
      return NextResponse.json({ error: "Add a title, topic, and discussion framing." }, { status: 400 });
    }
    if (selectedText.length < MIN_PASSAGE_CHARS || selectedText.length > MAX_PASSAGE_CHARS) {
      return NextResponse.json({ error: `Select between ${MIN_PASSAGE_CHARS} and ${MAX_PASSAGE_CHARS} passage characters.` }, { status: 400 });
    }
    if (commentary.length > MAX_COMMENTARY_CHARS) {
      return NextResponse.json({ error: `Discussion framing is limited to ${MAX_COMMENTARY_CHARS} characters.` }, { status: 400 });
    }
    if (!/^[0-9a-f]{64}$/.test(textSha256)) {
      return NextResponse.json({ error: "Passage text version is invalid." }, { status: 400 });
    }
    if (startOffset < 0 || endOffset <= startOffset) {
      return NextResponse.json({ error: "Passage range is invalid." }, { status: 400 });
    }

    const [publicationResult, sectionResult] = await Promise.all([
      supabase
        .from("library_publications")
        .select("id, title, author_name, status")
        .eq("id", publicationId)
        .single(),
      supabase
        .from("library_publication_sections")
        .select("section_key, title, content_text")
        .eq("publication_id", publicationId)
        .eq("section_key", locator)
        .single(),
    ]);

    if (publicationResult.error || !publicationResult.data || publicationResult.data.status !== "published") {
      return NextResponse.json({ error: "This publication is not available for passage discussion." }, { status: 404 });
    }
    if (sectionResult.error || !sectionResult.data) {
      return NextResponse.json({ error: "This passage chapter is no longer available." }, { status: 409 });
    }

    const sectionText = sectionResult.data.content_text as string;
    const canonicalHash = sha256Text(sectionText);
    if (canonicalHash !== textSha256) {
      return NextResponse.json({ error: "The chapter changed after this passage was selected. Select it again before discussing." }, { status: 409 });
    }
    if (endOffset > sectionText.length || sectionText.slice(startOffset, endOffset) !== selectedText) {
      return NextResponse.json({ error: "The selected passage no longer matches this chapter. Select it again before discussing." }, { status: 409 });
    }

    const publicationTitle = publicationResult.data.title as string;
    const authorName = publicationResult.data.author_name as string | null;
    const sectionTitle = (sectionResult.data.title as string | null) ?? "Current chapter";
    const attribution = authorName ? `${publicationTitle} by ${authorName}` : publicationTitle;
    const discussionBody = [
      `Passage from ${attribution} — ${sectionTitle}:`,
      "",
      `“${selectedText}”`,
      "",
      commentary,
    ].join("\n");

    const createResponse = await fetch(new URL("/api/discussions/create", request.url), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title,
        topic,
        discussionType: "open_discussion",
        discussionMetadata: {
          purpose: "Discuss a selected Loombus Library passage.",
          framing: "open_discussion",
        },
        body: discussionBody,
        tags: [],
      }),
    });

    const createResult = await createResponse.json().catch(() => ({}));
    if (!createResponse.ok) {
      return NextResponse.json(createResult, { status: createResponse.status });
    }

    const discussionId = createResult.discussion?.id as string | undefined;
    if (!discussionId) {
      return NextResponse.json({ error: "Discussion was created, but Loombus could not bind the selected passage." }, { status: 500 });
    }

    const { error: provenanceError } = await supabase
      .from("library_passage_discussions")
      .insert({
        user_id: userResult.user.id,
        discussion_id: discussionId,
        publication_id: publicationId,
        locator,
        selected_text: selectedText,
        start_offset: startOffset,
        end_offset: endOffset,
        text_sha256: canonicalHash,
      });

    if (provenanceError) {
      console.error("Library passage provenance save failed:", provenanceError.message);
      return NextResponse.json(
        {
          error: "Discussion was created, but the Library passage link could not be saved.",
          code: "library_passage_link_failed",
          discussionId,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ discussion: createResult.discussion, passageLinked: true });
  } catch (error) {
    console.error("Library Discuss Passage create failed:", error);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}
