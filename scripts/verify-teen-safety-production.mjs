#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const OUTPUT_DIR = resolve(ROOT, ".teen-safety-verification");
const BASE_URL = (process.env.LOOMBUS_BASE_URL || "https://loombus.com").replace(
  /\/$/,
  ""
);
const SEARCH_QUERY =
  process.env.LOOMBUS_VERIFY_SEARCH_QUERY ||
  "business service job marketplace room event";
const ZERO_UUID = "00000000-0000-4000-8000-000000000001";
const ROLES = ["adult", "teen", "unknown", "under13"];

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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const checks = [];
const accountReport = {};

function text(value) {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function check(name, status, details, required = true) {
  const renderedDetails = text(details);
  checks.push({ name, status, required, details: renderedDetails });
  console.log(`${status.padEnd(4)} ${name} — ${renderedDetails}`);
}

function errorText(error) {
  if (error instanceof Error) return error.message.slice(0, 500);
  return String(error ?? "Unknown error").slice(0, 500);
}

function prefix(role) {
  return `TEEN_VERIFY_${role.toUpperCase()}`;
}

async function resolveAccount(role, anon) {
  const key = prefix(role);
  const token = process.env[`${key}_TOKEN`]?.trim();
  const email = process.env[`${key}_EMAIL`]?.trim();
  const password = process.env[`${key}_PASSWORD`];

  try {
    if (token) {
      const { data, error } = await anon.auth.getUser(token);
      if (error || !data.user) {
        throw error ?? new Error("Token returned no user.");
      }
      return { role, token, userId: data.user.id };
    }

    if (!email || !password) return null;

    const client = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.session || !data.user) {
      throw error ?? new Error("Password sign-in returned no session.");
    }

    return {
      role,
      token: data.session.access_token,
      userId: data.user.id,
    };
  } catch (error) {
    check(`account.${role}.authenticate`, "FAIL", errorText(error));
    return null;
  }
}

async function api(path, { token, method = "GET", body } = {}) {
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
  const raw = await response.text();
  let payload;

  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    payload = { raw: raw.slice(0, 500) };
  }

  return { status: response.status, payload };
}

function code(result) {
  return String(result?.payload?.code ?? "");
}

async function accountState(service, account, role) {
  if (!account) {
    check(
      `account.${role}.configured`,
      "SKIP",
      `Set ${prefix(role)}_TOKEN or the matching email/password variables.`
    );
    return;
  }

  const [{ data: sensitive, error }, { data: privacy }, { data: settings }] =
    await Promise.all([
      service
        .from("profile_sensitive")
        .select("age_band, teen_safety_mode, guardian_required")
        .eq("id", account.userId)
        .maybeSingle(),
      service
        .from("member_privacy_settings")
        .select("private_account, discoverable")
        .eq("user_id", account.userId)
        .maybeSingle(),
      service
        .from("teen_safety_settings")
        .select(
          "future_discussion_audience, allow_unsolicited_adult_contact, personalized_recommendations_enabled, commerce_discovery_enabled"
        )
        .eq("user_id", account.userId)
        .maybeSingle(),
    ]);

  if (error) {
    check(`account.${role}.age_state`, "FAIL", error.message);
    return;
  }

  const actual = String(sensitive?.age_band ?? "unknown");
  const expected = role === "under13" ? "under_13" : role;
  accountReport[role] = {
    configured: true,
    userId: account.userId,
    ageBand: actual,
    teenSafetyMode: sensitive?.teen_safety_mode === true,
    guardianRequired: sensitive?.guardian_required === true,
  };

  check(
    `account.${role}.age_state`,
    actual === expected ? "PASS" : "FAIL",
    `Expected ${expected}; received ${actual}.`
  );

  if (role === "teen") {
    const pass =
      privacy?.private_account === true &&
      privacy?.discoverable === false &&
      settings?.future_discussion_audience === "followers" &&
      settings?.allow_unsolicited_adult_contact === false &&
      settings?.personalized_recommendations_enabled === false &&
      settings?.commerce_discovery_enabled === false;

    check("account.teen.protective_defaults", pass ? "PASS" : "FAIL", {
      privateAccount: privacy?.private_account ?? null,
      discoverable: privacy?.discoverable ?? null,
      futureDiscussionAudience: settings?.future_discussion_audience ?? null,
      unsolicitedAdultContact:
        settings?.allow_unsolicited_adult_contact ?? null,
      personalizedRecommendations:
        settings?.personalized_recommendations_enabled ?? null,
      commerceDiscovery: settings?.commerce_discovery_enabled ?? null,
    });
  }
}

