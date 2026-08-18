import { createBrowserClient } from "@supabase/ssr";

type DiscussionViewInsertRow = {
  discussion_id?: unknown;
  viewer_id?: unknown;
  [key: string]: unknown;
};

type NativeOAuthWindow = Window & {
  Capacitor?: {
    getPlatform?: () => string;
    isNativePlatform?: () => boolean;
  };
  webkit?: {
    messageHandlers?: {
      loombusOAuth?: {
        postMessage: (url: string) => void;
      };
    };
  };
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

function getSafeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/discussions";
  }

  return value;
}

function isIosNativeRuntime() {
  if (typeof window === "undefined") {
    return false;
  }

  const capacitor = (window as NativeOAuthWindow).Capacitor;

  try {
    return Boolean(capacitor?.isNativePlatform?.()) && capacitor?.getPlatform?.() === "ios";
  } catch {
    return false;
  }
}

function getNativeOAuthRedirectTo(redirectTo?: string) {
  let next = "/discussions";

  if (redirectTo) {
    try {
      const callbackUrl = new URL(redirectTo, "https://loombus.com");
      next = getSafeNext(callbackUrl.searchParams.get("next"));
    } catch {
      next = "/discussions";
    }
  }

  return `loombus://auth/callback?next=${encodeURIComponent(next)}`;
}

function openNativeOAuthSession(url: string) {
  if (typeof window === "undefined") {
    return false;
  }

  const handler = (window as NativeOAuthWindow).webkit?.messageHandlers?.loombusOAuth;

  if (!handler) {
    return false;
  }

  handler.postMessage(url);
  return true;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

const supabaseClient = createBrowserClient(
  supabaseUrl,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

const originalSignInWithOAuth = supabaseClient.auth.signInWithOAuth.bind(
  supabaseClient.auth
);
type OAuthCredentials = Parameters<typeof supabaseClient.auth.signInWithOAuth>[0];

supabaseClient.auth.signInWithOAuth = (async (credentials: OAuthCredentials) => {
  if (!isIosNativeRuntime()) {
    return originalSignInWithOAuth(credentials);
  }

  const currentOptions = isRecord(credentials.options) ? credentials.options : {};
  const redirectTo = getNativeOAuthRedirectTo(
    typeof currentOptions.redirectTo === "string" ? currentOptions.redirectTo : undefined
  );

  const result = await originalSignInWithOAuth({
    ...credentials,
    options: {
      ...currentOptions,
      redirectTo,
      skipBrowserRedirect: true,
    },
  } as OAuthCredentials);

  if (!result.error && result.data.url) {
    const opened = openNativeOAuthSession(result.data.url);

    if (!opened) {
      window.location.assign(result.data.url);
    }
  }

  return result;
}) as typeof supabaseClient.auth.signInWithOAuth;

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

type LegacyStoredSession = {
  access_token?: unknown;
  refresh_token?: unknown;
};

let persistedSessionRestorePromise: Promise<void> | null = null;

function getLegacyAuthStorageKey() {
  try {
    const projectReference = new URL(supabaseUrl).hostname.split(".")[0];
    return projectReference ? `sb-${projectReference}-auth-token` : null;
  } catch {
    return null;
  }
}

function parseLegacyStoredSession(value: string): LegacyStoredSession | null {
  try {
    const parsed = JSON.parse(value) as unknown;

    if (!isRecord(parsed)) {
      return null;
    }

    return parsed as LegacyStoredSession;
  } catch {
    return null;
  }
}

function isExpiredLegacySessionError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: unknown; status?: unknown };
  const code = typeof candidate.code === "string" ? candidate.code : "";

  return (
    candidate.status === 400 ||
    candidate.status === 401 ||
    code === "refresh_token_not_found" ||
    code === "refresh_token_already_used" ||
    code === "session_not_found"
  );
}

/**
 * Moves sessions written by the former local-storage browser client into the
 * cookie-backed SSR client. This preserves existing native app logins across
 * the release that changes storage formats.
 */
export function restorePersistedSupabaseSession() {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (persistedSessionRestorePromise) {
    return persistedSessionRestorePromise;
  }

  const restorePromise = (async () => {
    const { data: currentSession } = await supabaseClient.auth.getSession();

    if (currentSession.session) {
      return;
    }

    const legacyStorageKey = getLegacyAuthStorageKey();
    const legacyValue = legacyStorageKey
      ? window.localStorage.getItem(legacyStorageKey)
      : null;

    if (!legacyStorageKey || !legacyValue) {
      return;
    }

    const legacySession = parseLegacyStoredSession(legacyValue);
    const accessToken = legacySession?.access_token;
    const refreshToken = legacySession?.refresh_token;

    if (typeof accessToken !== "string" || typeof refreshToken !== "string") {
      return;
    }

    const { data, error } = await supabaseClient.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error && isExpiredLegacySessionError(error)) {
      window.localStorage.removeItem(legacyStorageKey);
      return;
    }

    if (error) {
      throw error;
    }

    if (!error && data.session) {
      window.localStorage.removeItem(legacyStorageKey);
    }
  })();

  persistedSessionRestorePromise = restorePromise;

  return restorePromise.catch((error) => {
    if (persistedSessionRestorePromise === restorePromise) {
      persistedSessionRestorePromise = null;
    }

    throw error;
  });
}
