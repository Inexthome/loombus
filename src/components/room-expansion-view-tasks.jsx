"use client";

import { CheckCircle2, ListTodo, MessageSquareText, Plus } from "lucide-react";
import { useState } from "react";
import { displayName, Empty, formatDate } from "@/components/room-expansion-ui";

export function TasksView({ data, manifest, members, working, action }) {
  const tasks = Array.isArray(data) ? data : [];
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [priority, setPriority] = useState("normal");
  const [recurrence, setRecurrence] = useState("none");
  const [subtasks, setSubtasks] = useState("");
  const [commentByTask, setCommentByTask] = useState({});

  async function create(event) {
    event.preventDefault();
    const completed = await action(
      {
        action: "create_task",
        title,
        description,
        assigneeId: assigneeId || null,
        dueAt: dueAt || null,
        priority,
        recurrence,
        subtasks: subtasks
          .split("\n")
          .map((label) => ({ label: label.trim(), done: false }))
          .filter((item) => item.label),
      },
      "Task created."
    );
    if (completed) {
      setTitle("");
      setDescription("");
      setAssigneeId("");
      setDueAt("");
      setPriority("normal");
      setRecurrence("none");
      setSubtasks("");
    }
  }

  return (
    <div className="room-expansion-grid">
      {manifest.access?.canManage ? (
        <form className="room-expansion-form" onSubmit={create}>
          <h3>Create an operational task</h3>
          <label><span>Task</span><input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={200} /></label>
          <label><span>Description</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} /></label>
          <div className="room-expansion-form-grid">
            <label><span>Assignee</span><select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}><option value="">Unassigned</option>{members.map((member) => <option key={member.userId} value={member.userId}>{displayName(member.profile, member.userId)}</option>)}</select></label>
            <label><span>Due</span><input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></label>
            <label><span>Priority</span><select value={priority} onChange={(event) => setPriority(event.target.value)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
            <label><span>Repeat</span><select value={recurrence} onChange={(event) => setRecurrence(event.target.value)}><option value="none">No recurrence</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
          </div>
          <label><span>Subtasks, one per line</span><textarea rows={4} value={subtasks} onChange={(event) => setSubtasks(event.target.value)} /></label>
          <button type="submit" disabled={working || !title.trim()}><Plus aria-hidden="true" /> Add task</button>
        </form>
      ) : null}

      <div className="room-expansion-list">
        {tasks.length ? tasks.map((task) => {
          const metadata = task.metadata ?? {};
          const taskComment = commentByTask[task.id] ?? "";
          return (
            <article key={task.id} className={`room-expansion-card is-${task.status}`}>
              <header><div><span>{metadata.priority || "normal"}</span><small>{metadata.dueAt ? `Due ${formatDate(metadata.dueAt)}` : "No due date"}</small></div><strong>{task.status.replaceAll("_", " ")}</strong></header>
              <h3>{task.title}</h3>
              {task.body ? <p>{task.body}</p> : null}
              {Array.isArray(metadata.subtasks) && metadata.subtasks.length ? (
                <div className="room-expansion-checklist">
                  {metadata.subtasks.map((subtask) => (
                    <label key={subtask.id}>
                      <input
                        type="checkbox"
                        checked={subtask.done === true}
                        disabled={!task.canUpdate || working}
                        onChange={() => void action({
                          action: "update_task",
                          recordId: task.id,
                          subtasks: metadata.subtasks.map((item) => item.id === subtask.id ? { ...item, done: !item.done } : item),
                        }, "Subtask updated.")}
                      />
                      <span>{subtask.label}</span>
                    </label>
                  ))}
                </div>
              ) : null}
              {task.canUpdate ? (
                <div className="room-expansion-inline-actions">
                  {task.status !== "in_progress" ? <button type="button" onClick={() => void action({ action: "update_task", recordId: task.id, status: "in_progress" }, "Task moved to in progress.")} disabled={working}>Start</button> : null}
                  {task.status !== "blocked" ? <button type="button" onClick={() => void action({ action: "update_task", recordId: task.id, status: "blocked" }, "Task marked blocked.")} disabled={working}>Block</button> : null}
                  {task.status !== "completed" ? <button type="button" onClick={() => void action({ action: "update_task", recordId: task.id, status: "completed" }, "Task completed.")} disabled={working}><CheckCircle2 aria-hidden="true" /> Complete</button> : null}
                </div>
              ) : null}
              <details className="room-expansion-details">
                <summary><MessageSquareText aria-hidden="true" /> {task.comments?.length ?? 0} comments</summary>
                <div className="room-expansion-comments">
                  {(task.comments ?? []).map((comment) => <p key={comment.id}><strong>{displayName(comment.author, comment.authorId)}</strong><span>{comment.body}</span><small>{formatDate(comment.createdAt)}</small></p>)}
                  <div className="room-expansion-comment-composer"><input value={taskComment} onChange={(event) => setCommentByTask((current) => ({ ...current, [task.id]: event.target.value }))} placeholder="Add a task comment" /><button type="button" disabled={working || !taskComment.trim()} onClick={async () => { const saved = await action({ action: "add_task_comment", recordId: task.id, comment: taskComment }, "Comment added."); if (saved) setCommentByTask((current) => ({ ...current, [task.id]: "" })); }}>Post</button></div>
                </div>
              </details>
            </article>
          );
        }) : <Empty Icon={ListTodo} title="No operational tasks" text="Create assigned work with subtasks, recurrence, comments, and status tracking." />}
      </div>
    </div>
  );
}
