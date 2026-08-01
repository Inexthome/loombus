import { supabase } from "@/lib/supabase/client";

export type FloorCloudKind =
  | "watch"
  | "journal"
  | "workspace_draft"
  | "workspace_revision"
  | "academy_progress"
  | "session";

export type FloorCloudItem<T = Record<string, unknown>> = {
  id: string;
  owner_id: string;
  kind: FloorCloudKind;
  client_id: string;
  data: T;
  created_at: string;
  updated_at: string;
};

export async function loadFloorCloudItems<T>(ownerId: string, kind: FloorCloudKind) {
  const { data, error } = await supabase
    .from("floor_cloud_items")
    .select("id, owner_id, kind, client_id, data, created_at, updated_at")
    .eq("owner_id", ownerId)
    .eq("kind", kind)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as FloorCloudItem<T>[];
}

export async function replaceFloorCloudItems<T extends { id: string }>(
  ownerId: string,
  kind: FloorCloudKind,
  items: T[],
) {
  const rows = items.map((item) => ({
    owner_id: ownerId,
    kind,
    client_id: item.id,
    data: item,
  }));

  if (rows.length) {
    const { error } = await supabase
      .from("floor_cloud_items")
      .upsert(rows, { onConflict: "owner_id,kind,client_id" });
    if (error) throw error;
  }

  const keep = new Set(items.map((item) => item.id));
  const existing = await loadFloorCloudItems<T>(ownerId, kind);
  const stale = existing.filter((item) => !keep.has(item.client_id)).map((item) => item.id);
  if (stale.length) {
    const { error } = await supabase.from("floor_cloud_items").delete().in("id", stale);
    if (error) throw error;
  }
}

export async function mergeFloorLocalWithCloud<T extends { id: string }>(
  ownerId: string,
  kind: FloorCloudKind,
  localItems: T[],
) {
  const cloudRows = await loadFloorCloudItems<T>(ownerId, kind);
  const merged = new Map<string, T>();
  for (const row of cloudRows) merged.set(row.client_id, row.data);
  for (const item of localItems) if (!merged.has(item.id)) merged.set(item.id, item);
  const values = [...merged.values()];
  await replaceFloorCloudItems(ownerId, kind, values);
  return values;
}