async function roomDatabase(service) {
  const [{ count, error: roomError }, { data: settings, error: settingsError }] =
    await Promise.all([
      service.from("rooms").select("id", { count: "exact", head: true }),
      service
        .from("room_minor_safety_settings")
        .select("room_id, allows_minors, minor_admission_mode")
        .range(0, 9999),
    ]);

  if (roomError || settingsError) {
    check(
      "database.room_minor_settings",
      "FAIL",
      roomError?.message ?? settingsError?.message
    );
    return;
  }

  const rows = settings ?? [];
  check(
    "database.room_minor_settings.coverage",
    rows.length === (count ?? 0) ? "PASS" : "FAIL",
    `${rows.length} safety rows for ${count ?? 0} Rooms.`
  );

  const inconsistent = rows.filter(
    (row) =>
      (row.allows_minors === true &&
        row.minor_admission_mode !== "approval_required") ||
      (row.allows_minors !== true && row.minor_admission_mode !== "blocked")
  );
  check(
    "database.room_minor_settings.consistency",
    inconsistent.length === 0 ? "PASS" : "FAIL",
    `${inconsistent.length} inconsistent row(s).`
  );

  const { data: teenRows, error: teenError } = await service
    .from("profile_sensitive")
    .select("id")
    .eq("age_band", "teen")
    .range(0, 9999);
  if (teenError) {
    check("database.teen_room_roles", "FAIL", teenError.message);
    return;
  }

  const teenIds = (teenRows ?? []).map((row) => String(row.id));
  if (teenIds.length === 0) {
    check(
      "database.teen_room_roles",
      "SKIP",
      "No teen profiles exist in this environment.",
      false
    );
    return;
  }

  const [{ data: memberships, error: memberError }, { data: rooms, error: ownerError }] =
    await Promise.all([
      service
        .from("room_members")
        .select("user_id, role, status")
        .in("user_id", teenIds)
        .not("status", "in", "(blocked,removed,inactive)")
        .range(0, 9999),
      service
        .from("rooms")
        .select("id, owner_id, created_by")
        .or(
          `owner_id.in.(${teenIds.join(",")}),created_by.in.(${teenIds.join(",")})`
        )
        .range(0, 9999),
    ]);

  if (memberError || ownerError) {
    check(
      "database.teen_room_roles",
      "FAIL",
      memberError?.message ?? ownerError?.message
    );
    return;
  }

  const elevated = (memberships ?? []).filter(
    (row) => String(row.role ?? "member").toLowerCase() !== "member"
  );
  check(
    "database.teen_room_roles",
    elevated.length === 0 && (rooms ?? []).length === 0 ? "PASS" : "FAIL",
    `${elevated.length} elevated membership(s); ${(rooms ?? []).length} teen-owned Room(s).`
  );
}

