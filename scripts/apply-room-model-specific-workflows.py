from pathlib import Path
import re


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text()
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one source anchor, found {count}: {old[:120]!r}")
    file_path.write_text(text.replace(old, new, 1))


def regex_replace_once(path: str, pattern: str, replacement: str) -> None:
    file_path = Path(path)
    text = file_path.read_text()
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"{path}: expected one regex source anchor, found {count}: {pattern[:120]!r}")
    file_path.write_text(updated)


# Required Customer Support behavior.
replace_once(
    "src/lib/room-required-behaviors.ts",
    'export type RoomRequiredBehavior = "private_support_threads";',
    'export type RoomRequiredBehavior =\n  | "private_support_threads"\n  | "staff_only_operational_requests";',
)
replace_once(
    "src/lib/room-required-behaviors.ts",
    '''  return isCustomerSupportRoomType(roomType)\n    ? (["private_support_threads"] as const)\n    : [];''',
    '''  return isCustomerSupportRoomType(roomType)\n    ? ([\n        "private_support_threads",\n        "staff_only_operational_requests",\n      ] as const)\n    : [];''',
)

# Builder model catalog now reads from the shared model profile contract.
replace_once(
    "src/app/rooms/rooms-v2-model.ts",
    '''import type { RoomRequiredBehavior } from "@/lib/room-required-behaviors";''',
    '''import { getRoomModelProfile } from "@/lib/room-model-profiles";\nimport type { RoomRequiredBehavior } from "@/lib/room-required-behaviors";''',
)
replace_once(
    "src/app/rooms/rooms-v2-model.ts",
    '''  calendarUse: string;\n  requiredBehaviors: readonly RoomRequiredBehavior[];''',
    '''  calendarUse: string;\n  defaultAccessSummary: string;\n  workflowSummary: string;\n  workflowHighlights: readonly string[];\n  requiredBehaviors: readonly RoomRequiredBehavior[];''',
)
regex_replace_once(
    "src/app/rooms/rooms-v2-model.ts",
    r'''export const ROOM_MODELS: RoomModel\[\] = \[.*?\n\];\n\nexport const ROOM_PLANS''',
    '''const BUSINESS_MODEL = getRoomModelProfile("business");\nconst RESIDENTS_MODEL = getRoomModelProfile("residents");\nconst CLASSROOM_MODEL = getRoomModelProfile("classroom");\nconst CUSTOMER_SUPPORT_MODEL = getRoomModelProfile("customer_support");\nconst COMMUNITY_MODEL = getRoomModelProfile("community");\n\nexport const ROOM_MODELS: RoomModel[] = [\n  {\n    id: BUSINESS_MODEL.templateId,\n    category: BUSINESS_MODEL.category,\n    title: BUSINESS_MODEL.title,\n    shortTitle: BUSINESS_MODEL.shortTitle,\n    description: BUSINESS_MODEL.description,\n    audience: BUSINESS_MODEL.audience,\n    examples: [...BUSINESS_MODEL.workflowHighlights],\n    calendarUse: BUSINESS_MODEL.calendarUse,\n    defaultAccessSummary: BUSINESS_MODEL.defaultAccessSummary,\n    workflowSummary: BUSINESS_MODEL.workflowSummary,\n    workflowHighlights: BUSINESS_MODEL.workflowHighlights,\n    requiredBehaviors: BUSINESS_MODEL.requiredBehaviors,\n  },\n  {\n    id: RESIDENTS_MODEL.templateId,\n    category: RESIDENTS_MODEL.category,\n    title: RESIDENTS_MODEL.title,\n    shortTitle: RESIDENTS_MODEL.shortTitle,\n    description: RESIDENTS_MODEL.description,\n    audience: RESIDENTS_MODEL.audience,\n    examples: [...RESIDENTS_MODEL.workflowHighlights],\n    calendarUse: RESIDENTS_MODEL.calendarUse,\n    defaultAccessSummary: RESIDENTS_MODEL.defaultAccessSummary,\n    workflowSummary: RESIDENTS_MODEL.workflowSummary,\n    workflowHighlights: RESIDENTS_MODEL.workflowHighlights,\n    requiredBehaviors: RESIDENTS_MODEL.requiredBehaviors,\n  },\n  {\n    id: CLASSROOM_MODEL.templateId,\n    category: CLASSROOM_MODEL.category,\n    title: CLASSROOM_MODEL.title,\n    shortTitle: CLASSROOM_MODEL.shortTitle,\n    description: CLASSROOM_MODEL.description,\n    audience: CLASSROOM_MODEL.audience,\n    examples: [...CLASSROOM_MODEL.workflowHighlights],\n    calendarUse: CLASSROOM_MODEL.calendarUse,\n    defaultAccessSummary: CLASSROOM_MODEL.defaultAccessSummary,\n    workflowSummary: CLASSROOM_MODEL.workflowSummary,\n    workflowHighlights: CLASSROOM_MODEL.workflowHighlights,\n    requiredBehaviors: CLASSROOM_MODEL.requiredBehaviors,\n  },\n  {\n    id: CUSTOMER_SUPPORT_MODEL.templateId,\n    category: CUSTOMER_SUPPORT_MODEL.category,\n    title: CUSTOMER_SUPPORT_MODEL.title,\n    shortTitle: CUSTOMER_SUPPORT_MODEL.shortTitle,\n    description: CUSTOMER_SUPPORT_MODEL.description,\n    audience: CUSTOMER_SUPPORT_MODEL.audience,\n    examples: [...CUSTOMER_SUPPORT_MODEL.workflowHighlights],\n    calendarUse: CUSTOMER_SUPPORT_MODEL.calendarUse,\n    defaultAccessSummary: CUSTOMER_SUPPORT_MODEL.defaultAccessSummary,\n    workflowSummary: CUSTOMER_SUPPORT_MODEL.workflowSummary,\n    workflowHighlights: CUSTOMER_SUPPORT_MODEL.workflowHighlights,\n    requiredBehaviors: CUSTOMER_SUPPORT_MODEL.requiredBehaviors,\n  },\n  {\n    id: COMMUNITY_MODEL.templateId,\n    category: COMMUNITY_MODEL.category,\n    title: COMMUNITY_MODEL.title,\n    shortTitle: COMMUNITY_MODEL.shortTitle,\n    description: COMMUNITY_MODEL.description,\n    audience: COMMUNITY_MODEL.audience,\n    examples: [...COMMUNITY_MODEL.workflowHighlights],\n    calendarUse: COMMUNITY_MODEL.calendarUse,\n    defaultAccessSummary: COMMUNITY_MODEL.defaultAccessSummary,\n    workflowSummary: COMMUNITY_MODEL.workflowSummary,\n    workflowHighlights: COMMUNITY_MODEL.workflowHighlights,\n    requiredBehaviors: COMMUNITY_MODEL.requiredBehaviors,\n  },\n];\n\nexport const ROOM_PLANS''',
)
replace_once(
    "src/app/rooms/rooms-v2-model.ts",
    '''    `Purpose: ${input.description.trim()}`,\n    "Included features:",''',
    '''    `Purpose: ${input.description.trim()}`,\n    `Default access: ${input.model.defaultAccessSummary}`,\n    `Model workflow: ${input.model.workflowSummary}`,\n    "Included features:",''',
)

