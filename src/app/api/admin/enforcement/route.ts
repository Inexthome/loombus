import { NextResponse, type NextRequest } from "next/server";
import { authenticateEnforcementRequest } from "@/lib/enforcement-request-auth";
import { listAdminEnforcementQueue } from "@/lib/enforcement-server";

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET(request: NextRequest) {
  const auth = await authenticateEnforcementRequest(
    request.headers.get("authorization") ?? "",
    { requireAdmin: true }
  );

  if (!auth.ok) {
    return jsonResponse({ error: auth.error }, auth.status);
  }

  try {
    const queue = await listAdminEnforcementQueue();
    return jsonResponse({
      generatedAt: new Date().toISOString(),
      currentAdminId: auth.user.id,
      ...queue,
    });
  } catch (error) {
    console.error("Unable to load enforcement operations:", error);
    return jsonResponse({ error: "Unable to load enforcement operations." }, 500);
  }
}
