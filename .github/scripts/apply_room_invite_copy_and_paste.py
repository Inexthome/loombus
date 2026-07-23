from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    file_path = Path(path)
    source = file_path.read_text()
    if old not in source:
        raise RuntimeError(f"{label} no longer matches {path}")
    file_path.write_text(source.replace(old, new, 1))


workspace_path = "src/components/room-tier-modules-workspace.tsx"
replace_once(
    workspace_path,
    '''function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function findPortalHosts(): PortalHosts | null {''',
    '''function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

async function copyTextToClipboard(value: string) {
  const text = value.trim();
  if (!text) return false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the selection-based copy fallback below.
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

function findPortalHosts(): PortalHosts | null {''',
    "clipboard helper",
)
replace_once(
    workspace_path,
    '''  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  const [highCapacityPage, setHighCapacityPage] = useState(1);''',
    '''  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  const [latestInviteUrl, setLatestInviteUrl] = useState("");
  const [highCapacityPage, setHighCapacityPage] = useState(1);''',
    "latest invitation state",
)
replace_once(
    workspace_path,
    '''      setMessage(successMessage);
      if (result.inviteUrl) {
        await navigator.clipboard.writeText(result.inviteUrl).catch(() => undefined);
        setMessage("Secure invitation link created and copied.");
      }
      await loadModule(moduleKey);''',
    '''      const inviteUrl = result.inviteUrl?.trim() ?? "";
      if (payload.action === "create_invite" && !inviteUrl) {
        throw new Error(
          "The invitation was created without a usable link. Revoke it and try again."
        );
      }

      setMessage(successMessage);
      if (inviteUrl) {
        setLatestInviteUrl(inviteUrl);
        const copied = await copyTextToClipboard(inviteUrl);
        setMessage(
          copied
            ? "Secure invitation link created and copied."
            : "Secure invitation link created. Copy it from the field below."
        );
      }
      await loadModule(moduleKey);''',
    "invite copy result handling",
)
replace_once(
    workspace_path,
    '''  if (!roomId || !hosts) return null;

  const modules = manifest?.modules ?? [];''',
    '''  async function copyLatestInviteLink() {
    if (!latestInviteUrl) return;
    const copied = await copyTextToClipboard(latestInviteUrl);
    setMessage(
      copied
        ? "Secure invitation link copied."
        : "Automatic copying is unavailable. Select the link and copy it manually."
    );
    setMessageIsError(!copied);
  }

  if (!roomId || !hosts) return null;

  const modules = manifest?.modules ?? [];''',
    "manual invitation copy handler",
)
replace_once(
    workspace_path,
    '''        {message ? (
          <div className={`rooms-live-notice${messageIsError ? " is-error" : ""}`}>
            {message}
          </div>
        ) : null}

        {!selectedModuleReady ? (''',
    '''        {message ? (
          <div className={`rooms-live-notice${messageIsError ? " is-error" : ""}`}>
            {message}
          </div>
        ) : null}

        {selectedModule === "invites" && latestInviteUrl ? (
          <div className="room-tier-create-card" role="status">
            <label>
              <span>New invitation link</span>
              <input
                type="url"
                value={latestInviteUrl}
                readOnly
                onFocus={(event) => event.currentTarget.select()}
                aria-label="New Room invitation link"
              />
            </label>
            <button
              type="button"
              className="rooms-live-secondary-action"
              onClick={() => void copyLatestInviteLink()}
            >
              <Copy aria-hidden="true" />
              Copy invitation link
            </button>
            <small>
              Keep this page open until you have saved the link. For security, the full
              token cannot be reconstructed after you leave.
            </small>
          </div>
        ) : null}

        {!selectedModuleReady ? (''',
    "visible invitation fallback",
)