# Builder cards show model defaults and workflow identity.
replace_once(
    "src/app/rooms/rooms-v2-components.tsx",
    '''        <div>\n          <dt>Calendar</dt>\n          <dd>{model.calendarUse}</dd>\n        </div>\n      </dl>''',
    '''        <div>\n          <dt>Calendar</dt>\n          <dd>{model.calendarUse}</dd>\n        </div>\n        <div>\n          <dt>Default access</dt>\n          <dd>{model.defaultAccessSummary}</dd>\n        </div>\n        <div>\n          <dt>Workflow</dt>\n          <dd>{model.workflowSummary}</dd>\n        </div>\n      </dl>''',
)

# Model-aware server authorization, defaults, labels, categories, and manifest.
replace_once(
    "src/app/api/rooms/[roomId]/modules/route.ts",
    '''import { createNotifications } from "@/lib/notifications";\nimport {''',
    '''import { createNotifications } from "@/lib/notifications";\nimport {\n  getRoomModelDefaultSettings,\n  getRoomModelModuleDefinition,\n  getRoomModelProfile,\n  normalizeRoomRequestCategory,\n} from "@/lib/room-model-profiles";\nimport {''',
)
replace_once(
    "src/app/api/rooms/[roomId]/modules/route.ts",
    '''const DEFAULT_SETTINGS: RoomModuleSettings = {\n  allowMemberPosts: true,\n  memberDirectoryVisible: true,\n  inviteRequiresApproval: false,\n  allowedEmailDomains: [],\n  defaultInviteRole: "member",\n};\n\n''',
    '''''',
)
replace_once(
    "src/app/api/rooms/[roomId]/modules/route.ts",
    '''  const source = asObject(value);\n  const domains = Array.isArray(source.allowedEmailDomains)''',
    '''  const source = asObject(value);\n  const defaults = getRoomModelDefaultSettings(roomType);\n  const domains = Array.isArray(source.allowedEmailDomains)''',
)
replace_once(
    "src/app/api/rooms/[roomId]/modules/route.ts",
    ''': DEFAULT_SETTINGS.allowMemberPosts,''',
    ''': defaults.allowMemberPosts,''',
)
replace_once(
    "src/app/api/rooms/[roomId]/modules/route.ts",
    ''': DEFAULT_SETTINGS.memberDirectoryVisible,''',
    ''': defaults.memberDirectoryVisible,''',
)
replace_once(
    "src/app/api/rooms/[roomId]/modules/route.ts",
    ''': DEFAULT_SETTINGS.inviteRequiresApproval,''',
    ''': defaults.inviteRequiresApproval,''',
)
replace_once(
    "src/app/api/rooms/[roomId]/modules/route.ts",
    '''    defaultInviteRole:\n      source.defaultInviteRole === "moderator" ? "moderator" : "member",''',
    '''    defaultInviteRole:\n      source.defaultInviteRole === "moderator"\n        ? "moderator"\n        : source.defaultInviteRole === "member"\n          ? "member"\n          : defaults.defaultInviteRole,''',
)
replace_once(
    "src/app/api/rooms/[roomId]/modules/route.ts",
    '''function roleCanOpenModule(access: RoomAccess, moduleKey: RoomModuleKey) {\n  const required = ROOM_MODULE_DEFINITIONS[moduleKey].minimumRole;\n  if (required === "member") return access.allowed;\n  if (required === "manager") return access.canManage;\n  return access.isOwner;\n}\n\nfunction modulesFor(access: RoomAccess) {\n  const plan = getRoomPlanEntitlements(\n    access.room.subscriptionPlan,\n    access.room.subscriptionStatus\n  );\n  return plan.modules\n    .filter((moduleKey) => roleCanOpenModule(access, moduleKey))\n    .map((moduleKey) => ROOM_MODULE_DEFINITIONS[moduleKey]);\n}\n''',
    '''function moduleDefinitionFor(access: RoomAccess, moduleKey: RoomModuleKey) {\n  return getRoomModelModuleDefinition(\n    access.room.roomType,\n    moduleKey,\n    ROOM_MODULE_DEFINITIONS[moduleKey]\n  );\n}\n\nfunction roleCanOpenModule(access: RoomAccess, moduleKey: RoomModuleKey) {\n  const required = moduleDefinitionFor(access, moduleKey).minimumRole;\n  if (required === "member") return access.allowed;\n  if (required === "manager") return access.canManage;\n  return access.isOwner;\n}\n\nfunction modulesFor(access: RoomAccess) {\n  const plan = getRoomPlanEntitlements(\n    access.room.subscriptionPlan,\n    access.room.subscriptionStatus\n  );\n  return plan.modules\n    .filter((moduleKey) => roleCanOpenModule(access, moduleKey))\n    .map((moduleKey) => moduleDefinitionFor(access, moduleKey));\n}\n''',
)
replace_once(
    "src/app/api/rooms/[roomId]/modules/route.ts",
    '''function buildMetadata(moduleKey: RoomModuleKey, raw: unknown) {''',
    '''function buildMetadata(\n  moduleKey: RoomModuleKey,\n  raw: unknown,\n  roomType?: unknown\n) {''',
)
replace_once(
    "src/app/api/rooms/[roomId]/modules/route.ts",
    '''  if (moduleKey === "requests") {\n    const priority = asString(source.priority);\n    return {\n      category: cleanText(source.category, 100) || "General",\n      priority: ["low", "normal", "high", "urgent"].includes(priority)\n        ? priority\n        : "normal",\n      dueAt: safeIsoDate(source.dueAt),\n      assigneeId: validUuid(source.assigneeId) ? source.assigneeId : null,\n    };\n  }''',
    '''  if (moduleKey === "requests") {\n    const priority = asString(source.priority);\n    const category = normalizeRoomRequestCategory(\n      roomType,\n      cleanText(source.category, 100)\n    );\n    if (!category) {\n      throw new Error("Choose a valid request category for this Room model.");\n    }\n    return {\n      category,\n      priority: ["low", "normal", "high", "urgent"].includes(priority)\n        ? priority\n        : "normal",\n      dueAt: safeIsoDate(source.dueAt),\n      assigneeId: validUuid(source.assigneeId) ? source.assigneeId : null,\n    };\n  }''',
)
replace_once(
    "src/app/api/rooms/[roomId]/modules/route.ts",
    '''        modules: modulesFor(access),''',
    '''        modelProfile: getRoomModelProfile(access.room.roomType),\n        modules: modulesFor(access),''',
)
replace_once(
    "src/app/api/rooms/[roomId]/modules/route.ts",
    '''        settings: await getSettings(serviceSupabase, roomId, access.room.roomType),\n      };''',
    '''        settings: await getSettings(serviceSupabase, roomId, access.room.roomType),\n        modelProfile: getRoomModelProfile(access.room.roomType),\n      };''',
)
replace_once(
    "src/app/api/rooms/[roomId]/modules/route.ts",
    '''      const metadata = buildMetadata(moduleKey, body?.metadata);''',
    '''      const metadata = buildMetadata(\n        moduleKey,\n        body?.metadata,\n        access.room.roomType\n      );''',
)
replace_once(
    "src/app/api/rooms/[roomId]/modules/route.ts",
    '''          updates.metadata = buildMetadata(moduleKey, body.metadata);''',
    '''          updates.metadata = buildMetadata(\n            moduleKey,\n            body.metadata,\n            access.room.roomType\n          );''',
)
replace_once(
    "src/app/api/rooms/[roomId]/modules/route.ts",
    '''      message: `New request in ${access.room.name}: ${record.title}`,''',
    '''      message: `New ${getRoomModelProfile(access.room.roomType).request.singularLabel} in ${access.room.name}: ${record.title}`,''',
)
replace_once(
    "src/app/api/rooms/[roomId]/modules/route.ts",
    '''      message: `Request updated in ${access.room.name}: ${record.title} (${record.status.replaceAll("_", " ")})`,''',
    '''      message: `${getRoomModelProfile(access.room.roomType).request.singularLabel} updated in ${access.room.name}: ${record.title} (${record.status.replaceAll("_", " ")})`,''',
)

