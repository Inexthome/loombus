from pathlib import Path

path = Path(".github/scripts/apply_customer_support_isolation.py")
source = path.read_text()
old = "    '           discussionMetadata: asMetadata(row.discussion_metadata),\\n           status: asString(row.status) === \"resolved\" ? \"resolved\" : \"open\",\\n',"
new = "    '          discussionMetadata: asMetadata(row.discussion_metadata),\\n          status: asString(row.status) === \"resolved\" ? \"resolved\" : \"open\",\\n',"
if old not in source:
    raise RuntimeError("The isolation visibility anchor no longer matches the audited patcher.")
path.write_text(source.replace(old, new, 1))