rooms_path = "src/app/rooms/live-rooms-client.tsx"
replace_once(
    rooms_path,
    '''  LockKeyhole,
  MessageSquareText,''',
    '''  Link2,
  LockKeyhole,
  MessageSquareText,''',
    "Room invitation icon import",
)
replace_once(
    rooms_path,
    '''import { useCallback, useEffect, useMemo, useState } from "react";''',
    '''import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";''',
    "Room invitation form event import",
)
replace_once(
    rooms_path,
    '''function roleLabel(role: RoomRole) {
  if (role === "owner") return "Owner";
  if (role === "administrator") return "Administrator";
  if (role === "moderator") return "Moderator";
  return "Member";
}

export default function LiveRoomsClient() {''',
    '''function roleLabel(role: RoomRole) {
  if (role === "owner") return "Owner";
  if (role === "administrator") return "Administrator";
  if (role === "moderator") return "Moderator";
  return "Member";
}

function roomInviteToken(value: string) {
  const input = value.trim();
  if (!input) return null;

  const tokenPattern = /^[A-Za-z0-9_-]{20,300}$/;
  if (tokenPattern.test(input)) return input;

  try {
    const invitation = new URL(input, "https://loombus.com");
    const pathname = invitation.pathname.replace(/\\/+$/, "") || "/";
    if (pathname !== "/rooms/join") return null;
    const token = invitation.searchParams.get("token")?.trim() ?? "";
    return tokenPattern.test(token) ? token : null;
  } catch {
    return null;
  }
}

export default function LiveRoomsClient() {''',
    "Room invitation parser",
)
replace_once(
    rooms_path,
    '''  const [message, setMessage] = useState("");
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);''',
    '''  const [message, setMessage] = useState("");
  const [inviteInput, setInviteInput] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);''',
    "Room invitation input state",
)
replace_once(
    rooms_path,
    '''  const visibleRooms = useMemo(() => {
    const normalized = query.trim().toLowerCase();''',
    '''  function joinWithInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = roomInviteToken(inviteInput);
    if (!token) {
      setInviteMessage(
        "Paste a complete Loombus Room invitation link or a valid invitation token."
      );
      return;
    }

    setInviteMessage("");
    window.location.assign(`/rooms/join?token=${encodeURIComponent(token)}`);
  }

  const visibleRooms = useMemo(() => {
    const normalized = query.trim().toLowerCase();''',
    "Room invitation submit handler",
)
replace_once(
    rooms_path,
    '''        <section className="rooms-live-directory">
          <div className="rooms-live-directory-heading">''',
    '''        <section className="rooms-live-directory rooms-live-invite-entry">
          <div className="rooms-live-directory-heading">
            <div>
              <p className="rooms-live-eyebrow">Join a private Room</p>
              <h2>Paste a Room invitation link.</h2>
              <p>
                Loombus verifies the invitation, your account, the Room capacity, and
                any approval requirements before granting access.
              </p>
            </div>
          </div>
          <form className="rooms-live-toolbar" onSubmit={joinWithInvitation}>
            <label className="rooms-live-search">
              <Link2 aria-hidden="true" />
              <span className="sr-only">Room invitation link or token</span>
              <input
                type="text"
                value={inviteInput}
                onChange={(event) => {
                  setInviteInput(event.target.value);
                  setInviteMessage("");
                }}
                placeholder="Paste the Loombus Room invitation link"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </label>
            <button type="submit" className="rooms-live-primary-action">
              <ArrowRight aria-hidden="true" />
              Join Room
            </button>
          </form>
          {inviteMessage ? (
            <div className="rooms-live-notice is-error" role="alert">
              {inviteMessage}
            </div>
          ) : null}
        </section>

        <section className="rooms-live-directory">
          <div className="rooms-live-directory-heading">''',
    "Rooms invitation entry panel",
)

css_path = "src/app/rooms/rooms-live.css"
replace_once(
    css_path,
    '''.rooms-live-models {
  margin-top: 24px;
}

.rooms-live-directory-heading h2,''',
    '''.rooms-live-models {
  margin-top: 24px;
}

.rooms-live-invite-entry {
  margin-bottom: 24px;
}

.rooms-live-invite-entry .rooms-live-toolbar {
  margin-bottom: 0;
}

.rooms-live-directory-heading h2,''',
    "Room invitation panel spacing",
)

print("Room invitation copy and paste patch applied.")
