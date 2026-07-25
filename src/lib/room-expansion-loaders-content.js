import "server-only";

import {
  asObject,
  ensureRoomModule,
  loadProfilesMap,
  serializeRecord,
  ExpansionError,
} from "@/lib/room-expansion-service";
import { loadStudioPage } from "@/lib/room-expansion-pagination";
import { asNumber, asString, profileFor } from "@/lib/room-operations";

const MAX_POLL_RESPONSES = 5000;
const MAX_FORM_SUBMISSIONS = 1200;
const MAX_KNOWLEDGE_VERSIONS = 1200;

async function pagedRecords(
  service,
  roomId,
  moduleKey,
  paging,
  { publishedOnly = false } = {}
) {
  const loaded = await loadStudioPage(
    ({ from, to }) => {
      let query = service
        .from("room_module_records")
        .select("*", { count: "exact" })
        .eq("room_id", roomId)
        .eq("module_key", moduleKey)
        .is("archived_at", null);
      if (publishedOnly) query = query.eq("status", "published");
      return query.order("created_at", { ascending: false }).range(from, to);
    },
    paging
  );
  if (loaded.result.error) {
    throw new ExpansionError(loaded.result.error.message, 503);
  }
  return {
    records: (loaded.result.data ?? []).map(serializeRecord),
    pageInfo: loaded.pageInfo,
  };
}

function pollResultsVisible(record, access, ownResponse, isClosed) {
  if (access.canManage) return true;
  const visibility = asString(record.metadata.resultVisibility) || "after_vote";
  if (visibility === "always") return true;
  if (visibility === "after_close") return isClosed;
  if (visibility === "managers") return false;
  return Boolean(ownResponse) || isClosed;
}

export async function loadPolls(
  service,
  roomId,
  access,
  userId,
  paging = {}
) {
  ensureRoomModule(access, "polls");
  const loaded = await pagedRecords(service, roomId, "poll", paging);
  const ids = loaded.records.map((record) => record.id);
  const responsesResult = ids.length
    ? await service
        .from("room_module_responses")
        .select("record_id, responder_id, payload, created_at, updated_at")
        .eq("room_id", roomId)
        .eq("response_type", "poll_vote")
        .in("record_id", ids)
        .limit(MAX_POLL_RESPONSES)
    : { data: [], error: null };
  if (responsesResult.error) {
    throw new ExpansionError(responsesResult.error.message, 503);
  }
  const responses = responsesResult.data ?? [];
  const now = Date.now();

  return {
    items: loaded.records.map((record) => {
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
        for (const optionId of optionIds) {
          counts[optionId] = (counts[optionId] ?? 0) + 1;
        }
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
    }),
    pageInfo: loaded.pageInfo,
    limits: {
      responses: MAX_POLL_RESPONSES,
      relatedRowsTruncated: responses.length >= MAX_POLL_RESPONSES,
    },
  };
}

export async function loadForms(
  service,
  roomId,
  access,
  userId,
  paging = {}
) {
  ensureRoomModule(access, "forms");
  const loaded = await pagedRecords(service, roomId, "form", paging);
  const ids = loaded.records.map((record) => record.id);
  let query = ids.length
    ? service
        .from("room_module_responses")
        .select("*")
        .eq("room_id", roomId)
        .eq("response_type", "form_submission")
        .in("record_id", ids)
    : null;
  if (query && !access.canManage) query = query.eq("responder_id", userId);
  const responseResult = query
    ? await query
        .order("created_at", { ascending: false })
        .limit(MAX_FORM_SUBMISSIONS)
    : { data: [], error: null };
  if (responseResult.error) {
    throw new ExpansionError(responseResult.error.message, 503);
  }
  const responses = responseResult.data ?? [];
  const profiles = access.canManage
    ? await loadProfilesMap(
        service,
        responses.map((response) => asString(response.responder_id))
      )
    : new Map();

  return {
    items: loaded.records.map((record) => ({
      ...record,
      submissions: responses
        .filter((response) => asString(response.record_id) === record.id)
        .map((response) => {
          const responderId = asString(response.responder_id);
          return {
            id: asString(response.id),
            responderId: access.canManage ? responderId : undefined,
            responder: access.canManage
              ? profileFor(profiles, responderId)
              : undefined,
            payload: asObject(response.payload),
            createdAt: asString(response.created_at) || null,
            updatedAt: asString(response.updated_at) || null,
          };
        }),
    })),
    pageInfo: loaded.pageInfo,
    limits: {
      submissions: MAX_FORM_SUBMISSIONS,
      relatedRowsTruncated: responses.length >= MAX_FORM_SUBMISSIONS,
    },
  };
}

export async function loadKnowledge(
  service,
  roomId,
  access,
  paging = {}
) {
  ensureRoomModule(access, "knowledge");
  const loaded = await pagedRecords(service, roomId, "knowledge", paging, {
    publishedOnly: !access.canManage,
  });
  const ids = loaded.records.map((record) => record.id);
  const versionResult =
    access.canManage && ids.length
      ? await service
          .from("room_knowledge_versions")
          .select("*")
          .eq("room_id", roomId)
          .in("record_id", ids)
          .order("version_number", { ascending: false })
          .limit(MAX_KNOWLEDGE_VERSIONS)
      : { data: [], error: null };
  if (versionResult.error) {
    throw new ExpansionError(versionResult.error.message, 503);
  }
  const versions = versionResult.data ?? [];

  return {
    items: loaded.records.map((record) => ({
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
    })),
    pageInfo: loaded.pageInfo,
    limits: {
      versions: MAX_KNOWLEDGE_VERSIONS,
      relatedRowsTruncated: versions.length >= MAX_KNOWLEDGE_VERSIONS,
    },
  };
}
