import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedEpubSection } from "@/lib/library/epub-manifest";

export async function markLibrarySourceProcessing(client: SupabaseClient, sourceId: string): Promise<void> {
  const { error } = await client.from("library_publication_sources").update({ ingestion_status: "processing", ingestion_error: null, updated_at: new Date().toISOString() }).eq("id", sourceId).eq("ingestion_status", "pending");
  if (error) throw error;
}

export async function markLibrarySourceFailed(client: SupabaseClient, sourceId: string, message: string): Promise<void> {
  const safeMessage = message.slice(0, 1000);
  const { error } = await client.from("library_publication_sources").update({ ingestion_status: "failed", ingestion_error: safeMessage, updated_at: new Date().toISOString() }).eq("id", sourceId);
  if (error) throw error;
}

export async function replaceLibrarySections(client: SupabaseClient, input: { publicationId: string; sourceId: string; sections: NormalizedEpubSection[] }): Promise<void> {
  const { error: deleteError } = await client.from("library_publication_sections").delete().eq("publication_id", input.publicationId);
  if (deleteError) throw deleteError;
  const rows = input.sections.map((section) => ({
    publication_id: input.publicationId,
    source_id: input.sourceId,
    section_key: section.sectionKey,
    ordinal: section.ordinal,
    title: section.title,
    content_html: section.contentHtml,
    content_text: section.contentText,
    content_sha256: section.contentSha256,
  }));
  const { error: insertError } = await client.from("library_publication_sections").insert(rows);
  if (insertError) throw insertError;
  const { error: readyError } = await client.from("library_publication_sources").update({ ingestion_status: "ready", ingestion_error: null, updated_at: new Date().toISOString() }).eq("id", input.sourceId).eq("ingestion_status", "processing");
  if (readyError) throw readyError;
}
