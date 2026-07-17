import "server-only";

import { ExpansionError, asObject, cleanStringArray, cleanText, ensureOrganization, safeHttpUrl } from "@/lib/room-expansion-service";
import { asNumber, asString } from "@/lib/room-operations";

function normalizeDomains(value) {
  return cleanStringArray(value, 100, 253)
    .map((domain) => domain.toLowerCase())
    .filter((domain) => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain));
}

export async function saveOrganization(service, access, userId, body) {
  const { organization, organizationId, role } = await ensureOrganization(
    service,
    access,
    userId
  );
  if (!new Set(["owner", "administrator"]).has(role)) {
    throw new ExpansionError("Organization administration access is required.", 403);
  }
  const branding = asObject(organization.branding);
  const security = asObject(organization.security);
  const enterprise = asString(organization.plan_key) === "enterprise";
  const updated = await service
    .from("room_organizations")
    .update({
      name: cleanText(body.name, 160) || asString(organization.name),
      branding: {
        ...branding,
        logoUrl:
          body.logoUrl === undefined ? asString(branding.logoUrl) : safeHttpUrl(body.logoUrl),
        accent: cleanText(body.accent, 40) || asString(branding.accent),
        description:
          body.description === undefined
            ? asString(branding.description)
            : cleanText(body.description, 1000),
      },
      security: {
        ...security,
        allowedEmailDomains:
          body.allowedEmailDomains === undefined
            ? Array.isArray(security.allowedEmailDomains)
              ? security.allowedEmailDomains
              : []
            : normalizeDomains(body.allowedEmailDomains),
        requireInviteApproval:
          body.requireInviteApproval === undefined
            ? security.requireInviteApproval !== false
            : body.requireInviteApproval === true,
        defaultInviteRole:
          body.defaultInviteRole === "moderator" ? "moderator" : "member",
        legalHold:
          enterprise && body.legalHold !== undefined
            ? body.legalHold === true
            : security.legalHold === true,
        retentionDays:
          enterprise && body.retentionDays !== undefined
            ? Math.max(0, Math.min(3650, Math.floor(asNumber(body.retentionDays))))
            : Math.max(0, Math.floor(asNumber(security.retentionDays))),
      },
    })
    .eq("id", organizationId);
  if (updated.error) throw new ExpansionError(updated.error.message, 503);
  return { ok: true };
}

export async function propagateOrganizationSecurity(service, access, userId) {
  const { organization, organizationId, role } = await ensureOrganization(
    service,
    access,
    userId
  );
  if (!new Set(["owner", "administrator"]).has(role)) {
    throw new ExpansionError("Organization administration access is required.", 403);
  }
  const security = asObject(organization.security);
  const rooms = await service
    .from("rooms")
    .select("id")
    .eq("organization_id", organizationId);
  if (rooms.error) throw new ExpansionError(rooms.error.message, 503);
  for (const room of rooms.data ?? []) {
    const current = await service
      .from("room_module_settings")
      .select("settings")
      .eq("room_id", room.id)
      .maybeSingle();
    if (current.error) throw new ExpansionError(current.error.message, 503);
    const settings = asObject(current.data?.settings);
    const saved = await service.from("room_module_settings").upsert(
      {
        room_id: room.id,
        settings: {
          ...settings,
          allowedEmailDomains: Array.isArray(security.allowedEmailDomains)
            ? security.allowedEmailDomains
            : [],
          inviteRequiresApproval: security.requireInviteApproval !== false,
          defaultInviteRole:
            security.defaultInviteRole === "moderator" ? "moderator" : "member",
        },
        updated_by: userId,
      },
      { onConflict: "room_id" }
    );
    if (saved.error) throw new ExpansionError(saved.error.message, 503);
  }
  return { ok: true, roomsUpdated: (rooms.data ?? []).length };
}
