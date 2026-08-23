import "server-only";

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { parseEpubBuffer } from "@/lib/library/epub-parser";
import { sha256Hex } from "@/lib/library/epub-validation";

export const runtime = "nodejs";

function createRequestSupabase(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("library_epub_request_config_missing");

  const authorization = request.headers.get("authorization") ?? "";
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: authorization ? { Authorization: authorization } : {} },
  });
}

type BeginRow = {
  publication_id: string;
  storage_bucket: string;
  storage_path: string;
  byte_size: number;
  sha256: string;
};

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message.slice(0, 1000);
  }
  return error instanceof Error ? error.message.slice(0, 1000) : "library_epub_ingestion_failed";
}

export async function POST(request: NextRequest) {
  let sourceId: string | null = null;
  let routeToken: string | null = null;
  let begun = false;
  let supabase: ReturnType<typeof createRequestSupabase> | null = null;

  try {
    routeToken = process.env.LIBRARY_INGESTION_ROUTE_TOKEN ?? null;
    if (!routeToken) {
      return NextResponse.json({ error: "Library ingestion is not configured." }, { status: 503 });
    }

    const body = (await request.json()) as { sourceId?: unknown };
    if (typeof body.sourceId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.sourceId)) {
      return NextResponse.json({ error: "Invalid Library source." }, { status: 400 });
    }
    sourceId = body.sourceId;

    supabase = createRequestSupabase(request);
    const { data: userResult, error: userError } = await supabase.auth.getUser();
    if (userError || !userResult.user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const beginResult = await supabase.rpc("begin_library_author_epub_ingestion", {
      p_source_id: sourceId,
      p_route_token: routeToken,
    });
    if (beginResult.error) throw beginResult.error;

    const beginRows = (beginResult.data ?? []) as BeginRow[];
    const source = beginRows[0];
    if (!source) throw new Error("library_epub_ingestion_source_missing");
    begun = true;

    const downloadResult = await supabase.storage
      .from(source.storage_bucket)
      .download(source.storage_path);
    if (downloadResult.error || !downloadResult.data) {
      throw downloadResult.error ?? new Error("library_epub_source_download_failed");
    }

    if (downloadResult.data.size !== Number(source.byte_size)) {
      throw new Error("library_epub_source_size_mismatch");
    }

    const buffer = Buffer.from(await downloadResult.data.arrayBuffer());
    if (sha256Hex(buffer) !== source.sha256) {
      throw new Error("library_epub_source_sha256_mismatch");
    }

    const sections = await parseEpubBuffer(buffer);
    const completionResult = await supabase.rpc("complete_library_author_epub_ingestion", {
      p_source_id: sourceId,
      p_route_token: routeToken,
      p_sections: sections.map((section) => ({
        section_key: section.sectionKey,
        ordinal: section.ordinal,
        title: section.title,
        content_html: section.contentHtml,
        content_text: section.contentText,
        content_sha256: section.contentSha256,
      })),
    });
    if (completionResult.error) throw completionResult.error;

    return NextResponse.json({
      ok: true,
      publicationId: source.publication_id,
      sectionCount: Number(completionResult.data ?? sections.length),
    });
  } catch (error) {
    const message = errorMessage(error);

    if (begun && supabase && sourceId && routeToken) {
      try {
        await supabase.rpc("fail_library_author_epub_ingestion", {
          p_source_id: sourceId,
          p_route_token: routeToken,
          p_error: message,
        });
      } catch {
        // Preserve the original ingestion error. A replacement upload can reset a stuck source.
      }
    }

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