async function messagingContract(service, adult, teen) {
  if (!adult || !teen) return;

  const [forward, reverse, blocks, adultProfile, teenProfile, adultRpc, teenRpc] =
    await Promise.all([
      service
        .from("follows")
        .select("follower_id")
        .eq("follower_id", adult.userId)
        .eq("following_id", teen.userId)
        .maybeSingle(),
      service
        .from("follows")
        .select("follower_id")
        .eq("follower_id", teen.userId)
        .eq("following_id", adult.userId)
        .maybeSingle(),
      service
        .from("user_blocks")
        .select("blocker_id")
        .or(
          `and(blocker_id.eq.${adult.userId},blocked_id.eq.${teen.userId}),and(blocker_id.eq.${teen.userId},blocked_id.eq.${adult.userId})`
        ),
      service
        .from("profiles")
        .select("account_status")
        .eq("id", adult.userId)
        .maybeSingle(),
      service
        .from("profiles")
        .select("account_status")
        .eq("id", teen.userId)
        .maybeSingle(),
      service.rpc("can_start_private_conversation", {
        p_sender_id: adult.userId,
        p_recipient_id: teen.userId,
      }),
      service.rpc("can_start_private_conversation", {
        p_sender_id: teen.userId,
        p_recipient_id: adult.userId,
      }),
    ]);

  const queryError =
    forward.error ||
    reverse.error ||
    blocks.error ||
    adultProfile.error ||
    teenProfile.error ||
    adultRpc.error ||
    teenRpc.error;
  if (queryError) {
    check("messaging.adult_teen_contract", "FAIL", queryError.message);
    return;
  }

  const statusesAllowed = [
    String(adultProfile.data?.account_status ?? "active"),
    String(teenProfile.data?.account_status ?? "active"),
  ].every((status) => ["active", "warned"].includes(status));
  const expected =
    Boolean(forward.data) &&
    Boolean(reverse.data) &&
    (blocks.data ?? []).length === 0 &&
    statusesAllowed;
  const actualAdult = adultRpc.data === true;
  const actualTeen = teenRpc.data === true;

  check(
    "messaging.adult_teen_contract",
    actualAdult === expected && actualTeen === expected ? "PASS" : "FAIL",
    `Mutual follows: ${Boolean(forward.data) && Boolean(reverse.data)}; blocked: ${(blocks.data ?? []).length > 0}; expected eligibility: ${expected}; adult-to-teen: ${actualAdult}; teen-to-adult: ${actualTeen}.`
  );
}

async function notificationContext(service) {
  const types = [
    "age_correction_submitted",
    "age_correction_status",
    "underage_account_report",
    "underage_account_report_status",
    "room_join_request_review",
  ];
  const { data, error } = await service
    .from("notifications")
    .select("id, type, target_type, target_id, room_id, created_at")
    .in("type", types)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    check("notifications.safety_destinations", "FAIL", error.message);
    return;
  }

  const rows = data ?? [];
  const roomRows = rows.filter((row) => row.type === "room_join_request_review");
  const missing = roomRows.filter((row) => !row.room_id);
  check(
    "notifications.room_admission_context",
    missing.length === 0 ? "PASS" : "FAIL",
    `${roomRows.length} Room admission notice(s); ${missing.length} missing room_id.`
  );

  const ageRows = rows.filter((row) => row.type !== "room_join_request_review");
  check(
    "notifications.age_safety_history",
    ageRows.length > 0 ? "PASS" : "SKIP",
    ageRows.length > 0
      ? `${ageRows.length} age-safety notice(s) available for manual destination review.`
      : "No age-safety notification history exists yet.",
    false
  );
}

const COMMERCE_TYPES = new Set([
  "service",
  "request",
  "company",
  "product",
  "job",
  "marketplace",
]);
const ROOM_TYPES = new Set([
  "room",
  "room_discussion",
  "announcement",
  "knowledge",
  "task",
  "poll",
  "form",
  "resource",
  "file",
  "document",
]);
const LOCAL_TYPES = new Set([
  "business",
  "service",
  "job",
  "marketplace",
  "request",
]);

function rowsOfTypes(rows, types) {
  return (Array.isArray(rows) ? rows : []).filter((row) =>
    types.has(String(row?.type ?? row?.entityType ?? ""))
  );
}

function roomId(row) {
  if (typeof row?.roomId === "string" && row.roomId) return row.roomId;
  const match = String(row?.href ?? "").match(
    /\/rooms\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/i
  );
  return match?.[1] ?? null;
}

async function invalidTeenRooms(service, rows) {
  if (rows.length === 0) return [];

  const ids = [...new Set(rows.map(roomId).filter(Boolean))];
  if (ids.length === 0) return rows;

  const { data, error } = await service
    .from("room_minor_safety_settings")
    .select("room_id, allows_minors")
    .in("room_id", ids);
  if (error) return rows;

  const allowed = new Set(
    (data ?? [])
      .filter((row) => row.allows_minors === true)
      .map((row) => String(row.room_id))
  );
  return rows.filter((row) => {
    const id = roomId(row);
    return !id || !allowed.has(id);
  });
}

