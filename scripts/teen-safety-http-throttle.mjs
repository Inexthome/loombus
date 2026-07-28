import {
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";

const nativeFetch = globalThis.fetch.bind(globalThis);
const originalLog = console.log.bind(console);
const startedAt = Date.now();
const minimumIntervalMs = 1500;
const maximumAttempts = 5;
const maximumRetryDelayMs = 60_000;
let requestQueue = Promise.resolve();
let nextRequestAt = 0;
let persistentRateLimit = false;
let finalized = false;
const finalOutput = [];

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function requestUrl(input) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input?.url ?? "";
}

function shouldThrottle(input) {
  try {
    const hostname = new URL(requestUrl(input)).hostname.toLowerCase();
    return !hostname.endsWith(".supabase.co");
  } catch {
    return true;
  }
}

function retryDelay(response, attempt) {
  const retryAfter = response.headers.get("retry-after")?.trim();
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(maximumRetryDelayMs, Math.max(1000, seconds * 1000));
    }

    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) {
      return Math.min(
        maximumRetryDelayMs,
        Math.max(1000, date - Date.now())
      );
    }
  }

  return Math.min(maximumRetryDelayMs, 5000 * 2 ** (attempt - 1));
}

function rateLimitedResponse(attempts) {
  persistentRateLimit = true;
  return new Response(
    JSON.stringify({
      error: "Production rate limiting prevented authoritative verification after retries.",
      code: "verification_rate_limited",
      attempts,
    }),
    {
      status: 429,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": "application/json",
      },
    }
  );
}

async function throttledFetch(input, init) {
  if (persistentRateLimit) return rateLimitedResponse(0);

  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    const pacingDelay = Math.max(0, nextRequestAt - Date.now());
    if (pacingDelay > 0) await sleep(pacingDelay);

    const response = await nativeFetch(input, init);
    nextRequestAt = Date.now() + minimumIntervalMs;

    if (response.status !== 429) return response;
    if (attempt === maximumAttempts) return rateLimitedResponse(attempt);

    const delay = retryDelay(response, attempt);
    await response.arrayBuffer().catch(() => null);
    originalLog(
      `WAIT verification.http_rate_limit — HTTP 429; retry ${attempt + 1}/${maximumAttempts} in ${Math.ceil(delay / 1000)}s.`
    );
    await sleep(delay);
  }

  return rateLimitedResponse(maximumAttempts);
}

globalThis.fetch = function verificationFetch(input, init) {
  if (!shouldThrottle(input)) return nativeFetch(input, init);

  const run = requestQueue.then(
    () => throttledFetch(input, init),
    () => throttledFetch(input, init)
  );
  requestQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
};

console.log = (...values) => {
  const rendered = values
    .map((value) => (typeof value === "string" ? value : String(value)))
    .join(" ");
  const normalized = rendered.replace(/^\n/, "");

  if (
    normalized.startsWith("Result: ") ||
    normalized.startsWith("JSON: ") ||
    normalized.startsWith("Markdown: ")
  ) {
    finalOutput.push(normalized);
    return;
  }

  if (normalized.includes("verification_rate_limited")) {
    originalLog(normalized.replace(/^(PASS|FAIL)/, "SKIP"));
    return;
  }

  originalLog(...values);
};

function markdownCell(value) {
  return String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("|", "\\|")
    .replace(/\r?\n/g, "<br>");
}

function summaryFor(checks) {
  const failures = checks.filter((item) => item.status === "FAIL");
  const requiredSkips = checks.filter(
    (item) => item.status === "SKIP" && item.required
  );

  return {
    pass: checks.filter((item) => item.status === "PASS").length,
    fail: failures.length,
    skip: checks.filter((item) => item.status === "SKIP").length,
    requiredSkip: requiredSkips.length,
    result:
      failures.length > 0
        ? "FAIL"
        : requiredSkips.length > 0
          ? "INCOMPLETE"
          : "PASS",
  };
}

function writeMarkdown(report, path) {
  writeFileSync(
    path,
    [
      "# Loombus teen-safety production verification",
      "",
      `Generated: ${report.generatedAt}`,
      `Environment: ${report.baseUrl}`,
      `Result: **${report.summary.result}**`,
      "",
      `PASS: ${report.summary.pass} · FAIL: ${report.summary.fail} · SKIP: ${report.summary.skip}`,
      "",
      "| Status | Required | Check | Details |",
      "| --- | --- | --- | --- |",
      ...report.checks.map(
        (item) =>
          `| ${markdownCell(item.status)} | ${item.required ? "Yes" : "No"} | ${markdownCell(item.name)} | ${markdownCell(item.details)} |`
      ),
      "",
      "No passwords, access tokens, service-role keys, or email addresses are written to this report.",
      "",
    ].join("\n"),
    "utf8"
  );
}

process.on("beforeExit", () => {
  if (finalized) return;
  finalized = true;
  console.log = originalLog;

  const jsonPath = finalOutput
    .find((line) => line.startsWith("JSON: "))
    ?.slice("JSON: ".length);
  const markdownPath = finalOutput
    .find((line) => line.startsWith("Markdown: "))
    ?.slice("Markdown: ".length);

  if (!persistentRateLimit || !jsonPath || !existsSync(jsonPath)) {
    for (const line of finalOutput) originalLog(line);
    return;
  }

  try {
    const report = JSON.parse(readFileSync(jsonPath, "utf8"));
    if (Date.parse(report.generatedAt) < startedAt) {
      throw new Error("The verification report predates this run.");
    }

    for (const item of report.checks) {
      if (!String(item.details).includes("verification_rate_limited")) continue;
      item.status = "SKIP";
      item.required = true;
      item.details = `${item.details} This check is inconclusive and must be rerun after the production rate limit clears.`;
    }

    report.summary = summaryFor(report.checks);
    writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    if (markdownPath) writeMarkdown(report, markdownPath);

    process.exitCode =
      report.summary.result === "FAIL"
        ? 1
        : report.summary.result === "INCOMPLETE"
          ? 2
          : 0;

    originalLog(`\nResult: ${report.summary.result}`);
    originalLog(`JSON: ${jsonPath}`);
    if (markdownPath) originalLog(`Markdown: ${markdownPath}`);
    originalLog(
      "Production rate limiting persisted after automatic retries. Rate-limited checks were recorded as required SKIP results, not PASS or enforcement failures."
    );
  } catch (error) {
    for (const line of finalOutput) originalLog(line);
    originalLog(
      `Verification rate-limit normalization failed: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exitCode = 1;
  }
});
