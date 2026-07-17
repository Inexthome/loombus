"use client";

import { ClipboardList, Download, Plus } from "lucide-react";
import { useState } from "react";
import { Empty, parseFieldLines } from "@/components/room-expansion-ui";

export function FormsView({ data, manifest, working, action, request }) {
  const forms = Array.isArray(data) ? data : [];
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fieldLines, setFieldLines] = useState("Name|text|yes\nEmail|email|yes");
  const [confirmation, setConfirmation] = useState("");
  const [values, setValues] = useState({});

  async function exportCsv(recordId, title) {
    const params = new URLSearchParams({ recordId });
    const response = await request("form_export", undefined, params);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${title.replace(/[^a-z0-9_-]+/gi, "-")}-submissions.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return <div className="room-expansion-grid">{manifest.access?.canManage ? <form className="room-expansion-form" onSubmit={async (event) => { event.preventDefault(); const saved = await action({ action: "create_form", title, description, fields: parseFieldLines(fieldLines), confirmationMessage: confirmation }, "Form created."); if (saved) { setTitle(""); setDescription(""); } }}><h3>Build a validated form</h3><label><span>Form title</span><input value={title} onChange={(event) => setTitle(event.target.value)} required /></label><label><span>Description</span><textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></label><label><span>Fields: Label | type | required | select options</span><textarea rows={7} value={fieldLines} onChange={(event) => setFieldLines(event.target.value)} /><small>Types: text, textarea, email, number, date, select, checkbox. Separate select choices with semicolons.</small></label><label><span>Confirmation message</span><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label><button type="submit" disabled={working || !title.trim()}><Plus aria-hidden="true" /> Create form</button></form> : null}<div className="room-expansion-list">{forms.length ? forms.map((form) => <article key={form.id} className="room-expansion-card"><header><div><span>form</span><small>{form.submissions?.length ?? 0} visible submissions</small></div>{manifest.access?.canManage ? <button type="button" onClick={() => void exportCsv(form.id, form.title)}><Download aria-hidden="true" /> CSV</button> : null}</header><h3>{form.title}</h3>{form.body ? <p>{form.body}</p> : null}<div className="room-expansion-fields">{(form.metadata?.fields ?? []).map((field) => <label key={field.id}><span>{field.label}{field.required ? " *" : ""}</span>{field.type === "textarea" ? <textarea value={values[`${form.id}:${field.id}`] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [`${form.id}:${field.id}`]: event.target.value }))} /> : field.type === "select" ? <select value={values[`${form.id}:${field.id}`] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [`${form.id}:${field.id}`]: event.target.value }))}><option value="">Choose</option>{(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}</select> : field.type === "checkbox" ? <input type="checkbox" checked={values[`${form.id}:${field.id}`] === true} onChange={(event) => setValues((current) => ({ ...current, [`${form.id}:${field.id}`]: event.target.checked }))} /> : <input type={field.type === "date" ? "date" : field.type === "number" ? "number" : field.type === "email" ? "email" : "text"} value={values[`${form.id}:${field.id}`] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [`${form.id}:${field.id}`]: event.target.value }))} />}</label>)}</div><button type="button" disabled={working} onClick={() => void action({ action: "submit_form", recordId: form.id, values: Object.fromEntries((form.metadata?.fields ?? []).map((field) => [field.id, values[`${form.id}:${field.id}`] ?? (field.type === "checkbox" ? false : "")])) }, "Form submitted.")}><ClipboardList aria-hidden="true" /> Submit</button>{manifest.access?.canManage && form.submissions?.length ? <details className="room-expansion-details"><summary>Review submissions</summary>{form.submissions.map((submission) => <pre key={submission.id}>{JSON.stringify(submission.payload?.values ?? {}, null, 2)}</pre>)}</details> : null}</article>) : <Empty Icon={ClipboardList} title="No forms yet" text="Build validated forms with typed fields, required answers, confirmations, and CSV export." />}</div></div>;
}