async function discovery(service, role, account) {
  if (!account || role === "adult") return;

  const everything = await api(
    `/api/search/everything?q=${encodeURIComponent(SEARCH_QUERY)}&limit=80`,
    { token: account.token }
  );
  if (everything.status !== 200) {
    check(
      `discovery.${role}.everything_search`,
      "FAIL",
      `HTTP ${everything.status}; code ${code(everything) || "none"}.`
    );
  } else {
    const rows = Array.isArray(everything.payload?.results)
      ? everything.payload.results
      : [];
    const commerce = rowsOfTypes(rows, COMMERCE_TYPES);
    const rooms = rowsOfTypes(rows, ROOM_TYPES);
    const invalidRooms =
      role === "teen" ? await invalidTeenRooms(service, rooms) : rooms;
    check(
      `discovery.${role}.everything_search`,
      commerce.length === 0 && invalidRooms.length === 0 ? "PASS" : "FAIL",
      `${rows.length} result(s); ${commerce.length} protected commerce result(s); ${invalidRooms.length} ineligible Room result(s).`
    );
  }

  const local = await api(
    `/api/local?q=${encodeURIComponent(SEARCH_QUERY)}&pageSize=48`,
    { token: account.token }
  );
  if (local.status !== 200) {
    check(
      `discovery.${role}.local`,
      "FAIL",
      `HTTP ${local.status}; code ${code(local) || "none"}.`
    );
  } else {
    const rows = Array.isArray(local.payload?.results)
      ? local.payload.results
      : [];
    const protectedRows = rowsOfTypes(rows, LOCAL_TYPES);
    check(
      `discovery.${role}.local`,
      protectedRows.length === 0 ? "PASS" : "FAIL",
      `${rows.length} result(s); ${protectedRows.length} protected Local result(s).`
    );
  }

  const aiResult = await api("/api/search/ai", {
    token: account.token,
    method: "POST",
    body: { query: SEARCH_QUERY },
  });
  if (aiResult.status === 403 && code(aiResult) === "premium_required") {
    check(
      `discovery.${role}.ask_ai`,
      "SKIP",
      "The test account does not have Premium AI access.",
      false
    );
    return;
  }
  if (
    aiResult.status === 409 &&
    code(aiResult) === "no_ai_eligible_search_context"
  ) {
    check(
      `discovery.${role}.ask_ai`,
      "PASS",
      "No eligible context was sent to the AI provider."
    );
    return;
  }
  if (aiResult.status !== 200) {
    check(
      `discovery.${role}.ask_ai`,
      "FAIL",
      `HTTP ${aiResult.status}; code ${code(aiResult) || "none"}.`
    );
    return;
  }

  const sources = Array.isArray(aiResult.payload?.sources)
    ? aiResult.payload.sources
    : [];
  const commerce = rowsOfTypes(sources, COMMERCE_TYPES);
  const rooms = rowsOfTypes(sources, ROOM_TYPES);
  const invalidRooms =
    role === "teen" ? await invalidTeenRooms(service, rooms) : rooms;
  check(
    `discovery.${role}.ask_ai`,
    commerce.length === 0 && invalidRooms.length === 0 ? "PASS" : "FAIL",
    `${sources.length} source(s); ${commerce.length} protected commerce source(s); ${invalidRooms.length} ineligible Room source(s).`
  );
}

const MUTATIONS = [
  ["business", "/api/businesses", { action: "create" }],
  ["job", "/api/jobs", { action: "create" }],
  ["marketplace", "/api/marketplace", { action: "create" }],
  ["service", "/api/services", { action: "create" }],
  ["request", "/api/requests", { action: "create" }],
  ["event", "/api/events", { action: "create" }],
  ["appointment", "/api/appointments", { action: "create_service" }],
  ["local_location", "/api/local", { action: "set_location" }],
  [
    "room",
    "/api/rooms/provision",
    {
      modelId: "community",
      planId: "free",
      roomName: "x",
      description: "verification",
    },
  ],
];

async function mutationBoundary(role, account) {
  if (!account) return;

  const expected = {
    teen: "teen_action_restricted",
    unknown: "age_gate_required",
    under13: "under_13_not_allowed",
  }[role];
  const forbidden = new Set([
    "teen_action_restricted",
    "age_gate_required",
    "under_13_not_allowed",
    "age_safety_unavailable",
  ]);

  for (const [name, path, body] of MUTATIONS) {
    const result = await api(path, {
      token: account.token,
      method: "POST",
      body,
    });
    const resultCode = code(result);

    if (role === "adult") {
      check(
        `mutation.${role}.${name}`,
        result.status < 500 && !forbidden.has(resultCode) ? "PASS" : "FAIL",
        `HTTP ${result.status}; code ${resultCode || "none"}. Incomplete payload supplied. No record should be created.`
      );
    } else {
      check(
        `mutation.${role}.${name}`,
        result.status === 403 && resultCode === expected ? "PASS" : "FAIL",
        `Expected HTTP 403/${expected}; received HTTP ${result.status}/${resultCode || "none"}.`
      );
    }
  }
}

