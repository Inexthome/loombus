import { createClient } from "@supabase/supabase-js";

type DiscussionViewInsertRow = {
  discussion_id?: unknown;
  viewer_id?: unknown;
  [key: string]: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isAnonymousDiscussionViewInsert(values: unknown) {
  const rows = Array.isArray(values) ? values : [values];

  if (rows.length === 0) {
    return false;
  }

  return rows.every((row) => {
    if (!isRecord(row)) {
      return false;
    }

    const candidate = row as DiscussionViewInsertRow;

    return Boolean(candidate.discussion_id) && candidate.viewer_id == null;
  });
}

const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

const originalFrom = supabaseClient.from.bind(supabaseClient);

supabaseClient.from = ((relation: string) => {
  const queryBuilder = originalFrom(relation);

  if (relation !== "discussion_views") {
    return queryBuilder;
  }

  const originalInsert = queryBuilder.insert.bind(queryBuilder);

  queryBuilder.insert = ((values: unknown, options?: unknown) => {
    if (isAnonymousDiscussionViewInsert(values)) {
      return Promise.resolve({
        data: null,
        error: null,
        count: null,
        status: 204,
        statusText: "No Content",
      });
    }

    return originalInsert(values as never, options as never);
  }) as typeof queryBuilder.insert;

  return queryBuilder;
}) as typeof supabaseClient.from;

export const supabase = supabaseClient;
