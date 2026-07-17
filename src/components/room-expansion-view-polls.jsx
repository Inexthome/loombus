"use client";

import { Plus, Vote } from "lucide-react";
import { useState } from "react";
import { Empty } from "@/components/room-expansion-ui";

export function PollsView({ data, manifest, working, action }) {
  const polls = Array.isArray(data) ? data : [];
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [options, setOptions] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [quorum, setQuorum] = useState("");
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [visibility, setVisibility] = useState("after_vote");
  const [choices, setChoices] = useState({});

  return (
    <div className="room-expansion-grid">
      {manifest.access?.canManage ? (
        <form className="room-expansion-form" onSubmit={async (event) => { event.preventDefault(); const saved = await action({ action: "create_poll", title, description, options: options.split("\n"), closesAt: closesAt || null, quorum: Number(quorum || 0), allowMultiple, anonymous, resultVisibility: visibility }, "Poll created."); if (saved) { setTitle(""); setDescription(""); setOptions(""); setClosesAt(""); setQuorum(""); } }}>
          <h3>Create a governed decision</h3>
          <label><span>Question</span><input value={title} onChange={(event) => setTitle(event.target.value)} required /></label>
          <label><span>Context</span><textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
          <label><span>Options, one per line</span><textarea rows={5} value={options} onChange={(event) => setOptions(event.target.value)} required /></label>
          <div className="room-expansion-form-grid">
            <label><span>Closes</span><input type="datetime-local" value={closesAt} onChange={(event) => setClosesAt(event.target.value)} /></label>
            <label><span>Quorum</span><input type="number" min="0" value={quorum} onChange={(event) => setQuorum(event.target.value)} /></label>
            <label><span>Results</span><select value={visibility} onChange={(event) => setVisibility(event.target.value)}><option value="always">Always visible</option><option value="after_vote">After voting</option><option value="after_close">After close</option><option value="managers">Managers only</option></select></label>
          </div>
          <div className="room-expansion-toggle-row"><label><input type="checkbox" checked={allowMultiple} onChange={(event) => setAllowMultiple(event.target.checked)} /> Multiple selections</label><label><input type="checkbox" checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)} /> Anonymous decision</label></div>
          <button type="submit" disabled={working || !title.trim() || options.split("\n").filter((item) => item.trim()).length < 2}><Plus aria-hidden="true" /> Create poll</button>
        </form>
      ) : null}
      <div className="room-expansion-list">
        {polls.length ? polls.map((poll) => {
          const selected = choices[poll.id] ?? poll.ownResponse?.optionIds ?? [];
          const multiple = poll.metadata?.allowMultiple === true;
          return <article key={poll.id} className="room-expansion-card"><header><div><span>{poll.isClosed ? "closed" : "open"}</span><small>{poll.totalResponses} responses · {poll.quorum ? `${poll.quorumMet ? "Quorum met" : `Quorum ${poll.quorum}`}` : "No quorum"}</small></div>{manifest.access?.canManage && !poll.isClosed ? <button type="button" onClick={() => void action({ action: "close_poll", recordId: poll.id }, "Poll closed.")}>Close</button> : null}</header><h3>{poll.title}</h3>{poll.body ? <p>{poll.body}</p> : null}<div className="room-expansion-options">{(poll.metadata?.options ?? []).map((option) => <label key={option.id}><input type={multiple ? "checkbox" : "radio"} name={`poll-${poll.id}`} checked={selected.includes(option.id)} disabled={poll.isClosed} onChange={() => setChoices((current) => ({ ...current, [poll.id]: multiple ? selected.includes(option.id) ? selected.filter((id) => id !== option.id) : [...selected, option.id] : [option.id] }))} /><span>{option.label}</span>{poll.resultsVisible ? <strong>{poll.optionCounts?.[option.id] ?? 0}</strong> : null}</label>)}</div>{!poll.isClosed ? <button type="button" disabled={working || selected.length === 0} onClick={() => void action({ action: "vote_poll", recordId: poll.id, optionIds: selected }, "Vote recorded.")}><Vote aria-hidden="true" /> Record vote</button> : null}{!poll.resultsVisible ? <small>Results are hidden by this poll's visibility policy.</small> : null}</article>;
        }) : <Empty Icon={Vote} title="No decisions yet" text="Create private polls with quorum, anonymous voting, result visibility, and closing rules." />}
      </div>
    </div>
  );
}
