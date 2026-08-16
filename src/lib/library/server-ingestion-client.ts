import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function createLibraryIngestionClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("library_supabase_url_missing");
  if (!key) throw new Error("library_supabase_secret_missing");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
