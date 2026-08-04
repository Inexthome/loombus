import { NextResponse, type NextRequest } from "next/server";
import { createNotification, createNotifications } from "@/lib/notifications";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";
import { createRequestSupabase, createRoomServiceSupabase, getRoomAccess } from "@/lib/room-operations";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ roomId: string }> };
type Input = Record<string, unknown>;

function json(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: { "Cache-Control": "private, no-store" } });
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function bool(value: unknown) {
  return value === true;
}

function validUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function missingTable(error: unknown) {
  const message = String((error as { message?: unknown })?.message ?? error ?? "").toLowerCase();
  return message.includes("room_polls") && (message.includes("does not exist") || message.includes("schema cache"));
}

async function authorize(request: NextRequest, roomId: string) {
  const account = await verifyRequestAccountAccess(createRequestSupabase(request));
  if (!account.ok) return { ok: false as const, response: json({ error: account.error, code: account.code }, account.status) };
  const service = createRoomServiceSupabase();
  const access = await getRoomAccess(service, roomId, account.user.id).catch(() => null);
  if (!access) return { ok: false as const, response: json({ error: "Room not found." }, 404) };
  if (!access.allowed) return { ok: false as const, response: json({ error: "Room membership is required." }, 403) };
  return { ok: true as const, service, access, userId: account.user.id };
}

function eligible(role: string | null | undefined, requirement: string, canManage: boolean, canModerate: boolean) {
  if (requirement === "managers") return canManage;
  if (requirement === "board") return canManage || canModerate || role === "moderator";
  return true;
}

function pollState(row: Record<string, unknown>) {
  const now = Date.now();
  const opens = new Date(String(row.opens_at ?? "")).getTime();
  const closes = row.closes_at ? new Date(String(row.closes_at)).getTime() : null;
  if (String(row.status) === "cancelled") return "cancelled";
  if (String(row.status) === "closed" || (closes && closes <= now)) return "closed";
  if (Number.isFinite(opens) && opens > now) return "scheduled";
  return "open";
}

async function loadPolls(service: ReturnType<typeof createRoomServiceSupabase>, roomId: string, userId: string, access: Awaited<ReturnType<typeof getRoomAccess>>) {
  const pollsResult = await service.from("room_polls").select("*").eq("room_id", roomId).order("created_at", { ascending: false }).limit(100);
  if (pollsResult.error) {
    if (missingTable(pollsResult.error)) return { migrationRequired: true, message: "Room Polls require the pending database migration." };
    throw pollsResult.error;
  }
  const polls = (pollsResult.data ?? []) as Record<string, unknown>[];
  if (!polls.length) return { migrationRequired: false, room: access.room, access: { role: access.role, canManage: access.canManage, canModerate: access.canModerate }, polls: [] };
  const ids = polls.map((poll) => String(poll.id));
  const [optionsResult, ballotsResult, choicesResult] = await Promise.all([
    service.from("room_poll_options").select("*").in("poll_id", ids).order("position", { ascending: true }),
    service.from("room_poll_ballots").select("id,poll_id,voter_id,submitted_at,updated_at").in("poll_id", ids),
    service.from("room_poll_ballot_choices").select("ballot_id,option_id,poll_id").in("poll_id", ids),
  ]);
  if (optionsResult.error || ballotsResult.error || choicesResult.error) throw optionsResult.error ?? ballotsResult.error ?? choicesResult.error;
  const ballots = (ballotsResult.data ?? []) as Record<string, unknown>[];
  const choices = (choicesResult.data ?? []) as Record<string, unknown>[];
  const options = (optionsResult.data ?? []) as Record<string, unknown>[];

  return {
    migrationRequired: false,
    room: { id: access.room.id, name: access.room.name },
    access: { role: access.role, canManage: access.canManage, canModerate: access.canModerate },
    polls: polls.map((poll) => {
      const id = String(poll.id);
      const state = pollState(poll);
      const canVote = state === "open" && eligible(access.role, String(poll.eligibility), access.canManage, access.canModerate);
      const pollBallots = ballots.filter((ballot) => String(ballot.poll_id) === id);
      const mine = pollBallots.find((ballot) => String(ballot.voter_id) === userId);
      const mineChoices = mine ? choices.filter((choice) => String(choice.ballot_id) === String(mine.id)).map((choice) => String(choice.option_id)) : [];
      const showResults = state === "closed" || bool(poll.show_live_results) || access.canManage;
      const pollOptions = options.filter((option) => String(option.poll_id) === id).map((option) => {
        const optionId = String(option.id);
        const count = showResults ? choices.filter((choice) => String(choice.poll_id) === id && String(choice.option_id) === optionId).length : null;
        return { id: optionId, label: String(option.label), position: Number(option.position), voteCount: count };
      });
      return {
        id,
        title: String(poll.title),
        description: poll.description ? String(poll.description) : null,
        pollType: String(poll.poll_type),
        eligibility: String(poll.eligibility),
        anonymousVoting: bool(poll.anonymous_voting),
        showLiveResults: bool(poll.show_live_results),
        allowVoteChanges: bool(poll.allow_vote_changes),
        maxChoices: Number(poll.max_choices ?? 1),
        opensAt: String(poll.opens_at),
        closesAt: poll.closes_at ? String(poll.closes_at) : null,
        status: state,
        createdAt: String(poll.created_at),
        options: pollOptions,
        turnout: showResults ? pollBallots.length : null,
        hasVoted: Boolean(mine),
        myChoiceIds: mineChoices,
        canVote: canVote && (!mine || bool(poll.allow_vote_changes)),
        canManage: access.canManage,
        resultsVisible: showResults,
      };
    }),
  };
}

