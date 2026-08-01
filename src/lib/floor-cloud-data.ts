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


export type FloorCloudRoomSeed = {
  id: string;
  name: string;
  focus: string;
  objective: string;
  watchlist: string[];
  tasks: string[];
  createdAt: string;
};

export async function mergeFloorRooms(ownerId: string, localRooms: FloorCloudRoomSeed[]) {
  const { data, error } = await supabase
    .from("floor_research_rooms")
    .select("id, client_id, name, focus, objective, seed_data, created_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;

  const merged = new Map<string, FloorCloudRoomSeed>();
  for (const row of data ?? []) {
    const seed = (row.seed_data ?? {}) as { watchlist?: string[]; tasks?: string[]; createdAt?: string };
    merged.set(row.client_id, {
      id: row.client_id,
      name: row.name,
      focus: row.focus,
      objective: row.objective,
      watchlist: seed.watchlist ?? [],
      tasks: seed.tasks ?? [],
      createdAt: seed.createdAt ?? row.created_at,
    });
  }
  for (const room of localRooms) if (!merged.has(room.id)) merged.set(room.id, room);
  const rooms = [...merged.values()];
  await replaceFloorRooms(ownerId, rooms);
  return rooms;
}

export async function replaceFloorRooms(ownerId: string, rooms: FloorCloudRoomSeed[]) {
  if (rooms.length) {
    const { error } = await supabase.from("floor_research_rooms").upsert(
      rooms.map((room) => ({
        owner_id: ownerId,
        client_id: room.id,
        name: room.name,
        focus: room.focus,
        objective: room.objective,
        seed_data: { watchlist: room.watchlist, tasks: room.tasks, createdAt: room.createdAt },
      })),
      { onConflict: "owner_id,client_id" },
    );
    if (error) throw error;
  }

  const { data, error } = await supabase
    .from("floor_research_rooms")
    .select("id, client_id")
    .eq("owner_id", ownerId);
  if (error) throw error;
  const keep = new Set(rooms.map((room) => room.id));
  const stale = (data ?? []).filter((room) => !keep.has(room.client_id)).map((room) => room.id);
  if (stale.length) {
    const { error: deleteError } = await supabase.from("floor_research_rooms").delete().in("id", stale);
    if (deleteError) throw deleteError;
  }
}
