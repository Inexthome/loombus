import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { runProfessionalBookingPaymentReconciliation } from "@/lib/professional-booking-payment-reconciliation-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}

function secretFromRequest(request: NextRequest) {
  return (
    request.headers
      .get("authorization")
      ?.replace(/^Bearer\s+/i, "")
      .trim() ||
    request.headers.get("x-professional-booking-worker-secret")?.trim() ||
    ""
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

async function reconcile(request: NextRequest) {
  const expected = process.env.CRON_SECRET?.trim() ?? "";
  if (!secretsMatch(expected, secretFromRequest(request))) {
    return jsonError("Unauthorized.", 401);
  }

  try {
    const result = await runProfessionalBookingPaymentReconciliation();
    return NextResponse.json(result, {
      status: result.ok ? 200 : 500,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return jsonError(
      error instanceof Error
        ? error.message
        : "Professional Booking payment reconciliation failed.",
      500,
    );
  }
}

export async function GET(request: NextRequest) {
  return reconcile(request);
}

export async function POST(request: NextRequest) {
  return reconcile(request);
}
