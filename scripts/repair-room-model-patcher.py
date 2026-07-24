from pathlib import Path

path = Path("scripts/apply-room-model-specific-workflows.py")
text = path.read_text()

settings_old = '''replace_once(
    "src/app/api/rooms/[roomId]/modules/route.ts",
    ''' + "'''" + '''        settings: await getSettings(serviceSupabase, roomId, access.room.roomType),\\n      };''' + "'''" + ''',
    ''' + "'''" + '''        settings: await getSettings(serviceSupabase, roomId, access.room.roomType),\\n        modelProfile: getRoomModelProfile(access.room.roomType),\\n      };''' + "'''" + ''',
)
'''
settings_new = '''replace_once(
    "src/app/api/rooms/[roomId]/modules/route.ts",
    ''' + "'''" + '''      data = {\\n        room: {\\n          ...access.room,\\n          requiredBehaviors: getRoomRequiredBehaviors(access.room.roomType),\\n        },\\n        settings: await getSettings(serviceSupabase, roomId, access.room.roomType),\\n      };''' + "'''" + ''',
    ''' + "'''" + '''      data = {\\n        room: {\\n          ...access.room,\\n          requiredBehaviors: getRoomRequiredBehaviors(access.room.roomType),\\n        },\\n        settings: await getSettings(serviceSupabase, roomId, access.room.roomType),\\n        modelProfile: getRoomModelProfile(access.room.roomType),\\n      };''' + "'''" + ''',
)
'''
if text.count(settings_old) != 1:
    raise SystemExit(
        f"Expected one settings patch anchor, found {text.count(settings_old)}"
    )
text = text.replace(settings_old, settings_new, 1)

noop = '''replace_once(
    "src/components/room-tier-modules-workspace.tsx",
    ''' + "'''" + '''        <SettingsPanel\\n          moduleKey={moduleKey}\\n          data={data}''' + "'''" + ''',
    ''' + "'''" + '''        <SettingsPanel\\n          moduleKey={moduleKey}\\n          data={data}''' + "'''" + ''',
)
'''
if text.count(noop) != 1:
    raise SystemExit(f"Expected one no-op Settings patch, found {text.count(noop)}")
text = text.replace(noop, "", 1)

path.write_text(text)
