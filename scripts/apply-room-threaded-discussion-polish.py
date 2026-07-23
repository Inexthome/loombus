from pathlib import Path


def replace_once(path: Path, old: str, new: str) -> None:
    source = path.read_text()
    count = source.count(old)
    if count != 1:
        raise SystemExit(
            f"Expected one match in {path}, found {count}: {old[:120]!r}"
        )
    path.write_text(source.replace(old, new, 1))


replace_once(
    Path("supabase/migrations/20260725012000_activate_room_threaded_discussions.sql"),
    """update public.room_posts
set last_activity_at = coalesce(updated_at, created_at, now())
where last_activity_at is null
   or last_activity_at < created_at;""",
    """update public.room_posts
set last_activity_at = coalesce(updated_at, created_at, now());""",
)

replace_once(
    Path("src/app/api/rooms/[roomId]/discussions/route.ts"),
    """  return (settings as Record<string, unknown>).allowMemberPosts !== false;
}""",
    """  const allowMemberPosts = (settings as Record<string, unknown>)
    .allowMemberPosts;
  return allowMemberPosts !== false && allowMemberPosts !== \"false\";
}""",
)

replace_once(
    Path("src/components/room-discussions-workspace.tsx"),
    """  const [loading, setLoading] = useState(false);""",
    """  const [loading, setLoading] = useState(true);""",
)

public_api = Path("src/app/api/discussions/create/route.ts")
replace_once(
    public_api,
    """import { normalizeDiscussionTags } from \"@/lib/discussion-tags\";
import { logAuditEvent } from \"@/lib/audit-log\";""",
    """import { normalizeDiscussionTags } from \"@/lib/discussion-tags\";
import { parseDiscussionModeInput } from \"@/lib/discussion-modes\";
import { logAuditEvent } from \"@/lib/audit-log\";""",
)

replace_once(
    public_api,
    """    const requestedDiscussionType = String(body.discussionType ?? body.discussion_type ?? \"open_discussion\").trim();
    const allowedDiscussionTypes = new Set([
      \"open_discussion\",
      \"debate\",
      \"research_question\",
      \"problem_solving\",
    ]);

    if (!allowedDiscussionTypes.has(requestedDiscussionType)) {
      return NextResponse.json(
        { error: \"Choose a valid discussion type.\" },
        { status: 400 }
      );
    }

    const rawDiscussionMetadata =
      body.discussionMetadata && typeof body.discussionMetadata === \"object\" && !Array.isArray(body.discussionMetadata)
        ? body.discussionMetadata
        : {};

    const discussion_metadata = Object.fromEntries(
      Object.entries(rawDiscussionMetadata)
        .map(([key, value]) => [key, String(value ?? \"\").trim()])
        .filter(([, value]) => value.length > 0)
    );""",
    """    const discussionModeResult = parseDiscussionModeInput({
      discussionType: body.discussionType ?? body.discussion_type,
      discussionMetadata:
        body.discussionMetadata ?? body.discussion_metadata,
    });

    if (!discussionModeResult.ok) {
      return NextResponse.json(
        {
          error: discussionModeResult.error,
          code: discussionModeResult.code,
        },
        { status: 400 }
      );
    }

    const requestedDiscussionType = discussionModeResult.mode;
    const discussion_metadata = discussionModeResult.metadata;""",
)

print("Applied Room threaded discussion integration polish.")
