from pathlib import Path

path = Path("src/components/room-tier-modules-workspace.tsx")
source = path.read_text()
block = '''  const [working, setWorking] = useState(false);
  const privateSupportThreads = Boolean(
    source.room?.requiredBehaviors?.includes("private_support_threads") ||
      source.room?.roomType === "customer_support"
  );
'''
plain = '''  const [working, setWorking] = useState(false);
'''

if source.count(block) != 1:
    raise RuntimeError("Expected exactly one misplaced support behavior block.")
source = source.replace(block, plain, 1)

anchor = '''  const [defaultRole, setDefaultRole] = useState<"member" | "moderator">(source.settings?.defaultInviteRole ?? "member");
  const [working, setWorking] = useState(false);

  useEffect(() => {
'''
replacement = '''  const [defaultRole, setDefaultRole] = useState<"member" | "moderator">(source.settings?.defaultInviteRole ?? "member");
  const [working, setWorking] = useState(false);
  const privateSupportThreads = Boolean(
    source.room?.requiredBehaviors?.includes("private_support_threads") ||
      source.room?.roomType === "customer_support"
  );

  useEffect(() => {
'''
if anchor not in source:
    raise RuntimeError("The SettingsPanel state anchor no longer matches.")
source = source.replace(anchor, replacement, 1)

if source.count("const privateSupportThreads = Boolean(") != 1:
    raise RuntimeError("Support behavior state must exist only in SettingsPanel.")

path.write_text(source)
