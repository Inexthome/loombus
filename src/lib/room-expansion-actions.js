import "server-only";

import { logAuditEvent } from "@/lib/audit-log";
import { ExpansionError, serializePlan } from "@/lib/room-expansion-service";
import { asString } from "@/lib/room-operations";
import { createTask, updateTask, addTaskComment } from "@/lib/room-expansion-actions-tasks";
import { createPoll, votePoll, closePoll, createForm, submitForm } from "@/lib/room-expansion-actions-decisions";
import { saveKnowledge, restoreKnowledge, createCalendarEvent, rsvpEvent } from "@/lib/room-expansion-actions-content";
import { prepareFileUpload, completeFileUpload, moveFile } from "@/lib/room-expansion-actions-files";
import { saveOrganization, propagateOrganizationSecurity } from "@/lib/room-expansion-actions-organization";

export async function handleExpansionAction({ service, access, userId, body }) {
  const action = asString(body.action);
  let result;
  if (action === "create_task") result = await createTask(service, access, userId, body);
  else if (action === "update_task") result = await updateTask(service, access, userId, body);
  else if (action === "add_task_comment") result = await addTaskComment(service, access, userId, body);
  else if (action === "create_poll") result = await createPoll(service, access, userId, body);
  else if (action === "vote_poll") result = await votePoll(service, access, userId, body);
  else if (action === "close_poll") result = await closePoll(service, access, body);
  else if (action === "create_form") result = await createForm(service, access, userId, body);
  else if (action === "submit_form") result = await submitForm(service, access, userId, body);
  else if (action === "save_knowledge") result = await saveKnowledge(service, access, userId, body);
  else if (action === "restore_knowledge") result = await restoreKnowledge(service, access, userId, body);
  else if (action === "create_calendar_event") result = await createCalendarEvent(service, access, userId, body);
  else if (action === "rsvp_event") result = await rsvpEvent(service, access, userId, body);
  else if (action === "prepare_file_upload") result = await prepareFileUpload(service, access, body);
  else if (action === "complete_file_upload") result = await completeFileUpload(service, access, userId, body);
  else if (action === "move_file") result = await moveFile(service, access, userId, body);
  else if (action === "save_organization") result = await saveOrganization(service, access, userId, body);
  else if (action === "propagate_organization_security") {
    result = await propagateOrganizationSecurity(service, access, userId);
  } else {
    throw new ExpansionError("Unknown Room Studio action.", 400);
  }

  await logAuditEvent({
    actor_id: userId,
    action: `room.expansion.${action}`,
    target_type: "room",
    target_id: access.room.id,
    metadata: {
      room_id: access.room.id,
      room_plan: serializePlan(access).id,
      organization_id: asString(access.rawRoom.organization_id) || null,
    },
  });
  return result;
}
