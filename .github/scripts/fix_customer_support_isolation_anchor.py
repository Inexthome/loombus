from pathlib import Path

path = Path(".github/scripts/apply_customer_support_isolation.py")
source = path.read_text()
replacements = [
    (
        "    '           discussionMetadata: asMetadata(row.discussion_metadata),\\n           status: asString(row.status) === \"resolved\" ? \"resolved\" : \"open\",\\n',",
        "    '          discussionMetadata: asMetadata(row.discussion_metadata),\\n          status: asString(row.status) === \"resolved\" ? \"resolved\" : \"open\",\\n',",
        "thread visibility response",
    ),
    (
        "    '           discussion_type: modeResult.mode,\\n         },\\n',",
        "    '          discussion_type: modeResult.mode,\\n        },\\n',",
        "discussion visibility audit",
    ),
    (
        "    '               ? \"Start a focused thread that stays inside this Room.\"\\n',",
        "    '              ? \"Start a focused thread that stays inside this Room.\"\\n',",
        "support empty-state copy",
    ),
    (
        "async function loadAccessiblePost(\\n  service: ServiceClient,\\n  access: RoomAccess,\\n  roomId: string,\\n  postId: string,\\n  userId: string\\n) {\\n  const post = await loadPost(service, roomId, postId);\\n",
        "async function loadAccessiblePost(\\n  service: ServiceClient,\\n  access: RoomAccess,\\n  roomId: string,\\n  postId: string,\\n  userId: string\\n): Promise<RoomRow | null> {\\n  const post =\\n    await loadPost(service, roomId, postId);\\n",
        "accessible post helper return contract",
    ),
]

for old, new, label in replacements:
    if old not in source:
        raise RuntimeError(f"The {label} anchor no longer matches the audited patcher.")
    source = source.replace(old, new, 1)

path.write_text(source)