# Client profile types and model-aware workflow copy.
replace_once(
    "src/components/room-tier-modules-workspace.tsx",
    '''  dataModule?: string;\n};''',
    '''  dataModule?: string;\n  recommended?: boolean;\n};''',
)
replace_once(
    "src/components/room-tier-modules-workspace.tsx",
    '''type ManifestResponse = {''',
    '''type RoomModelProfileView = {\n  key: string;\n  title: string;\n  description: string;\n  defaultAccessSummary: string;\n  workflowSummary: string;\n  workflowHighlights: string[];\n  recommendedModules: RoomModuleKey[];\n  requiredBehaviors: string[];\n  request: {\n    label: string;\n    singularLabel: string;\n    description: string;\n    submitHeading: string;\n    detailsLabel: string;\n    categories: string[];\n    defaultCategory: string;\n  };\n};\n\ntype ManifestResponse = {''',
)
replace_once(
    "src/components/room-tier-modules-workspace.tsx",
    '''  modules?: ModuleDefinition[];\n  error?: string;''',
    '''  modules?: ModuleDefinition[];\n  modelProfile?: RoomModelProfileView;\n  error?: string;''',
)
replace_once(
    "src/components/room-tier-modules-workspace.tsx",
    '''        <SettingsPanel\n          moduleKey={moduleKey}\n          data={data}''',
    '''        <SettingsPanel\n          moduleKey={moduleKey}\n          data={data}''',
)
replace_once(
    "src/components/room-tier-modules-workspace.tsx",
    '''      currentUserId={manifest?.access?.currentUserId ?? ""}\n      canManage={Boolean(manifest?.access?.canManage)}\n      action={action}''',
    '''      currentUserId={manifest?.access?.currentUserId ?? ""}\n      canManage={Boolean(manifest?.access?.canManage)}\n      modelProfile={manifest?.modelProfile}\n      action={action}''',
)
replace_once(
    "src/components/room-tier-modules-workspace.tsx",
    '''  canManage,\n  action,\n}: {\n  moduleKey: RoomModuleKey;\n  records: ModuleRecord[];\n  members: RoomMember[];\n  currentUserId: string;\n  canManage: boolean;''',
    '''  canManage,\n  modelProfile,\n  action,\n}: {\n  moduleKey: RoomModuleKey;\n  records: ModuleRecord[];\n  members: RoomMember[];\n  currentUserId: string;\n  canManage: boolean;\n  modelProfile?: RoomModelProfileView;''',
)
replace_once(
    "src/components/room-tier-modules-workspace.tsx",
    '''          members={members}\n          canManage={canManage}\n          onCreate={(payload) =>''',
    '''          members={members}\n          canManage={canManage}\n          modelProfile={modelProfile}\n          onCreate={(payload) =>''',
)
replace_once(
    "src/components/room-tier-modules-workspace.tsx",
    '''              ? "No operational requests"''',
    '''              ? `No ${modelProfile?.request.label.toLowerCase() ?? "operational requests"}`''',
)
replace_once(
    "src/components/room-tier-modules-workspace.tsx",
    '''              ? "Room members can submit the first request."''',
    '''              ? `Room members can submit the first ${modelProfile?.request.singularLabel ?? "request"}.`''',
)
replace_once(
    "src/components/room-tier-modules-workspace.tsx",
    '''  canManage,\n  onCreate,\n}: {\n  moduleKey: RoomModuleKey;\n  members: RoomMember[];\n  canManage: boolean;\n  onCreate: (payload: Record<string, unknown>) => Promise<boolean>;''',
    '''  canManage,\n  modelProfile,\n  onCreate,\n}: {\n  moduleKey: RoomModuleKey;\n  members: RoomMember[];\n  canManage: boolean;\n  modelProfile?: RoomModelProfileView;\n  onCreate: (payload: Record<string, unknown>) => Promise<boolean>;''',
)
replace_once(
    "src/components/room-tier-modules-workspace.tsx",
    '''    setFieldA("");\n    setFieldB("");''',
    '''    setFieldA(\n      moduleKey === "requests"\n        ? modelProfile?.request.defaultCategory ?? "General"\n        : ""\n    );\n    setFieldB("");''',
)
replace_once(
    "src/components/room-tier-modules-workspace.tsx",
    '''  }, [moduleKey]);''',
    '''  }, [moduleKey, modelProfile?.key, modelProfile?.request.defaultCategory]);''',
)
replace_once(
    "src/components/room-tier-modules-workspace.tsx",
    '''      ? "Request title"''',
    '''      ? `${modelProfile?.request.singularLabel ?? "Request"} title`''',
)
replace_once(
    "src/components/room-tier-modules-workspace.tsx",
    '''              ? "Submit an operational request"''',
    '''              ? modelProfile?.request.submitHeading ?? "Submit an operational request"''',
)
replace_once(
    "src/components/room-tier-modules-workspace.tsx",
    '''              ? "Track a Room need from submission through completion."''',
    '''              ? modelProfile?.request.description ??\n                "Track a Room need from submission through completion."''',
)
replace_once(
    "src/components/room-tier-modules-workspace.tsx",
    '''            ? "Request details"''',
    '''            ? modelProfile?.request.detailsLabel ?? "Request details"''',
)
replace_once(
    "src/components/room-tier-modules-workspace.tsx",
    '''            <input\n              value={fieldA}\n              onChange={(event) => setFieldA(event.target.value)}\n              placeholder="Maintenance, service, approval, support"\n            />''',
    '''            <select\n              value={fieldA}\n              onChange={(event) => setFieldA(event.target.value)}\n            >\n              {(modelProfile?.request.categories ?? ["General", "Other"]).map(\n                (category) => (\n                  <option key={category} value={category}>\n                    {category}\n                  </option>\n                )\n              )}\n            </select>''',
)
replace_once(
    "src/components/room-tier-modules-workspace.tsx",
    '''    settings?: RoomSettingsData;\n  };''',
    '''    settings?: RoomSettingsData;\n    modelProfile?: RoomModelProfileView;\n  };''',
)
replace_once(
    "src/components/room-tier-modules-workspace.tsx",
    '''  const privateSupportThreads = Boolean(\n    source.room?.requiredBehaviors?.includes("private_support_threads") ||\n      source.room?.roomType === "customer_support"\n  );''',
    '''  const privateSupportThreads = Boolean(\n    source.room?.requiredBehaviors?.includes("private_support_threads") ||\n      source.room?.roomType === "customer_support"\n  );\n  const staffOnlyOperationalRequests = Boolean(\n    source.room?.requiredBehaviors?.includes(\n      "staff_only_operational_requests"\n    ) || source.modelProfile?.requiredBehaviors?.includes(\n      "staff_only_operational_requests"\n    )\n  );''',
)
replace_once(
    "src/components/room-tier-modules-workspace.tsx",
    '''    <form className="room-tier-create-card" onSubmit={submit}>\n      {core ? (''',
    '''    <form className="room-tier-create-card" onSubmit={submit}>\n      {source.modelProfile ? (\n        <section className="room-tier-create-heading">\n          <ShieldCheck aria-hidden="true" />\n          <div>\n            <p className="rooms-live-eyebrow">{source.modelProfile.title}</p>\n            <h3>{source.modelProfile.workflowSummary}</h3>\n            <p>{source.modelProfile.defaultAccessSummary}</p>\n            <div className="room-tier-record-details">\n              {source.modelProfile.workflowHighlights.map((item) => (\n                <span key={item} className="room-tier-record-chip">\n                  {item}\n                </span>\n              ))}\n            </div>\n            {staffOnlyOperationalRequests ? (\n              <p className="rooms-live-notice">\n                Customer Support operations are staff-only and cannot be exposed to ordinary customers.\n              </p>\n            ) : null}\n          </div>\n        </section>\n      ) : null}\n      {core ? (''',
)

# Architecture contract.
path = Path("docs/rooms-entitlement-repair-order.md")
text = path.read_text()
section = '''\n\n## Room model workflow contract\n\nRoom models share the same private infrastructure, but they do not present one generic workspace.\n\n- Business Team Rooms use decision, work-request, task, milestone, resource, and team-update language.\n- Resident / HOA Rooms use maintenance, safety, governance, notice, meeting, document, and resident-decision workflows.\n- Classroom Rooms use assignment, attendance, accommodation, course-resource, schedule, submission, and class-announcement workflows.\n- Private Community Rooms use event, volunteer, membership, resource, partnership, poll, and member-update workflows.\n- Customer Support Rooms keep private support cases and restrict the paid operational Requests module to Room staff.\n\nModel defaults are recommendations applied when a setting has not been saved yet. Owners may change optional settings. Required behaviors remain server-enforced and cannot be disabled. Request categories, module labels, module descriptions, notifications, and builder summaries must resolve from the same shared model profile contract.\n'''
if "## Room model workflow contract" not in text:
    path.write_text(text.rstrip() + section + "\n")
else:
    raise RuntimeError("Room model workflow contract already exists")