async function safeReportPath(teen) {
  if (!teen) return;

  const result = await api("/api/businesses", {
    token: teen.token,
    method: "POST",
    body: {
      action: "report",
      businessId: ZERO_UUID,
      reason: "other",
      details: "Teen-safety production verification probe. No real target exists.",
    },
  });
  const ageCodes = new Set([
    "teen_action_restricted",
    "age_gate_required",
    "under_13_not_allowed",
    "age_safety_unavailable",
  ]);
  check(
    "mutation.teen.report_path_available",
    result.status !== 401 && result.status < 500 && !ageCodes.has(code(result))
      ? "PASS"
      : "FAIL",
    `HTTP ${result.status}; code ${code(result) || "none"}.`
  );
}

function markdownCell(value) {
  return String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("|", "\\|")
    .replace(/\r?\n/g, "<br>");
}

function writeReport() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const failures = checks.filter((item) => item.status === "FAIL");
  const requiredSkips = checks.filter(
    (item) => item.status === "SKIP" && item.required
  );
  const summary = {
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
  const generatedAt = new Date().toISOString();
  const stamp = generatedAt.replace(/[:.]/g, "-");
  const report = {
    generatedAt,
    baseUrl: BASE_URL,
    searchQuery: SEARCH_QUERY,
    summary,
    accounts: accountReport,
    checks,
  };
  const jsonPath = resolve(
    OUTPUT_DIR,
    `teen-safety-verification-${stamp}.json`
  );
  const markdownPath = resolve(
    OUTPUT_DIR,
    `teen-safety-verification-${stamp}.md`
  );

  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(
    markdownPath,
    [
      "# Loombus teen-safety production verification",
      "",
      `Generated: ${generatedAt}`,
      `Environment: ${BASE_URL}`,
      `Result: **${summary.result}**`,
      "",
      `PASS: ${summary.pass} · FAIL: ${summary.fail} · SKIP: ${summary.skip}`,
      "",
      "| Status | Required | Check | Details |",
      "| --- | --- | --- | --- |",
      ...checks.map(
        (item) =>
          `| ${markdownCell(item.status)} | ${item.required ? "Yes" : "No"} | ${markdownCell(item.name)} | ${markdownCell(item.details)} |`
      ),
      "",
      "No passwords, access tokens, service-role keys, or email addresses are written to this report.",
      "",
    ].join("\n"),
    "utf8"
  );

  console.log(`\nResult: ${summary.result}`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`Markdown: ${markdownPath}`);
  return summary.result === "FAIL" ? 1 : summary.result === "INCOMPLETE" ? 2 : 0;
}

async function main() {
  console.log("LOOMBUS TEEN-SAFETY PRODUCTION VERIFICATION");
  console.log(`Environment: ${BASE_URL}\n`);

  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
    check(
      "configuration.supabase",
      "FAIL",
      "NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY are required."
    );
    process.exitCode = writeReport();
    return;
  }

  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const service = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  check("configuration.supabase", "PASS", "Supabase clients initialized.");

  const accounts = {};
  for (const role of ROLES) {
    accounts[role] = await resolveAccount(role, anon);
    await accountState(service, accounts[role], role);
  }

  await roomDatabase(service);
  await messagingContract(service, accounts.adult, accounts.teen);
  await notificationContext(service);
  for (const role of ROLES) {
    await mutationBoundary(role, accounts[role]);
  }
  for (const role of ["teen", "unknown", "under13"]) {
    await discovery(service, role, accounts[role]);
  }
  await safeReportPath(accounts.teen);

  process.exitCode = writeReport();
}

main().catch((error) => {
  check("verification.unhandled_error", "FAIL", errorText(error));
  process.exitCode = writeReport();
});
