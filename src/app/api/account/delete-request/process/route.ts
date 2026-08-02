import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { runAccountDeletionWorker } from "@/lib/account-deletion-worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "private, no-store" } }
  );
}

function providedSecret(request: NextRequest) {
  return (
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    request.headers.get("x-account-deletion-worker-secret")?.trim() ||
    ""
  );
}

function secretsMatch(left: string, right: string) {
  if (!left || !right) return false;
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return (
    leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes)
  );
}

async function processRequests(request: NextRequest) {
  const expected =
    process.env.ACCOUNT_DELETION_CRON_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    "";
  if (!secretsMatch(expected, providedSecret(request))) {
    return jsonError("Unauthorized.", 401);
  }

  try {
    const result = await runAccountDeletionWorker();
    return NextResponse.json(result, {
      status: result.ok ? 200 : 500,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "The account deletion worker failed.",
      500
    );
  }
}

export async function GET(request: NextRequest) {
  return processRequests(request);
}

export async function POST(request: NextRequest) {
  return processRequests(request);
}
