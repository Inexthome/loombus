import { NextResponse, type NextRequest } from "next/server";
import { authenticateEnforcementRequest } from "@/lib/enforcement-request-auth";
import { getEnforcementServiceClient, getMemberEnforcementHistory } from "@/lib/enforcement-server";

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET(request: NextRequest) {
  const auth = await authenticateEnforcementRequest(
    request.headers.get("authorization") ?? ""
  );

  if (!auth.ok) {
    return jsonResponse({ error: auth.error }, auth.status);
  }

  try {
    const service = getEnforcementServiceClient();
    const profileResult = await service
      .from("profiles")
      .select("id, username, full_name, account_status, enforcement_reason, enforced_at, suspended_until")
      .eq("id", auth.user.id)
      .maybeSingle();

    if (profileResult.error || !profileResult.data) {
      return jsonResponse({ error: "Account profile unavailable." }, 404);
    }

    const decisions = await getMemberEnforcementHistory(auth.user.id);

    return jsonResponse({
      generatedAt: new Date().toISOString(),
      profile: profileResult.data,
      decisions,
    });
  } catch (error) {
    console.error("Unable to load member enforcement history:", error);
    return jsonResponse({ error: "Unable to load enforcement history." }, 500);
  }
}
