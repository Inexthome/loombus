"use client";

import { Download, Files, FolderOpen, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Empty, formatBytes, formatDate } from "@/components/room-expansion-ui";

const BUCKET = "room-resources";

export function FilesView({ data, working, action }) {
  const resources = Array.isArray(data?.resources) ? data.resources : [];
  const current = resources.filter((resource) => resource.isCurrent);
  const [folderPath, setFolderPath] = useState("/");
  const [replaceResourceId, setReplaceResourceId] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const inputRef = useRef(null);

  async function upload() {
    if (!selectedFile) return;
    const prepared = await action({ action: "prepare_file_upload", fileName: selectedFile.name, mimeType: selectedFile.type, fileSizeBytes: selectedFile.size, folderPath, replaceResourceId: replaceResourceId || null }, "Secure upload prepared.", "files");
    if (!prepared?.storagePath || !prepared?.token) return;
    const uploaded = await supabase.storage.from(BUCKET).uploadToSignedUrl(prepared.storagePath, prepared.token, selectedFile, { contentType: prepared.mimeType || selectedFile.type || undefined });
    if (uploaded.error) { window.alert(uploaded.error.message); return; }
    const completed = await action({ action: "complete_file_upload", ...prepared }, replaceResourceId ? "New file version uploaded." : "File uploaded.", "files");
    if (completed) { setSelectedFile(null); setReplaceResourceId(""); if (inputRef.current) inputRef.current.value = ""; }
  }

  const grouped = current.reduce((map, resource) => { const folder = resource.folderPath || "/"; if (!map[folder]) map[folder] = []; map[folder].push(resource); return map; }, {});
  return <div className="room-expansion-grid"><section className="room-expansion-form"><h3>Upload or replace a private file</h3><label><span>Folder</span><input value={folderPath} onChange={(event) => setFolderPath(event.target.value)} placeholder="/Policies" /></label><label><span>Replace an existing file</span><select value={replaceResourceId} onChange={(event) => setReplaceResourceId(event.target.value)}><option value="">Create a new file</option>{current.map((resource) => <option key={resource.id} value={resource.id}>{resource.fileName} · v{resource.versionNumber}</option>)}</select></label><input ref={inputRef} type="file" onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} /><button type="button" disabled={working || !selectedFile} onClick={() => void upload()}><Upload aria-hidden="true" /> {replaceResourceId ? "Upload new version" : "Upload file"}</button><small>{formatBytes(data?.usedBytes)} used · folder and version history remain private to active Room members.</small></section><div className="room-expansion-list">{Object.keys(grouped).length ? Object.entries(grouped).map(([folder, files]) => <section key={folder} className="room-expansion-folder"><h3><FolderOpen aria-hidden="true" /> {folder}</h3>{files.map((resource) => { const history = resources.filter((candidate) => candidate.versionGroupId === resource.versionGroupId).sort((a, b) => b.versionNumber - a.versionNumber); return <article key={resource.id} className="room-expansion-card"><header><div><span>version {resource.versionNumber}</span><small>{formatBytes(resource.fileSizeBytes)} · {formatDate(resource.createdAt)}</small></div>{resource.url ? <a href={resource.url} target="_blank" rel="noopener noreferrer"><Download aria-hidden="true" /> Open</a> : null}</header><h3>{resource.fileName}</h3><div className="room-expansion-inline-actions"><button type="button" onClick={() => { const next = window.prompt("Move to folder", resource.folderPath || "/"); if (next !== null) void action({ action: "move_file", resourceId: resource.id, folderPath: next }, "File moved."); }}>Move</button></div>{history.length > 1 ? <details className="room-expansion-details"><summary>{history.length} versions</summary>{history.map((version) => <div key={version.id} className="room-expansion-version"><span>v{version.versionNumber} · {formatDate(version.createdAt)}</span>{version.url ? <a href={version.url} target="_blank" rel="noopener noreferrer">Open</a> : null}</div>)}</details> : null}</article>; })}</section>) : <Empty Icon={Files} title="No private files" text="Upload files into folders and replace them without losing earlier versions." />}</div></div>;
}
