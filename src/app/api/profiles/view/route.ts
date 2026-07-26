import { NextRequest, NextResponse } from "next/server";
import {
  createMemberPrivacyServiceClient,
  getMemberPrivacy,
  hasBlockRelationship,
  requireMemberUser,
} from "@/lib/member-privacy-server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VIEW_DEDUPE_HOURS = 24;

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function POST(request: NextRequest) {
  const service = createMemberPrivacyServiceClient();
  if (!service) return jsonError("Profile view service is not configured.", 503);

  const { user } = await requireMemberUser(request);
  if (!user) return jsonError("Unauthorized.", 401);

  const body = await request.json().catch(() => ({}));
  const profileId = String(body.profileId ?? "").trim();
  if (!UUID_PATTERN.test(profileId)) return jsonError("Invalid profile id.", 400);
  if (profileId === user.id) return NextResponse.json({ tracked: false, reason: "self" });

  const { data: profile } = await service
    .from("profiles")
    .select("id")
    .eq("id", profileId)
    .maybeSingle();
  if (!profile) return jsonError("Profile not found.", 404);
  if (await hasBlockRelationship(service, profileId, user.id)) {
    return jsonError("Profile not found.", 404);
  }

  const dedupeSince = new Date(
    Date.now() - VIEW_DEDUPE_HOURS * 60 * 60 * 1000
  ).toISOString();
  const { data: recent } = await service
    .from("profile_views")
    .select("id")
    .eq("profile_id", profileId)
    .eq("viewer_id", user.id)
    .gte("viewed_at", dedupeSince)
    .limit(1)
    .maybeSingle();

  if (recent) return NextResponse.json({ tracked: false, reason: "deduped" });

  const viewerPrivacy = await getMemberPrivacy(service, user.id);
  const { error } = await service.from("profile_views").insert({
    profile_id: profileId,
    viewer_id: user.id,
    identity_visible: viewerPrivacy.show_view_identity,
  });
  if (error) return jsonError(error.message, 500);

  return NextResponse.json({ tracked: true });
}
