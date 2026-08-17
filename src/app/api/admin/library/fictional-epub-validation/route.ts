import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { buildLibraryOriginalPath, LIBRARY_ORIGINALS_BUCKET } from "@/lib/library/content-contract";
import { buildFictionalLibraryEpub } from "@/lib/library/fictional-epub-fixture";
import { ingestLibraryPublicationSource } from "@/lib/library/ingest-source";
import { createLibraryIngestionClient } from "@/lib/library/server-ingestion-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALIDATION_PUBLICATION_ID = "11111111-1111-4111-8111-111111111938";
const VALIDATION_SOURCE_ID = "22222222-2222-4222-8222-222222222942";
const VALIDATION_PATH = buildLibraryOriginalPath(VALIDATION_PUBLICATION_ID, VALIDATION_SOURCE_ID);

function authorized(request: Request): boolean {
  if (process.env.LIBRARY_FICTIONAL_EPUB_VALIDATION_ENABLED !== "true") return false;
  const expected = process.env.LIBRARY_FICTIONAL_EPUB_VALIDATION_TOKEN;
  const provided = request.headers.get("x-loombus-validation-token");
  if (!expected || !provided) return false;
  const expectedBytes = Buffer.from(expected);
  const providedBytes = Buffer.from(provided);
  return expectedBytes.length === providedBytes.length && timingSafeEqual(expectedBytes, providedBytes);
}

async function rollbackFixture() {
  const client = createLibraryIngestionClient();
  const { data: existing, error: existingError } = await client
    .from("library_publication_sources")
    .select("id, storage_bucket, storage_path")
    .eq("publication_id", VALIDATION_PUBLICATION_ID)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing && existing.id !== VALIDATION_SOURCE_ID) throw new Error("library_validation_nonfixture_source_present");

  if (existing) {
    const { error: objectError } = await client.storage.from(existing.storage_bucket).remove([existing.storage_path]);
    if (objectError) throw objectError;
    const { error: deleteError } = await client.from("library_publication_sources").delete().eq("id", VALIDATION_SOURCE_ID);
    if (deleteError) throw deleteError;
  } else {
    await client.storage.from(LIBRARY_ORIGINALS_BUCKET).remove([VALIDATION_PATH]);
  }
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let action = "run";
  try {
    const body = await request.json().catch(() => ({}));
    if (body?.action === "rollback") action = "rollback";
    else if (body?.action && body.action !== "run") return NextResponse.json({ error: "invalid_action" }, { status: 400 });

    await rollbackFixture();
    if (action === "rollback") return NextResponse.json({ ok: true, action: "rollback", publicationId: VALIDATION_PUBLICATION_ID });

    const client = createLibraryIngestionClient();
    const { data: publication, error: publicationError } = await client
      .from("library_publications")
      .select("id, title, status")
      .eq("id", VALIDATION_PUBLICATION_ID)
      .single();
    if (publicationError || !publication) throw publicationError ?? new Error("library_validation_publication_missing");
    if (publication.title !== "Loombus Reader Validation Book" || publication.status !== "published") {
      throw new Error("library_validation_publication_contract_mismatch");
    }

    const fixture = buildFictionalLibraryEpub();
    const { error: uploadError } = await client.storage.from(LIBRARY_ORIGINALS_BUCKET).upload(VALIDATION_PATH, fixture.buffer, {
      contentType: "application/epub+zip",
      upsert: false,
    });
    if (uploadError) throw uploadError;

    const { error: sourceError } = await client.from("library_publication_sources").insert({
      id: VALIDATION_SOURCE_ID,
      publication_id: VALIDATION_PUBLICATION_ID,
      storage_provider: "supabase",
      storage_bucket: LIBRARY_ORIGINALS_BUCKET,
      storage_path: VALIDATION_PATH,
      media_type: "application/epub+zip",
      byte_size: fixture.byteSize,
      sha256: fixture.sha256,
      ingestion_status: "pending",
      manifest_version: 1,
    });
    if (sourceError) throw sourceError;

    const ingestion = await ingestLibraryPublicationSource(VALIDATION_SOURCE_ID);
    const [{ data: source, error: readSourceError }, { data: sections, error: sectionsError }] = await Promise.all([
      client.from("library_publication_sources").select("id, ingestion_status, ingestion_error, byte_size, sha256, storage_path").eq("id", VALIDATION_SOURCE_ID).single(),
      client.from("library_publication_sections").select("section_key, ordinal, title, content_text, content_sha256").eq("publication_id", VALIDATION_PUBLICATION_ID).order("ordinal", { ascending: true }),
    ]);
    if (readSourceError) throw readSourceError;
    if (sectionsError) throw sectionsError;

    return NextResponse.json({
      ok: source?.ingestion_status === "ready" && (sections?.length ?? 0) === 2,
      action: "run",
      publicationId: VALIDATION_PUBLICATION_ID,
      source,
      ingestion,
      sections,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "library_validation_failed";
    return NextResponse.json({ ok: false, action, error: message, rollbackAvailable: true }, { status: 500 });
  }
}
