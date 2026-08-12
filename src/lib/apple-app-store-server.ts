import "server-only";

import { createPrivateKey, sign as signData } from "node:crypto";

const DEFAULT_BUNDLE_ID = "com.loombus.mobile";
const APPLE_PRODUCTION_BASE_URL = "https://api.storekit.apple.com";
const APPLE_SANDBOX_BASE_URL = "https://api.storekit-sandbox.apple.com";

export type AppleEnvironment = "Production" | "Sandbox";

export type AppleTransactionPayload = {
  transactionId?: string;
  originalTransactionId?: string;
  bundleId?: string;
  productId?: string;
  appAccountToken?: string;
  purchaseDate?: number;
  originalPurchaseDate?: number;
  expiresDate?: number;
  revocationDate?: number;
  environment?: AppleEnvironment;
  transactionReason?: string;
  type?: string;
};

type AppleTransactionInfoResponse = {
  signedTransactionInfo?: string;
};

type AppleLastTransactionItem = {
  originalTransactionId?: string;
  status?: number;
  signedTransactionInfo?: string;
  signedRenewalInfo?: string;
};

type AppleSubscriptionGroup = {
  subscriptionGroupIdentifier?: string;
  lastTransactions?: AppleLastTransactionItem[];
};

type AppleStatusResponse = {
  environment?: AppleEnvironment;
  bundleId?: string;
  appAppleId?: number;
  data?: AppleSubscriptionGroup[];
};

export type VerifiedAppleSubscription = {
  environment: AppleEnvironment;
  statusCode: number;
  status: "active" | "expired" | "billing_retry" | "grace_period" | "revoked";
  transaction: AppleTransactionPayload;
  originalTransactionId: string;
};

export type VerifiedAppleTransaction = {
  environment: AppleEnvironment;
  transaction: AppleTransactionPayload;
};

function getAppleServerConfig() {
  const issuerId = process.env.APPLE_IAP_ISSUER_ID?.trim();
  const keyId = process.env.APPLE_IAP_KEY_ID?.trim();
  const privateKeyValue = process.env.APPLE_IAP_PRIVATE_KEY?.trim();
  const bundleId = process.env.APPLE_IAP_BUNDLE_ID?.trim() || DEFAULT_BUNDLE_ID;

  if (!issuerId || !keyId || !privateKeyValue) {
    throw new Error(
      "Apple App Store Server API is not configured. APPLE_IAP_ISSUER_ID, APPLE_IAP_KEY_ID and APPLE_IAP_PRIVATE_KEY are required."
    );
  }

  return {
    issuerId,
    keyId,
    bundleId,
    privateKey: privateKeyValue.replace(/\\n/g, "\n"),
  };
}

function base64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function createAppleServerApiToken() {
  const config = getAppleServerConfig();
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlJson({
    alg: "ES256",
    kid: config.keyId,
    typ: "JWT",
  });
  const payload = base64UrlJson({
    iss: config.issuerId,
    iat: now,
    exp: now + 5 * 60,
    aud: "appstoreconnect-v1",
    bid: config.bundleId,
  });
  const signingInput = `${header}.${payload}`;
  const key = createPrivateKey(config.privateKey);
  const signature = signData("sha256", Buffer.from(signingInput), {
    key,
    dsaEncoding: "ieee-p1363",
  }).toString("base64url");

  return `${signingInput}.${signature}`;
}

function decodeJwsPayload<T>(jws: string): T {
  const parts = jws.split(".");
  if (parts.length !== 3 || !parts[1]) {
    throw new Error("Apple returned malformed signed transaction data.");
  }

  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as T;
  } catch {
    throw new Error("Apple returned unreadable signed transaction data.");
  }
}

