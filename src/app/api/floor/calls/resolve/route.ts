import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { runFloorCallsResolver } from "@/lib/floor-calls-resolver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: { "Cache-Control": "private, no-store" },
    }
  );
}

function configuredSecret() {
  return process.env.CRON_SECRET?.trim() ?? "";
}

function providedSecret(request: NextRequest) {
  return (
    request.headers
      .get("authorization")
      ?.replace(/^Bearer\s+/i, "")
      .trim() ?? ""
  );
}

function secretsMatch(left: string, right: string) {
  if (!left || !right) return false;
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return (
    leftBytes.length === rightBytes.length &&
    timingSafeEqual(leftBytes, rightBytes)
  );
}

async function resolveFloorCalls(request: NextRequest) {
  const expected = configuredSecret();
  const provided = providedSecret(request);
  if (!secretsMatch(expected, provided)) {
    return jsonError("Unauthorized.", 401);
  }

  try {
    const summary = await runFloorCallsResolver();
    return NextResponse.json(summary, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "The Floor calls resolver failed.",
      500
    );
  }
}

export async function GET(request: NextRequest) {
  return resolveFloorCalls(request);
}

export async function POST(request: NextRequest) {
  return resolveFloorCalls(request);
}
