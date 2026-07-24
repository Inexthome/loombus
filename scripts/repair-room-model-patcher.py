from pathlib import Path

path = Path("scripts/apply-room-model-specific-workflows.py")
text = path.read_text()
old = '''replace_once(
    "src/app/api/rooms/[roomId]/modules/route.ts",
    ''' + "'''" + '''        settings: await getSettings(serviceSupabase, roomId, access.room.roomType),\\n      };''' + "'''" + ''',
    ''' + "'''" + '''        settings: await getSettings(serviceSupabase, roomId, access.room.roomType),\\n        modelProfile: getRoomModelProfile(access.room.roomType),\\n      };''' + "'''" + ''',
)
'''
new = '''replace_once(
    "src/app/api/rooms/[roomId]/modules/route.ts",
    ''' + "'''" + '''      data = {\\n        room: {\\n          ...access.room,\\n          requiredBehaviors: getRoomRequiredBehaviors(access.room.roomType),\\n        },\\n        settings: await getSettings(serviceSupabase, roomId, access.room.roomType),\\n      };''' + "'''" + ''',
    ''' + "'''" + '''      data = {\\n        room: {\\n          ...access.room,\\n          requiredBehaviors: getRoomRequiredBehaviors(access.room.roomType),\\n        },\\n        settings: await getSettings(serviceSupabase, roomId, access.room.roomType),\\n        modelProfile: getRoomModelProfile(access.room.roomType),\\n      };''' + "'''" + ''',
)
'''
if text.count(old) != 1:
    raise SystemExit(f"Expected one settings patch anchor, found {text.count(old)}")
path.write_text(text.replace(old, new, 1))
