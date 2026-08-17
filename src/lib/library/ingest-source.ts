import { LIBRARY_ORIGINALS_BUCKET } from "@/lib/library/content-contract";
import { parseEpubBuffer } from "@/lib/library/epub-parser";
import { sha256Hex } from "@/lib/library/epub-validation";
import {
  markLibrarySourceFailed,
  markLibrarySourceProcessing,
  replaceLibrarySections,
} from "@/lib/library/ingestion-state";
import { createLibraryIngestionClient } from "@/lib/library/server-ingestion-client";

export async function ingestLibraryPublicationSource(sourceId: string): Promise<{ publicationId: string; sectionCount: number }> {
  const client = createLibraryIngestionClient();
  const { data: source, error: sourceError } = await client
    .from("library_publication_sources")
    .select("id, publication_id, storage_provider, storage_bucket, storage_path, media_type, byte_size, sha256, ingestion_status")
    .eq("id", sourceId)
    .single();

  if (sourceError || !source) throw sourceError ?? new Error("library_source_not_found");
  if (source.storage_provider !== "supabase") throw new Error("library_source_provider_not_supported");
  if (source.storage_bucket !== LIBRARY_ORIGINALS_BUCKET) throw new Error("library_source_bucket_invalid");
  if (source.media_type !== "application/epub+zip") throw new Error("library_source_media_type_invalid");
  if (source.ingestion_status !== "pending") throw new Error("library_source_not_pending");

  await markLibrarySourceProcessing(client, sourceId);
  try {
    const { data, error } = await client.storage.from(source.storage_bucket).download(source.storage_path);
    if (error || !data) throw error ?? new Error("library_source_download_failed");
    if (data.size !== source.byte_size) throw new Error("library_source_size_mismatch");

    const buffer = Buffer.from(await data.arrayBuffer());
    if (sha256Hex(buffer) !== source.sha256) throw new Error("library_source_sha256_mismatch");

    const sections = await parseEpubBuffer(buffer);
    await replaceLibrarySections(client, {
      publicationId: source.publication_id,
      sourceId,
      sections,
    });
    return { publicationId: source.publication_id, sectionCount: sections.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "library_ingestion_failed";
    await markLibrarySourceFailed(client, sourceId, message);
    throw error;
  }
}
