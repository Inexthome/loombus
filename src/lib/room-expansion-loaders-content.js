import "server-only";

import { asObject, ensureRoomModule, loadProfilesMap, serializeRecord, ExpansionError } from "@/lib/room-expansion-service";
import { asNumber, asString, profileFor } from "@/lib/room-operations";

async function recordsFor(service, roomId, moduleKey) {
  const result = await service
    .from("room_module_records")
    .select("*")
    .eq("room_id", roomId)
    .eq("module_key", moduleKey)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(300);
  if (result.error) throw new ExpansionError(result.error.message, 503);
  return (result.data ?? []).map(serializeRecord);
}

function pollResultsVisible(record, access, ownResponse, isClosed) {
  if (access.canManage) return true;
  const visibility = asString(record.metadata.resultVisibility) || "after_vote";
  if (visibility === "always") return true;
  if (visibility === "after_close") return isClosed;
  if (visibility === "managers") return false;
  return Boolean(ownResponse) || isClosed;
}

export async function loadPolls(service, roomId, access, userId) {
  ensureRoomModule(access, "polls");
  const records = await recordsFor(service, roomId, "poll");
  const ids = records.map((record) => record.id);
  const responsesResult = ids.length
    ? await service
        .from("room_module_responses")
        .select("record_id, responder_id, payload, created_at, updated_at")
        .eq("room_id", roomId)
        .eq("response_type", "poll_vote")
        .in("record_id", ids)
    : { data: [], error: null };
  if (responsesResult.error) {
    throw new ExpansionError(responsesResult.error.message, 503);
  }
  const responses = responsesResult.data ?? [];
  const now = Date.now();
  return records.map((record) => {
    const matching = responses.filter(
      (response) => asString(response.record_id) === record.id
    );
    const own = matching.find(
      (response) => asString(response.responder_id) === userId
    );
    const closesAt = asString(record.metadata.closesAt);
    const isClosed =
      record.status === "closed" ||
      (closesAt ? new Date(closesAt).getTime() <= now : false);
    const counts = {};
    for (const response of matching) {
      const optionIds = Array.isArray(asObject(response.payload).optionIds)
        ? asObject(response.payload).optionIds.map(asString).filter(Boolean)
        : [];
      for (const optionId of optionIds) counts[optionId] = (counts[optionId] ?? 0) + 1;
    }
    const quorum = Math.max(0, asNumber(record.metadata.quorum));
    const visible = pollResultsVisible(record, access, own, isClosed);
    return {
      ...record,
      isClosed,
      totalResponses: matching.length,
      quorum,
      quorumMet: quorum === 0 || matching.length >= quorum,
      ownResponse: own ? asObject(own.payload) : null,
      optionCounts: visible ? counts : null,
      resultsVisible: visible,
    };
  });
}

export async function loadForms(service, roomId, access, userId) {
  ensureRoomModule(access, "forms");
  const records = await recordsFor(service, roomId, "form");
  const ids = records.map((record) => record.id);
  let query = ids.length
    ? service
        .from("room_module_responses")
        .select("*")
        .eq("room_id", roomId)
        .eq("response_type", "form_submission")
        .in("record_id", ids)
    : null;
  if (query && !access.canManage) query = query.eq("responder_id", userId);
  const responseResult = query ? await query.order("created_at", { ascending: false }) : { data: [], error: null };
  if (responseResult.error) throw new ExpansionError(responseResult.error.message, 503);
  const responses = responseResult.data ?? [];
  const profiles = access.canManage
    ? await loadProfilesMap(
        service,
        responses.map((response) => asString(response.responder_id))
      )
    : new Map();
  return records.map((record) => ({
    ...record,
    submissions: responses
      .filter((response) => asString(response.record_id) === record.id)
      .map((response) => {
        const responderId = asString(response.responder_id);
        return {
          id: asString(response.id),
          responderId: access.canManage ? responderId : undefined,
          responder: access.canManage ? profileFor(profiles, responderId) : undefined,
          payload: asObject(response.payload),
          createdAt: asString(response.created_at) || null,
          updatedAt: asString(response.updated_at) || null,
        };
      }),
  }));
}

export async function loadKnowledge(service, roomId, access) {
  ensureRoomModule(access, "knowledge");
  const records = await recordsFor(service, roomId, "knowledge");
  const visible = access.canManage
    ? records
    : records.filter((record) => record.status === "published");
  const ids = visible.map((record) => record.id);
  const versionResult = ids.length
    ? await service
        .from("room_knowledge_versions")
        .select("*")
        .eq("room_id", roomId)
        .in("record_id", ids)
        .order("version_number", { ascending: false })
    : { data: [], error: null };
  if (versionResult.error) throw new ExpansionError(versionResult.error.message, 503);
  const versions = versionResult.data ?? [];
  return visible.map((record) => ({
    ...record,
    versions: access.canManage
      ? versions
          .filter((version) => asString(version.record_id) === record.id)
          .map((version) => ({
            id: asString(version.id),
            versionNumber: asNumber(version.version_number),
            title: asString(version.title),
            body: asString(version.body),
            metadata: asObject(version.metadata),
            createdBy: asString(version.created_by),
            createdAt: asString(version.created_at) || null,
          }))
      : [],
  }));
}