async function requestAppleServer<T>(
  path: string,
  environment: AppleEnvironment
): Promise<{ response: Response; body: T | null }> {
  const baseUrl =
    environment === "Production"
      ? APPLE_PRODUCTION_BASE_URL
      : APPLE_SANDBOX_BASE_URL;
  const response = await fetch(`${baseUrl}${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${createAppleServerApiToken()}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const body = (await response.json().catch(() => null)) as T | null;
  return { response, body };
}

async function requestAppleServerWithEnvironmentFallback<T>(path: string) {
  const production = await requestAppleServer<T>(path, "Production");
  if (production.response.ok) {
    return { ...production, environment: "Production" as const };
  }

  // Sandbox transaction IDs are not valid in the production endpoint. Retry
  // only a not-found response so authentication/configuration errors cannot be
  // hidden by an automatic sandbox fallback.
  if (production.response.status === 404) {
    const sandbox = await requestAppleServer<T>(path, "Sandbox");
    if (sandbox.response.ok) {
      return { ...sandbox, environment: "Sandbox" as const };
    }

    throw new Error(
      `Apple transaction was not found (production ${production.response.status}, sandbox ${sandbox.response.status}).`
    );
  }

  throw new Error(
    `Apple App Store Server API request failed with HTTP ${production.response.status}.`
  );
}

function assertAppleBundleId(bundleId: string | undefined) {
  const expectedBundleId = getAppleServerConfig().bundleId;
  if (!bundleId || bundleId !== expectedBundleId) {
    throw new Error("Apple transaction bundle ID does not match Loombus.");
  }
}

export async function verifyAppleTransactionById(
  transactionId: string
): Promise<VerifiedAppleTransaction> {
  const encodedId = encodeURIComponent(transactionId);
  const result = await requestAppleServerWithEnvironmentFallback<AppleTransactionInfoResponse>(
    `/inApps/v1/transactions/${encodedId}`
  );
  const signedTransactionInfo = result.body?.signedTransactionInfo;

  if (!signedTransactionInfo) {
    throw new Error("Apple transaction response did not include signed transaction information.");
  }

  const transaction = decodeJwsPayload<AppleTransactionPayload>(signedTransactionInfo);
  assertAppleBundleId(transaction.bundleId);

  if (!transaction.transactionId || transaction.transactionId !== transactionId) {
    throw new Error("Apple transaction ID did not match the requested transaction.");
  }

  if (transaction.environment && transaction.environment !== result.environment) {
    throw new Error("Apple transaction environment did not match the server response.");
  }

  return {
    environment: result.environment,
    transaction,
  };
}

function mapAppleSubscriptionStatus(statusCode: number): VerifiedAppleSubscription["status"] {
  switch (statusCode) {
    case 1:
      return "active";
    case 2:
      return "expired";
    case 3:
      return "billing_retry";
    case 4:
      return "grace_period";
    case 5:
      return "revoked";
    default:
      throw new Error(`Apple returned unsupported subscription status ${statusCode}.`);
  }
}

export async function getCurrentAppleSubscription(
  anyTransactionId: string,
  preferredEnvironment?: AppleEnvironment
): Promise<VerifiedAppleSubscription> {
  const path = `/inApps/v1/subscriptions/${encodeURIComponent(anyTransactionId)}`;
  const result = preferredEnvironment
    ? {
        ...(await requestAppleServer<AppleStatusResponse>(path, preferredEnvironment)),
        environment: preferredEnvironment,
      }
    : await requestAppleServerWithEnvironmentFallback<AppleStatusResponse>(path);

  if (!result.response.ok) {
    throw new Error(
      `Apple subscription-status request failed with HTTP ${result.response.status}.`
    );
  }

  assertAppleBundleId(result.body?.bundleId);

  const candidates = (result.body?.data ?? [])
    .flatMap((group) => group.lastTransactions ?? [])
    .filter((item) => item.originalTransactionId && item.signedTransactionInfo);

  if (candidates.length === 0) {
    throw new Error("Apple returned no subscription status for this transaction.");
  }

  const requestedTransaction = await verifyAppleTransactionById(anyTransactionId);
  const requestedOriginalId = requestedTransaction.transaction.originalTransactionId;
  const matching =
    candidates.find((item) => item.originalTransactionId === requestedOriginalId) ??
    candidates[0];

  if (!matching?.signedTransactionInfo || !matching.originalTransactionId) {
    throw new Error("Apple subscription status did not include a usable transaction.");
  }

  const transaction = decodeJwsPayload<AppleTransactionPayload>(
    matching.signedTransactionInfo
  );
  assertAppleBundleId(transaction.bundleId);

  return {
    environment: result.environment,
    statusCode: matching.status ?? 2,
    status: mapAppleSubscriptionStatus(matching.status ?? 2),
    transaction,
    originalTransactionId: matching.originalTransactionId,
  };
}

export function decodeAppleNotificationTransactionId(
  signedPayload: string
): string | null {
  // Notification payloads are never trusted for entitlement changes. This
  // decoder extracts only a transaction identifier, which is then re-queried
  // against Apple's authenticated App Store Server API before any state write.
  try {
    const notification = decodeJwsPayload<{
      data?: { signedTransactionInfo?: string };
    }>(signedPayload);
    const signedTransactionInfo = notification.data?.signedTransactionInfo;
    if (!signedTransactionInfo) return null;
    const transaction = decodeJwsPayload<AppleTransactionPayload>(signedTransactionInfo);
    return transaction.transactionId ?? transaction.originalTransactionId ?? null;
  } catch {
    return null;
  }
}
