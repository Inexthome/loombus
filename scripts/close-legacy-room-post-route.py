from pathlib import Path

path = Path("src/app/api/rooms/[roomId]/route.ts")
source = path.read_text()
old = '''  if (action === "create_post") {
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const postBody = typeof body?.body === "string" ? body.body.trim() : "";

    if (title.length > 160) return jsonError("Post title is too long.", 400);
    if (postBody.length < 1 || postBody.length > 5000) {
      return jsonError("Post body must be between 1 and 5,000 characters.", 400);
    }

    const insertResult = await serviceSupabase
      .from("room_posts")
      .insert({
        room_id: roomId,
        author_id: userId,
        title: title || null,
        body: postBody,
      })
      .select("id")
      .single();

    if (insertResult.error) {
      return jsonError(
        insertResult.error.message || "Unable to publish the room post.",
        400
      );
    }

    await serviceSupabase
      .from("rooms")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", roomId);

    return NextResponse.json(
      { ok: true, id: asString((insertResult.data as RoomRow).id) },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }
'''
new = '''  if (action === "create_post") {
    return jsonError(
      "Refresh this Room before creating a discussion.",
      409,
      "room_threaded_discussions_required"
    );
  }
'''
count = source.count(old)
if count != 1:
    raise SystemExit(f"Expected one legacy create_post block, found {count}")
path.write_text(source.replace(old, new, 1))
print("Closed the legacy Room post creation path.")
