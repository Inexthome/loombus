import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();

function loadEnvFile(path) {
  if (!existsSync(path)) return;

  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator < 1) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value.replace(/\\n/g, "\n");
    }
  }
}

loadEnvFile(resolve(ROOT, ".env.local"));
loadEnvFile(resolve(ROOT, ".env.teen-safety.local"));

const automationBypassSecret =
  process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim() ?? "";
const configuredBaseUrl = process.env.LOOMBUS_BASE_URL || "https://loombus.com";
let configuredOrigin = "";

try {
  configuredOrigin = new URL(configuredBaseUrl).origin;
} catch {
  configuredOrigin = "https://loombus.com";
}

const nativeFetch = globalThis.fetch.bind(globalThis);

function requestUrl(input) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input?.url ?? "";
}

function mergedHeaders(input, init) {
  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  if (init?.headers) {
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  }
  headers.set("x-vercel-protection-bypass", automationBypassSecret);
  return headers;
}

globalThis.fetch = function verificationVercelBypass(input, init) {
  if (!automationBypassSecret) return nativeFetch(input, init);

  try {
    const url = new URL(requestUrl(input));
    if (url.origin !== configuredOrigin) return nativeFetch(input, init);
  } catch {
    return nativeFetch(input, init);
  }

  return nativeFetch(input, {
    ...init,
    headers: mergedHeaders(input, init),
  });
};

if (automationBypassSecret) {
  console.log(
    `INFO verification.vercel_automation_bypass — configured for ${configuredOrigin}; secret value is not logged.`
  );
} else {
  console.log(
    "INFO verification.vercel_automation_bypass — not configured; Vercel Security Checkpoint may challenge automated production probes."
  );
}