async function notifyEligibleMembers(service: ReturnType<typeof createRoomServiceSupabase>, roomId: string, actorId: string, pollId: string, title: string, requirement: string) {
  let query = service.from("room_members").select("user_id,role").eq("room_id", roomId).eq("status", "active");
  const result = await query;
  if (result.error) return;
  const recipients = (result.data ?? []).filter((member) => {
    const role = String(member.role ?? "member");
    if (requirement === "managers") return role === "owner" || role === "administrator";
    if (requirement === "board") return role === "owner" || role === "administrator" || role === "moderator";
    return true;
  }).map((member) => String(member.user_id)).filter((id) => id && id !== actorId);
  await createNotifications(recipients.map((userId) => ({ user_id: userId, actor_id: actorId, type: "room_poll_opened", message: `A new Room poll is open: ${title}`, target_type: "room_poll", target_id: pollId, room_id: roomId }))).catch(() => null);
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const { roomId } = await context.params;
    if (!validUuid(roomId)) return json({ error: "Invalid Room id." }, 400);
    const authorized = await authorize(request, roomId);
    if (!authorized.ok) return authorized.response;
    return json(await loadPolls(authorized.service, roomId, authorized.userId, authorized.access));
  } catch (error) {
    console.error("Room polls load failed:", error);
    return json({ error: "Room Polls could not be loaded." }, 500);
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const { roomId } = await context.params;
    if (!validUuid(roomId)) return json({ error: "Invalid Room id." }, 400);
    const authorized = await authorize(request, roomId);
    if (!authorized.ok) return authorized.response;
    const body = await request.json().catch(() => null) as Input | null;
    if (!body) return json({ error: "Invalid poll request." }, 400);
    const action = text(body.action);

    if (action === "create") {
      if (!authorized.access.canManage) return json({ error: "Room management permission is required." }, 403);
      const title = text(body.title);
      const pollType = ["single", "multiple", "yes_no", "approval"].includes(text(body.pollType)) ? text(body.pollType) : "single";
      const eligibility = ["members", "board", "managers"].includes(text(body.eligibility)) ? text(body.eligibility) : "members";
      let options = Array.isArray(body.options) ? body.options.map((value) => text(value)).filter(Boolean) : [];
      if (pollType === "yes_no") options = ["Yes", "No"];
      if (title.length < 3 || options.length < 2 || options.length > 20) return json({ error: "Provide a title and between 2 and 20 options." }, 400);
      const opensAt = text(body.opensAt, new Date().toISOString());
      const closesAt = text(body.closesAt) || null;
      const maxChoices = pollType === "multiple" || pollType === "approval" ? Math.max(1, Math.min(options.length, Number(body.maxChoices ?? options.length))) : 1;
      const inserted = await authorized.service.from("room_polls").insert({ room_id: roomId, created_by: authorized.userId, title, description: text(body.description) || null, poll_type: pollType, eligibility, anonymous_voting: bool(body.anonymousVoting), show_live_results: bool(body.showLiveResults), allow_vote_changes: bool(body.allowVoteChanges), max_choices: maxChoices, opens_at: opensAt, closes_at: closesAt, status: "open" }).select("id").single();
      if (inserted.error) {
        if (missingTable(inserted.error)) return json({ error: "Room Polls require the pending database migration.", code: "migration_required" }, 503);
        throw inserted.error;
      }
      const pollId = String(inserted.data.id);
      const optionInsert = await authorized.service.from("room_poll_options").insert(options.map((label, index) => ({ poll_id: pollId, room_id: roomId, label, position: index + 1 })));
      if (optionInsert.error) {
        await authorized.service.from("room_polls").delete().eq("id", pollId);
        throw optionInsert.error;
      }
      if (bool(body.notifyMembers)) await notifyEligibleMembers(authorized.service, roomId, authorized.userId, pollId, title, eligibility);
      return json({ ok: true, pollId }, 201);
    }

    if (action === "vote") {
      const pollId = text(body.pollId);
      const choiceIds = Array.isArray(body.choiceIds) ? [...new Set(body.choiceIds.map((value) => text(value)).filter(validUuid))] : [];
      if (!validUuid(pollId) || !choiceIds.length) return json({ error: "Select at least one option." }, 400);
      const pollResult = await authorized.service.from("room_polls").select("*").eq("id", pollId).eq("room_id", roomId).maybeSingle();
      if (pollResult.error || !pollResult.data) return json({ error: "Poll not found." }, 404);
      const poll = pollResult.data as Record<string, unknown>;
      if (pollState(poll) !== "open") return json({ error: "This poll is not open." }, 409);
      if (!eligible(authorized.access.role, String(poll.eligibility), authorized.access.canManage, authorized.access.canModerate)) return json({ error: "Your Room role is not eligible for this vote." }, 403);
      const maxChoices = Number(poll.max_choices ?? 1);
      if (choiceIds.length > maxChoices) return json({ error: `Select no more than ${maxChoices} option${maxChoices === 1 ? "" : "s"}.` }, 400);
      const validOptions = await authorized.service.from("room_poll_options").select("id").eq("poll_id", pollId).in("id", choiceIds);
      if (validOptions.error || (validOptions.data ?? []).length !== choiceIds.length) return json({ error: "One or more options are invalid." }, 400);
      const existing = await authorized.service.from("room_poll_ballots").select("id").eq("poll_id", pollId).eq("voter_id", authorized.userId).maybeSingle();
      if (existing.data && !bool(poll.allow_vote_changes)) return json({ error: "You have already voted in this poll." }, 409);
      let ballotId = existing.data?.id ? String(existing.data.id) : "";
      if (!ballotId) {
        const ballot = await authorized.service.from("room_poll_ballots").insert({ poll_id: pollId, room_id: roomId, voter_id: authorized.userId }).select("id").single();
        if (ballot.error) throw ballot.error;
        ballotId = String(ballot.data.id);
      } else {
        await authorized.service.from("room_poll_ballot_choices").delete().eq("ballot_id", ballotId);
        await authorized.service.from("room_poll_ballots").update({ updated_at: new Date().toISOString() }).eq("id", ballotId);
      }
      const insertedChoices = await authorized.service.from("room_poll_ballot_choices").insert(choiceIds.map((optionId) => ({ ballot_id: ballotId, option_id: optionId, poll_id: pollId, room_id: roomId })));
      if (insertedChoices.error) throw insertedChoices.error;
      return json({ ok: true });
    }

    if (action === "close" || action === "cancel") {
      if (!authorized.access.canManage) return json({ error: "Room management permission is required." }, 403);
      const pollId = text(body.pollId);
      if (!validUuid(pollId)) return json({ error: "Invalid poll." }, 400);
      const status = action === "close" ? "closed" : "cancelled";
      const updated = await authorized.service.from("room_polls").update({ status, updated_at: new Date().toISOString() }).eq("id", pollId).eq("room_id", roomId).select("id,created_by,title").maybeSingle();
      if (updated.error || !updated.data) return json({ error: "Poll could not be updated." }, 404);
      if (String(updated.data.created_by) !== authorized.userId) await createNotification({ user_id: String(updated.data.created_by), actor_id: authorized.userId, type: `room_poll_${status}`, message: `Your Room poll “${String(updated.data.title)}” was ${status}.`, target_type: "room_poll", target_id: pollId, room_id: roomId }).catch(() => null);
      return json({ ok: true });
    }

    return json({ error: "Unsupported poll action." }, 400);
  } catch (error) {
    console.error("Room poll action failed:", error);
    return json({ error: "Room Polls could not complete this request." }, 500);
  }
}
