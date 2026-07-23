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
]

for old, new, label in replacements:
    if old not in source:
        raise RuntimeError(f"The {label} anchor no longer matches the audited patcher.")
    source = source.replace(old, new, 1)

path.write_text(source)
