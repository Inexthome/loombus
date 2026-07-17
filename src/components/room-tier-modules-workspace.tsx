"use client";

import { createPortal } from "react-dom";
import {
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  ContactRound,
  Copy,
  ExternalLink,
  FileText,
  FolderLock,
  LayoutDashboard,
  Link2,
  ListTodo,
  Loader2,
  LockKeyhole,
  Megaphone,
  MessageSquareText,
  Network,
  Plus,
  RefreshCw,
  ScrollText,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  Vote,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { useParams } from "next/navigation";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase/client";
import type { RoomModuleKey } from "@/lib/room-plan-entitlements";

type ModuleDefinition = {
  id: RoomModuleKey;
  label: string;
  description: string;
  minimumRole: "member" | "manager" | "owner";
  dataModule?: string;
};

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type RoomMember = {
  id: string;
  userId: string;
  role: string;
  status: string;
  joinedAt: string | null;
  profile: Profile | null;
};

type ManifestResponse = {
  room?: {
    id: string;
    name: string;
    description: string;
    inviteOnly: boolean;
    subscriptionPlan: string;
    subscriptionStatus: string;
    memberLimit: number | null;
  };
  access?: {
    role: string | null;
    canManage: boolean;
    canModerate: boolean;
    isOwner: boolean;
    currentUserId: string;
  };
  plan?: {
    id: string;
    label: string;
    roomLimit: number | null;
    memberLimit: number | null;
    features: string[];
  };
  modules?: ModuleDefinition[];
  error?: string;
};

type CoreWorkspaceResponse = {
  members?: RoomMember[];
};

type ModuleRecord = {
  id: string;
  roomId: string;
  moduleKey: string;
  title: string;
  body: string;
  status: string;
  metadata: Record<string, unknown>;
  createdBy: string;
  createdAt: string | null;
  updatedAt: string | null;
  responseSummary?: {
    totalResponses?: number;
    optionCounts?: Record<string, number>;
    ownResponse?: Record<string, unknown> | null;
    responses?: Array<{
      id: string;
      responderId?: string;
      payload: Record<string, unknown>;
      createdAt: string | null;
      updatedAt: string | null;
    }>;
  };
};

type RequestItem = {
  id: string;
  applicantId: string;
  state: string;
  note: string | null;
  createdAt: string | null;
  applicant: Profile | null;
};

type RoomSettingsData = {
  allowMemberPosts: boolean;
  memberDirectoryVisible: boolean;
  inviteRequiresApproval: boolean;
  allowedEmailDomains: string[];
  defaultInviteRole: "member" | "moderator";
};

type ModuleResponse = {
  module?: RoomModuleKey;
  data?: unknown;
  error?: string;
};

type PortalHosts = {
  shell: HTMLElement;
  originalNav: HTMLElement;
  navHost: HTMLElement;
  moduleHost: HTMLElement;
};

const CORE_TAB_LABELS: Partial<Record<RoomModuleKey, string>> = {
  overview: "Overview",
  discussions: "Discussions",
  calendar: "Calendar",
  announcements: "Announcements",
  members: "Members",
};

const MODULE_ICONS: Record<RoomModuleKey, LucideIcon> = {
  overview: LayoutDashboard,
  discussions: MessageSquareText,
  calendar: CalendarDays,
  announcements: Megaphone,
  members: Users,
  requests: UserCheck,
  resources: Link2,
  settings: Settings,
  tasks: ListTodo,
  polls: Vote,
  directory: ContactRound,
  knowledge: BookOpen,
  files: FolderLock,
  forms: ClipboardList,
  services: Store,
  invites: UserPlus,
  activity: ScrollText,
  "advanced-controls": SlidersHorizontal,
  "admin-tools": ShieldCheck,
  operations: BarChart3,
  "member-workflows": Workflow,
  "enterprise-controls": Building2,
  "high-capacity": Network,
  "community-operations": LockKeyhole,
};

function displayName(profile: Profile | null | undefined, fallback = "Room member") {
  return profile?.full_name?.trim() || profile?.username?.trim() || fallback;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asBoolean(value: unknown) {
  return value === true;
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function findPortalHosts(): PortalHosts | null {
  const shell = document.querySelector<HTMLElement>(
    ".rooms-live-page .rooms-live-shell"
  );
  if (!shell) return null;
  const originalNav = shell.querySelector<HTMLElement>(
    ".room-workspace-tabs:not([data-loombus-tier-navigation='true'])"
  );
  if (!originalNav) return null;

  let navHost = shell.querySelector<HTMLElement>(
    "[data-loombus-tier-navigation-host='true']"
  );
  if (!navHost) {
    navHost = document.createElement("div");
    navHost.dataset.loombusTierNavigationHost = "true";
    originalNav.before(navHost);
  }

  let moduleHost = shell.querySelector<HTMLElement>(
    "[data-loombus-tier-module-host='true']"
  );
  if (!moduleHost) {
    moduleHost = document.createElement("div");
    moduleHost.dataset.loombusTierModuleHost = "true";
    originalNav.after(moduleHost);
  }

  originalNav.hidden = true;
  const staleBoundary = Array.from(
    shell.querySelectorAll<HTMLElement>(".room-workspace-boundary")
  ).find((element) =>
    element.textContent?.toLowerCase().includes("files and inline video are not connected")
  );
  if (staleBoundary) staleBoundary.hidden = true;

  return { shell, originalNav, navHost, moduleHost };
}

function clickOriginalTab(hosts: PortalHosts, moduleKey: RoomModuleKey) {
  const expected = CORE_TAB_LABELS[moduleKey];
  if (!expected) return false;
  const button = Array.from(
    hosts.originalNav.querySelectorAll<HTMLButtonElement>("button")
  ).find((candidate) => candidate.textContent?.trim().startsWith(expected));
  button?.click();
  return Boolean(button);
}

async function accessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export function RoomTierModulesWorkspace() {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(
    () => (Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId ?? ""),
    [rawRoomId]
  );
  const [hosts, setHosts] = useState<PortalHosts | null>(null);
  const [manifest, setManifest] = useState<ManifestResponse | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [selectedModule, setSelectedModule] =
    useState<RoomModuleKey>("overview");
  const [moduleData, setModuleData] = useState<unknown>(null);
  const [loadingManifest, setLoadingManifest] = useState(false);
  const [loadingModule, setLoadingModule] = useState(false);
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  const [highCapacityPage, setHighCapacityPage] = useState(1);
  const [highCapacitySearch, setHighCapacitySearch] = useState("");

  useEffect(() => {
    let scheduled = false;
    const scan = () => {
      scheduled = false;
      const nextHosts = findPortalHosts();
      if (nextHosts) setHosts(nextHosts);
    };
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(scan);
    };
    scan();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      const current = findPortalHosts();
      if (current) {
        current.originalNav.hidden = false;
        current.shell.classList.remove("is-room-tier-module-active");
        current.navHost.remove();
        current.moduleHost.remove();
      }
    };
  }, []);

  const loadManifest = useCallback(async () => {
    if (!roomId) return;
    setLoadingManifest(true);
    try {
      const token = await accessToken();
      if (!token) return;
      const headers = { Authorization: `Bearer ${token}` };
      const [manifestResponse, workspaceResponse] = await Promise.all([
        fetch(`/api/rooms/${encodeURIComponent(roomId)}/modules?module=manifest`, {
          headers,
          cache: "no-store",
        }),
        fetch(`/api/rooms/${encodeURIComponent(roomId)}`, {
          headers,
          cache: "no-store",
        }),
      ]);
      const nextManifest = (await manifestResponse
        .json()
        .catch(() => ({}))) as ManifestResponse;
      if (!manifestResponse.ok) {
        throw new Error(nextManifest.error ?? "Room modules could not be loaded.");
      }
      const workspace = (await workspaceResponse
        .json()
        .catch(() => ({}))) as CoreWorkspaceResponse;
      setManifest(nextManifest);
      setMembers(Array.isArray(workspace.members) ? workspace.members : []);
      const included = nextManifest.modules?.some(
        (moduleDefinition) => moduleDefinition.id === selectedModule
      );
      if (!included) setSelectedModule("overview");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Room modules could not be loaded."
      );
      setMessageIsError(true);
    } finally {
      setLoadingManifest(false);
    }
  }, [roomId, selectedModule]);

  useEffect(() => {
    void loadManifest();
  }, [loadManifest]);

  const loadModule = useCallback(
    async (moduleKey: RoomModuleKey) => {
      if (!roomId || CORE_TAB_LABELS[moduleKey]) return;
      setLoadingModule(true);
      setMessage("");
      setMessageIsError(false);
      try {
        const token = await accessToken();
        if (!token) return;
        const params = new URLSearchParams({ module: moduleKey });
        if (moduleKey === "high-capacity") {
          params.set("page", String(highCapacityPage));
          if (highCapacitySearch.trim()) {
            params.set("search", highCapacitySearch.trim());
          }
        }
        const response = await fetch(
          `/api/rooms/${encodeURIComponent(roomId)}/modules?${params.toString()}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          }
        );
        const result = (await response.json().catch(() => ({}))) as ModuleResponse;
        if (!response.ok) {
          throw new Error(result.error ?? "The Room module could not be loaded.");
        }
        setModuleData(result.data ?? null);
      } catch (error) {
        setModuleData(null);
        setMessage(
          error instanceof Error ? error.message : "The Room module could not be loaded."
        );
        setMessageIsError(true);
      } finally {
        setLoadingModule(false);
      }
    },
    [highCapacityPage, highCapacitySearch, roomId]
  );

  useEffect(() => {
    if (!hosts) return;
    if (CORE_TAB_LABELS[selectedModule]) {
      hosts.shell.classList.remove("is-room-tier-module-active");
      clickOriginalTab(hosts, selectedModule);
      setModuleData(null);
      return;
    }
    hosts.shell.classList.add("is-room-tier-module-active");
    void loadModule(selectedModule);
  }, [hosts, loadModule, selectedModule]);

  async function moduleAction(
    moduleKey: RoomModuleKey,
    payload: Record<string, unknown>,
    successMessage: string
  ) {
    if (!roomId) return false;
    setMessage("");
    setMessageIsError(false);
    try {
      const token = await accessToken();
      if (!token) throw new Error("Sign in again before continuing.");
      const response = await fetch(
        `/api/rooms/${encodeURIComponent(roomId)}/modules`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ module: moduleKey, ...payload }),
        }
      );
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        inviteUrl?: string;
      };
      if (!response.ok) {
        throw new Error(result.error ?? "The Room action could not be completed.");
      }
      setMessage(successMessage);
      if (result.inviteUrl) {
        await navigator.clipboard.writeText(result.inviteUrl).catch(() => undefined);
        setMessage("Secure invitation link created and copied.");
      }
      await loadModule(moduleKey);
      if (["requests", "settings", "invites"].includes(moduleKey)) {
        await loadManifest();
      }
      return true;
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The Room action could not be completed."
      );
      setMessageIsError(true);
      return false;
    }
  }

  if (!roomId || !hosts) return null;

  const modules = manifest?.modules ?? [];
  const selectedDefinition = modules.find(
    (moduleDefinition) => moduleDefinition.id === selectedModule
  );

  const navigation = createPortal(
    <nav
      className="room-workspace-tabs room-tier-navigation"
      data-loombus-tier-navigation="true"
      aria-label="Room subscription modules"
    >
      {loadingManifest && modules.length === 0 ? (
        <span className="room-tier-navigation-loading">
          <Loader2 aria-hidden="true" className="is-spinning" />
          Loading Room modules
        </span>
      ) : (
        modules.map((moduleDefinition) => {
          const Icon = MODULE_ICONS[moduleDefinition.id];
          return (
            <button
              key={moduleDefinition.id}
              type="button"
              aria-pressed={selectedModule === moduleDefinition.id}
              onClick={() => setSelectedModule(moduleDefinition.id)}
              title={moduleDefinition.description}
            >
              <Icon aria-hidden="true" />
              {moduleDefinition.label}
            </button>
          );
        })
      )}
    </nav>,
    hosts.navHost
  );

  const moduleContent = createPortal(
    !CORE_TAB_LABELS[selectedModule] ? (
      <section className="room-tier-module-panel">
        <header className="room-tier-module-heading">
          <div>
            <p className="rooms-live-eyebrow">{manifest?.plan?.label ?? "Room plan"}</p>
            <h2>{selectedDefinition?.label ?? "Room module"}</h2>
            <p>{selectedDefinition?.description}</p>
          </div>
          <button
            type="button"
            className="rooms-live-secondary-action"
            onClick={() => void loadModule(selectedModule)}
            disabled={loadingModule}
          >
            {loadingModule ? (
              <Loader2 aria-hidden="true" className="is-spinning" />
            ) : (
              <RefreshCw aria-hidden="true" />
            )}
            Refresh
          </button>
        </header>

        {message ? (
          <div className={`rooms-live-notice${messageIsError ? " is-error" : ""}`}>
            {message}
          </div>
        ) : null}

        {loadingModule ? (
          <div className="room-tier-module-loading">
            <Loader2 aria-hidden="true" className="is-spinning" />
            Loading {selectedDefinition?.label ?? "Room module"}…
          </div>
        ) : (
          <ModuleBody
            moduleKey={selectedModule}
            data={moduleData}
            manifest={manifest}
            members={members}
            highCapacityPage={highCapacityPage}
            highCapacitySearch={highCapacitySearch}
            setHighCapacityPage={setHighCapacityPage}
            setHighCapacitySearch={setHighCapacitySearch}
            reloadHighCapacity={() => void loadModule("high-capacity")}
            action={moduleAction}
          />
        )}
      </section>
    ) : null,
    hosts.moduleHost
  );

  return (
    <>
      {navigation}
      {moduleContent}
    </>
  );
}

function ModuleBody({
  moduleKey,
  data,
  manifest,
  members,
  highCapacityPage,
  highCapacitySearch,
  setHighCapacityPage,
  setHighCapacitySearch,
  reloadHighCapacity,
  action,
}: {
  moduleKey: RoomModuleKey;
  data: unknown;
  manifest: ManifestResponse | null;
  members: RoomMember[];
  highCapacityPage: number;
  highCapacitySearch: string;
  setHighCapacityPage: (page: number) => void;
  setHighCapacitySearch: (value: string) => void;
  reloadHighCapacity: () => void;
  action: (
    moduleKey: RoomModuleKey,
    payload: Record<string, unknown>,
    successMessage: string
  ) => Promise<boolean>;
}) {
  if (moduleKey === "files") {
    return <div data-loombus-room-files-host="true" />;
  }
  if (moduleKey === "requests") {
    return (
      <RequestsPanel
        requests={Array.isArray(data) ? (data as RequestItem[]) : []}
        onReview={(requestId, state) =>
          action(
            "requests",
            { action: "review_request", requestId, state },
            state === "approved" ? "Room membership approved." : "Join request declined."
          )
        }
      />
    );
  }
  if (
    moduleKey === "settings" ||
    moduleKey === "advanced-controls" ||
    moduleKey === "enterprise-controls"
  ) {
    return (
      <SettingsPanel
        moduleKey={moduleKey}
        data={data}
        onSave={(payload) =>
          action(moduleKey, { action: "update_settings", ...payload }, "Room settings saved.")
        }
      />
    );
  }
  if (moduleKey === "invites") {
    return (
      <InvitesPanel
        data={data}
        onCreate={(payload) =>
          action("invites", { action: "create_invite", ...payload }, "Invitation created.")
        }
        onRevoke={(inviteId) =>
          action("invites", { action: "revoke_invite", inviteId }, "Invitation revoked.")
        }
      />
    );
  }
  if (moduleKey === "activity") {
    return <ActivityPanel entries={Array.isArray(data) ? data : []} />;
  }
  if (
    moduleKey === "admin-tools" ||
    moduleKey === "operations" ||
    moduleKey === "community-operations"
  ) {
    return <OperationsPanel moduleKey={moduleKey} data={data} />;
  }
  if (moduleKey === "high-capacity") {
    return (
      <HighCapacityPanel
        data={data}
        page={highCapacityPage}
        search={highCapacitySearch}
        setPage={setHighCapacityPage}
        setSearch={setHighCapacitySearch}
        reload={reloadHighCapacity}
      />
    );
  }

  const records = Array.isArray(data) ? (data as ModuleRecord[]) : [];
  return (
    <RecordsPanel
      moduleKey={moduleKey}
      records={records}
      members={members}
      currentUserId={manifest?.access?.currentUserId ?? ""}
      canManage={Boolean(manifest?.access?.canManage)}
      action={action}
    />
  );
}

function RecordsPanel({
  moduleKey,
  records,
  members,
  currentUserId,
  canManage,
  action,
}: {
  moduleKey: RoomModuleKey;
  records: ModuleRecord[];
  members: RoomMember[];
  currentUserId: string;
  canManage: boolean;
  action: (
    moduleKey: RoomModuleKey,
    payload: Record<string, unknown>,
    successMessage: string
  ) => Promise<boolean>;
}) {
  return (
    <div className="room-tier-records-layout">
      {canManage ? (
        <CreateRecordForm
          moduleKey={moduleKey}
          members={members}
          onCreate={(payload) =>
            action(moduleKey, { action: "create_record", ...payload }, "Room item created.")
          }
        />
      ) : null}

      {records.length === 0 ? (
        <div className="room-tier-empty-state">
          <FileText aria-hidden="true" />
          <h3>No items have been added.</h3>
          <p>Room administrators can add the first item for this module.</p>
        </div>
      ) : (
        <div className="room-tier-record-grid">
          {records.map((record) => (
            <RecordCard
              key={record.id}
              moduleKey={moduleKey}
              record={record}
              members={members}
              currentUserId={currentUserId}
              canManage={canManage}
              onArchive={() =>
                action(
                  moduleKey,
                  { action: "archive_record", recordId: record.id },
                  "Room item removed."
                )
              }
              onUpdate={(payload) =>
                action(
                  moduleKey,
                  { action: "update_record", recordId: record.id, ...payload },
                  "Room item updated."
                )
              }
              onResponse={(payload) =>
                action(
                  moduleKey,
                  { action: "submit_response", recordId: record.id, payload },
                  moduleKey === "polls" ? "Vote recorded." : "Form submitted."
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CreateRecordForm({
  moduleKey,
  members,
  onCreate,
}: {
  moduleKey: RoomModuleKey;
  members: RoomMember[];
  onCreate: (payload: Record<string, unknown>) => Promise<boolean>;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [fieldA, setFieldA] = useState("");
  const [fieldB, setFieldB] = useState("");
  const [fieldC, setFieldC] = useState("");
  const [toggle, setToggle] = useState(false);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    setTitle("");
    setBody("");
    setFieldA("");
    setFieldB("");
    setFieldC("");
    setToggle(false);
  }, [moduleKey]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || working) return;
    setWorking(true);
    let metadata: Record<string, unknown> = {};
    if (moduleKey === "resources") {
      metadata = { url: fieldA, category: fieldB };
    } else if (moduleKey === "tasks") {
      metadata = { assigneeId: fieldA || null, dueAt: fieldB || null, priority: fieldC };
    } else if (moduleKey === "polls") {
      metadata = {
        options: fieldA.split("\n").map((item) => item.trim()).filter(Boolean),
        closesAt: fieldB || null,
        allowMultiple: toggle,
      };
    } else if (moduleKey === "directory") {
      metadata = { email: fieldA, phone: fieldB, organization: fieldC };
    } else if (moduleKey === "knowledge") {
      metadata = { category: fieldA };
    } else if (moduleKey === "forms") {
      metadata = {
        fields: fieldA.split("\n").map((item) => item.trim()).filter(Boolean),
      };
    } else if (moduleKey === "services") {
      metadata = { priceLabel: fieldA, url: fieldB, availability: fieldC };
    } else if (moduleKey === "member-workflows") {
      metadata = { memberId: fieldA, stage: fieldB, dueAt: fieldC || null };
    }
    const completed = await onCreate({ title, body, metadata });
    if (completed) {
      setTitle("");
      setBody("");
      setFieldA("");
      setFieldB("");
      setFieldC("");
      setToggle(false);
    }
    setWorking(false);
  }

  const titleLabel =
    moduleKey === "directory"
      ? "Contact name"
      : moduleKey === "polls"
        ? "Poll question"
        : moduleKey === "knowledge"
          ? "Question or article title"
          : moduleKey === "forms"
            ? "Form title"
            : moduleKey === "services"
              ? "Service or offering"
              : moduleKey === "member-workflows"
                ? "Workflow title"
                : "Title";

  return (
    <form className="room-tier-create-card" onSubmit={submit}>
      <div className="room-tier-create-heading">
        <Plus aria-hidden="true" />
        <div>
          <h3>Add to this module</h3>
          <p>New entries remain inside the verified Room boundary.</p>
        </div>
      </div>
      <label>
        <span>{titleLabel}</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} required />
      </label>
      <label>
        <span>{moduleKey === "knowledge" ? "Answer or content" : "Description or notes"}</span>
        <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={4} maxLength={12000} />
      </label>

      {moduleKey === "resources" ? (
        <div className="room-tier-form-grid">
          <label><span>HTTP or HTTPS link</span><input type="url" value={fieldA} onChange={(event) => setFieldA(event.target.value)} required /></label>
          <label><span>Category</span><input value={fieldB} onChange={(event) => setFieldB(event.target.value)} placeholder="Policy, portal, reference" /></label>
        </div>
      ) : null}

      {moduleKey === "tasks" ? (
        <div className="room-tier-form-grid">
          <label>
            <span>Assignee</span>
            <select value={fieldA} onChange={(event) => setFieldA(event.target.value)}>
              <option value="">Unassigned</option>
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>{displayName(member.profile, member.userId)}</option>
              ))}
            </select>
          </label>
          <label><span>Due date</span><input type="datetime-local" value={fieldB} onChange={(event) => setFieldB(event.target.value)} /></label>
          <label>
            <span>Priority</span>
            <select value={fieldC} onChange={(event) => setFieldC(event.target.value)}>
              <option value="normal">Normal</option><option value="low">Low</option><option value="high">High</option><option value="urgent">Urgent</option>
            </select>
          </label>
        </div>
      ) : null}

      {moduleKey === "polls" ? (
        <>
          <label><span>Options, one per line</span><textarea value={fieldA} onChange={(event) => setFieldA(event.target.value)} rows={5} required /></label>
          <div className="room-tier-form-grid">
            <label><span>Close date</span><input type="datetime-local" value={fieldB} onChange={(event) => setFieldB(event.target.value)} /></label>
            <label className="room-tier-checkbox"><input type="checkbox" checked={toggle} onChange={(event) => setToggle(event.target.checked)} /><span>Allow multiple choices</span></label>
          </div>
        </>
      ) : null}

      {moduleKey === "directory" ? (
        <div className="room-tier-form-grid">
          <label><span>Email</span><input type="email" value={fieldA} onChange={(event) => setFieldA(event.target.value)} /></label>
          <label><span>Phone</span><input value={fieldB} onChange={(event) => setFieldB(event.target.value)} /></label>
          <label><span>Organization or role</span><input value={fieldC} onChange={(event) => setFieldC(event.target.value)} /></label>
        </div>
      ) : null}

      {moduleKey === "knowledge" ? (
        <label><span>Category</span><input value={fieldA} onChange={(event) => setFieldA(event.target.value)} placeholder="General" /></label>
      ) : null}

      {moduleKey === "forms" ? (
        <label><span>Fields, one per line</span><textarea value={fieldA} onChange={(event) => setFieldA(event.target.value)} rows={5} required /></label>
      ) : null}

      {moduleKey === "services" ? (
        <div className="room-tier-form-grid">
          <label><span>Price or terms label</span><input value={fieldA} onChange={(event) => setFieldA(event.target.value)} placeholder="Contact for pricing" /></label>
          <label><span>Request or external link</span><input type="url" value={fieldB} onChange={(event) => setFieldB(event.target.value)} /></label>
          <label><span>Availability</span><input value={fieldC} onChange={(event) => setFieldC(event.target.value)} /></label>
        </div>
      ) : null}

      {moduleKey === "member-workflows" ? (
        <div className="room-tier-form-grid">
          <label>
            <span>Member</span>
            <select value={fieldA} onChange={(event) => setFieldA(event.target.value)} required>
              <option value="">Choose a member</option>
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>{displayName(member.profile, member.userId)}</option>
              ))}
            </select>
          </label>
          <label><span>Stage</span><input value={fieldB} onChange={(event) => setFieldB(event.target.value)} placeholder="Onboarding, review, follow-up" /></label>
          <label><span>Follow-up date</span><input type="datetime-local" value={fieldC} onChange={(event) => setFieldC(event.target.value)} /></label>
        </div>
      ) : null}

      <button type="submit" className="rooms-live-primary-action" disabled={working || !title.trim()}>
        {working ? <Loader2 aria-hidden="true" className="is-spinning" /> : <Plus aria-hidden="true" />}
        {working ? "Saving…" : "Add item"}
      </button>
    </form>
  );
}

function RecordCard({
  moduleKey,
  record,
  members,
  currentUserId,
  canManage,
  onArchive,
  onUpdate,
  onResponse,
}: {
  moduleKey: RoomModuleKey;
  record: ModuleRecord;
  members: RoomMember[];
  currentUserId: string;
  canManage: boolean;
  onArchive: () => Promise<boolean>;
  onUpdate: (payload: Record<string, unknown>) => Promise<boolean>;
  onResponse: (payload: Record<string, unknown>) => Promise<boolean>;
}) {
  const metadata = record.metadata ?? {};
  const assigneeId = asString(metadata.assigneeId);
  const assignee = members.find((member) => member.userId === assigneeId);
  const workflowMemberId = asString(metadata.memberId);
  const workflowMember = members.find((member) => member.userId === workflowMemberId);

  if (moduleKey === "polls") {
    return <PollCard record={record} canManage={canManage} onArchive={onArchive} onVote={onResponse} />;
  }
  if (moduleKey === "forms") {
    return <FormCard record={record} canManage={canManage} onArchive={onArchive} onSubmit={onResponse} />;
  }

  return (
    <article className="room-tier-record-card">
      <div className="room-tier-record-topline">
        <div>
          <span>{record.status}</span>
          <small>{formatDate(record.createdAt)}</small>
        </div>
        {canManage ? (
          <button type="button" className="room-workspace-icon-action is-danger" aria-label={`Remove ${record.title}`} onClick={() => void onArchive()}>
            <Trash2 aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <h3>{record.title}</h3>
      {record.body ? <p>{record.body}</p> : null}

      {moduleKey === "resources" && asString(metadata.url) ? (
        <a href={asString(metadata.url)} target="_blank" rel="noopener noreferrer" className="room-tier-record-link">
          <ExternalLink aria-hidden="true" />
          Open {asString(metadata.category) || "resource"}
        </a>
      ) : null}

      {moduleKey === "tasks" ? (
        <div className="room-tier-record-details">
          <span>Priority: {asString(metadata.priority) || "normal"}</span>
          <span>Assignee: {assignee ? displayName(assignee.profile, assignee.userId) : "Unassigned"}</span>
          {asString(metadata.dueAt) ? <span>Due: {formatDate(asString(metadata.dueAt))}</span> : null}
          {(canManage || assigneeId === currentUserId) && record.status !== "completed" ? (
            <button type="button" className="rooms-live-secondary-action" onClick={() => void onUpdate({ status: "completed" })}>
              <CheckCircle2 aria-hidden="true" /> Mark complete
            </button>
          ) : null}
        </div>
      ) : null}

      {moduleKey === "directory" ? (
        <div className="room-tier-record-details">
          {asString(metadata.organization) ? <span>{asString(metadata.organization)}</span> : null}
          {asString(metadata.email) ? <a href={`mailto:${asString(metadata.email)}`}>{asString(metadata.email)}</a> : null}
          {asString(metadata.phone) ? <a href={`tel:${asString(metadata.phone)}`}>{asString(metadata.phone)}</a> : null}
        </div>
      ) : null}

      {moduleKey === "knowledge" ? (
        <span className="room-tier-record-chip">{asString(metadata.category) || "General"}</span>
      ) : null}

      {moduleKey === "services" ? (
        <div className="room-tier-record-details">
          {asString(metadata.priceLabel) ? <strong>{asString(metadata.priceLabel)}</strong> : null}
          {asString(metadata.availability) ? <span>{asString(metadata.availability)}</span> : null}
          {asString(metadata.url) ? (
            <a href={asString(metadata.url)} target="_blank" rel="noopener noreferrer" className="room-tier-record-link"><ExternalLink aria-hidden="true" /> Request or learn more</a>
          ) : null}
        </div>
      ) : null}

      {moduleKey === "member-workflows" ? (
        <div className="room-tier-record-details">
          <span>Member: {workflowMember ? displayName(workflowMember.profile, workflowMember.userId) : workflowMemberId}</span>
          <span>Stage: {asString(metadata.stage) || "New"}</span>
          {asString(metadata.dueAt) ? <span>Follow-up: {formatDate(asString(metadata.dueAt))}</span> : null}
        </div>
      ) : null}
    </article>
  );
}

function PollCard({
  record,
  canManage,
  onArchive,
  onVote,
}: {
  record: ModuleRecord;
  canManage: boolean;
  onArchive: () => Promise<boolean>;
  onVote: (payload: Record<string, unknown>) => Promise<boolean>;
}) {
  const options = asArray(record.metadata.options).map((option) => option as Record<string, unknown>);
  const ownOptionIds = asArray(record.responseSummary?.ownResponse?.optionIds).map(asString);
  const [selected, setSelected] = useState<string[]>(ownOptionIds);
  const multiple = asBoolean(record.metadata.allowMultiple);
  const counts = record.responseSummary?.optionCounts ?? {};

  function choose(optionId: string) {
    setSelected((current) =>
      multiple
        ? current.includes(optionId)
          ? current.filter((item) => item !== optionId)
          : [...current, optionId]
        : [optionId]
    );
  }

  return (
    <article className="room-tier-record-card">
      <div className="room-tier-record-topline">
        <div><span>{record.status}</span><small>{record.responseSummary?.totalResponses ?? 0} responses</small></div>
        {canManage ? <button type="button" className="room-workspace-icon-action is-danger" onClick={() => void onArchive()} aria-label={`Remove ${record.title}`}><Trash2 aria-hidden="true" /></button> : null}
      </div>
      <h3>{record.title}</h3>
      {record.body ? <p>{record.body}</p> : null}
      <div className="room-tier-poll-options">
        {options.map((option) => {
          const id = asString(option.id);
          return (
            <label key={id}>
              <input type={multiple ? "checkbox" : "radio"} name={`poll-${record.id}`} checked={selected.includes(id)} onChange={() => choose(id)} />
              <span>{asString(option.label)}</span>
              <strong>{counts[id] ?? 0}</strong>
            </label>
          );
        })}
      </div>
      <button type="button" className="rooms-live-primary-action" disabled={selected.length === 0 || record.status === "closed"} onClick={() => void onVote({ optionIds: selected })}>
        <Vote aria-hidden="true" /> Record vote
      </button>
    </article>
  );
}

function FormCard({
  record,
  canManage,
  onArchive,
  onSubmit,
}: {
  record: ModuleRecord;
  canManage: boolean;
  onArchive: () => Promise<boolean>;
  onSubmit: (payload: Record<string, unknown>) => Promise<boolean>;
}) {
  const fields = asArray(record.metadata.fields).map((field) => field as Record<string, unknown>);
  const [values, setValues] = useState<Record<string, string>>({});
  return (
    <article className="room-tier-record-card">
      <div className="room-tier-record-topline">
        <div><span>Form</span><small>{record.responseSummary?.totalResponses ?? 0} submissions</small></div>
        {canManage ? <button type="button" className="room-workspace-icon-action is-danger" onClick={() => void onArchive()} aria-label={`Remove ${record.title}`}><Trash2 aria-hidden="true" /></button> : null}
      </div>
      <h3>{record.title}</h3>
      {record.body ? <p>{record.body}</p> : null}
      <div className="room-tier-form-fields">
        {fields.map((field) => {
          const id = asString(field.id);
          return (
            <label key={id}>
              <span>{asString(field.label)}</span>
              <input value={values[id] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [id]: event.target.value }))} />
            </label>
          );
        })}
      </div>
      <button type="button" className="rooms-live-primary-action" onClick={() => void onSubmit({ values })}>
        <ClipboardList aria-hidden="true" /> Submit form
      </button>
      {canManage && record.responseSummary?.responses?.length ? (
        <details className="room-tier-submissions">
          <summary>Review submissions</summary>
          {record.responseSummary.responses.map((response) => (
            <article key={response.id}>
              <strong>{response.responderId ?? "Member submission"}</strong>
              <small>{formatDate(response.createdAt)}</small>
              <pre>{JSON.stringify(response.payload.values ?? {}, null, 2)}</pre>
            </article>
          ))}
        </details>
      ) : null}
    </article>
  );
}

function RequestsPanel({
  requests,
  onReview,
}: {
  requests: RequestItem[];
  onReview: (requestId: string, state: "approved" | "declined") => Promise<boolean>;
}) {
  const pending = requests.filter((request) => request.state === "pending");
  if (pending.length === 0) {
    return <div className="room-tier-empty-state"><UserCheck aria-hidden="true" /><h3>No pending requests</h3><p>New Room join requests will appear here.</p></div>;
  }
  return (
    <div className="room-tier-record-grid">
      {pending.map((request) => (
        <article key={request.id} className="room-tier-record-card">
          <span className="room-tier-record-chip">Pending</span>
          <h3>{displayName(request.applicant, request.applicantId)}</h3>
          <small>{formatDate(request.createdAt)}</small>
          {request.note ? <p>{request.note}</p> : null}
          <div className="room-tier-inline-actions">
            <button type="button" className="rooms-live-primary-action" onClick={() => void onReview(request.id, "approved")}><CheckCircle2 aria-hidden="true" /> Approve</button>
            <button type="button" className="rooms-live-secondary-action" onClick={() => void onReview(request.id, "declined")}><Trash2 aria-hidden="true" /> Decline</button>
          </div>
        </article>
      ))}
    </div>
  );
}

function SettingsPanel({
  moduleKey,
  data,
  onSave,
}: {
  moduleKey: RoomModuleKey;
  data: unknown;
  onSave: (payload: Record<string, unknown>) => Promise<boolean>;
}) {
  const source = (data ?? {}) as {
    room?: { name?: string; description?: string; inviteOnly?: boolean };
    settings?: RoomSettingsData;
  };
  const [name, setName] = useState(source.room?.name ?? "");
  const [description, setDescription] = useState(source.room?.description ?? "");
  const [inviteOnly, setInviteOnly] = useState(source.room?.inviteOnly ?? true);
  const [allowMemberPosts, setAllowMemberPosts] = useState(source.settings?.allowMemberPosts ?? true);
  const [directoryVisible, setDirectoryVisible] = useState(source.settings?.memberDirectoryVisible ?? true);
  const [inviteApproval, setInviteApproval] = useState(source.settings?.inviteRequiresApproval ?? false);
  const [domains, setDomains] = useState((source.settings?.allowedEmailDomains ?? []).join("\n"));
  const [defaultRole, setDefaultRole] = useState<"member" | "moderator">(source.settings?.defaultInviteRole ?? "member");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    setName(source.room?.name ?? "");
    setDescription(source.room?.description ?? "");
    setInviteOnly(source.room?.inviteOnly ?? true);
    setAllowMemberPosts(source.settings?.allowMemberPosts ?? true);
    setDirectoryVisible(source.settings?.memberDirectoryVisible ?? true);
    setInviteApproval(source.settings?.inviteRequiresApproval ?? false);
    setDomains((source.settings?.allowedEmailDomains ?? []).join("\n"));
    setDefaultRole(source.settings?.defaultInviteRole ?? "member");
  }, [data]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking(true);
    await onSave({
      room: { name, description, inviteOnly },
      settings: {
        allowMemberPosts,
        memberDirectoryVisible: directoryVisible,
        inviteRequiresApproval: inviteApproval,
        allowedEmailDomains: domains.split(/\n|,/).map((item) => item.trim()).filter(Boolean),
        defaultInviteRole: defaultRole,
      },
    });
    setWorking(false);
  }

  const core = moduleKey === "settings";
  return (
    <form className="room-tier-create-card" onSubmit={submit}>
      {core ? (
        <>
          <label><span>Room name</span><input value={name} onChange={(event) => setName(event.target.value)} minLength={3} maxLength={80} required /></label>
          <label><span>Room purpose</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} minLength={10} maxLength={600} required /></label>
          <label className="room-tier-checkbox"><input type="checkbox" checked={inviteOnly} onChange={(event) => setInviteOnly(event.target.checked)} /><span>Keep this Room invite-only</span></label>
        </>
      ) : (
        <>
          <label className="room-tier-checkbox"><input type="checkbox" checked={allowMemberPosts} onChange={(event) => setAllowMemberPosts(event.target.checked)} /><span>Allow ordinary members to create discussions</span></label>
          <label className="room-tier-checkbox"><input type="checkbox" checked={directoryVisible} onChange={(event) => setDirectoryVisible(event.target.checked)} /><span>Allow members to view the private directory</span></label>
          <label className="room-tier-checkbox"><input type="checkbox" checked={inviteApproval} onChange={(event) => setInviteApproval(event.target.checked)} /><span>Require administrator approval after invitation redemption</span></label>
          <label><span>Allowed invitation email domains, one per line</span><textarea rows={5} value={domains} onChange={(event) => setDomains(event.target.value)} placeholder="company.com\npartner.org" /></label>
          <label><span>Default invitation role</span><select value={defaultRole} onChange={(event) => setDefaultRole(event.target.value === "moderator" ? "moderator" : "member")}><option value="member">Member</option><option value="moderator">Moderator</option></select></label>
        </>
      )}
      <button type="submit" className="rooms-live-primary-action" disabled={working}>
        {working ? <Loader2 aria-hidden="true" className="is-spinning" /> : <Settings aria-hidden="true" />}
        {working ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}

function InvitesPanel({
  data,
  onCreate,
  onRevoke,
}: {
  data: unknown;
  onCreate: (payload: Record<string, unknown>) => Promise<boolean>;
  onRevoke: (inviteId: string) => Promise<boolean>;
}) {
  const source = (data ?? {}) as {
    invites?: Array<{
      id: string;
      label: string;
      role: string;
      maxUses: number | null;
      useCount: number;
      expiresAt: string | null;
      revokedAt: string | null;
      createdAt: string | null;
    }>;
  };
  const [label, setLabel] = useState("Room invitation");
  const [role, setRole] = useState("member");
  const [maxUses, setMaxUses] = useState("25");
  const [expiresAt, setExpiresAt] = useState("");
  const [working, setWorking] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking(true);
    await onCreate({ label, role, maxUses: Number(maxUses) || null, expiresAt: expiresAt || null });
    setWorking(false);
  }

  const invites = source.invites ?? [];
  return (
    <div className="room-tier-records-layout">
      <form className="room-tier-create-card" onSubmit={submit}>
        <h3>Create a secure invitation</h3>
        <div className="room-tier-form-grid">
          <label><span>Label</span><input value={label} onChange={(event) => setLabel(event.target.value)} /></label>
          <label><span>Role</span><select value={role} onChange={(event) => setRole(event.target.value)}><option value="member">Member</option><option value="moderator">Moderator</option></select></label>
          <label><span>Maximum uses</span><input type="number" min={1} max={10000} value={maxUses} onChange={(event) => setMaxUses(event.target.value)} /></label>
          <label><span>Expiration</span><input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></label>
        </div>
        <button type="submit" className="rooms-live-primary-action" disabled={working}>{working ? <Loader2 aria-hidden="true" className="is-spinning" /> : <Copy aria-hidden="true" />}{working ? "Creating…" : "Create and copy link"}</button>
      </form>
      <div className="room-tier-record-grid">
        {invites.map((invite) => (
          <article key={invite.id} className="room-tier-record-card">
            <div className="room-tier-record-topline"><span className="room-tier-record-chip">{invite.revokedAt ? "Revoked" : "Active"}</span><small>{formatDate(invite.createdAt)}</small></div>
            <h3>{invite.label}</h3>
            <p>Role: {invite.role} · Uses: {invite.useCount}{invite.maxUses === null ? "" : ` of ${invite.maxUses}`}</p>
            {invite.expiresAt ? <small>Expires {formatDate(invite.expiresAt)}</small> : null}
            {!invite.revokedAt ? <button type="button" className="rooms-live-secondary-action" onClick={() => void onRevoke(invite.id)}><Trash2 aria-hidden="true" /> Revoke</button> : null}
          </article>
        ))}
      </div>
    </div>
  );
}

function ActivityPanel({ entries }: { entries: unknown[] }) {
  if (entries.length === 0) return <div className="room-tier-empty-state"><ScrollText aria-hidden="true" /><h3>No audit activity yet</h3><p>Privileged Room actions will appear here.</p></div>;
  return (
    <div className="room-tier-activity-list">
      {entries.map((entryValue, index) => {
        const entry = entryValue as { id?: string; action?: string; actor?: Profile | null; actorId?: string | null; targetType?: string; createdAt?: string | null };
        return (
          <article key={entry.id ?? index}>
            <ScrollText aria-hidden="true" />
            <div><strong>{entry.action?.replaceAll(".", " ")}</strong><span>{displayName(entry.actor, entry.actorId ?? "System")} · {entry.targetType}</span></div>
            <small>{formatDate(entry.createdAt)}</small>
          </article>
        );
      })}
    </div>
  );
}

function OperationsPanel({ moduleKey, data }: { moduleKey: RoomModuleKey; data: unknown }) {
  const source = (data ?? {}) as { summary?: Record<string, number | null>; plan?: { label?: string; memberLimit?: number | null; roomLimit?: number | null } };
  const summary = source.summary ?? {};
  const labels: Record<string, string> = { posts: "Discussions", events: "Events", announcements: "Announcements", members: "Members", requests: "Pending requests", records: "Module records", resources: "Stored files" };
  return (
    <div className="room-tier-operations-layout">
      <section className="room-tier-operation-summary">
        {Object.entries(labels).map(([key, label]) => (
          <article key={key}><span>{label}</span><strong>{summary[key] ?? "Unavailable"}</strong></article>
        ))}
      </section>
      <section className="room-tier-create-card">
        <h3>{moduleKey === "community-operations" ? "Private community operating boundary" : moduleKey === "admin-tools" ? "Administrative operating view" : "Room operations"}</h3>
        <p>These totals are read from the Room’s private discussions, calendar, announcements, membership, requests, tier modules, and file library.</p>
        <div className="room-tier-record-details">
          <span>Plan: {source.plan?.label ?? "Room plan"}</span>
          <span>Member capacity: {source.plan?.memberLimit ?? "Custom"}</span>
          <span>Included Rooms: {source.plan?.roomLimit ?? "Custom"}</span>
        </div>
      </section>
    </div>
  );
}

function HighCapacityPanel({
  data,
  page,
  search,
  setPage,
  setSearch,
  reload,
}: {
  data: unknown;
  page: number;
  search: string;
  setPage: (page: number) => void;
  setSearch: (value: string) => void;
  reload: () => void;
}) {
  const source = (data ?? {}) as { members?: RoomMember[]; total?: number; pageSize?: number };
  const members = source.members ?? [];
  const pageSize = source.pageSize ?? 50;
  const total = source.total ?? members.length;
  return (
    <div className="room-tier-records-layout">
      <form className="room-tier-search-card" onSubmit={(event) => { event.preventDefault(); setPage(1); reload(); }}>
        <label><span>Search this member page</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, username, or user ID" /></label>
        <button type="submit" className="rooms-live-secondary-action"><RefreshCw aria-hidden="true" /> Search</button>
      </form>
      <div className="room-tier-capacity-summary"><strong>{total}</strong><span>active members · page {page}</span></div>
      <div className="room-tier-member-list">
        {members.map((member) => (
          <article key={member.id || member.userId}><div><strong>{displayName(member.profile, member.userId)}</strong><span>{member.profile?.username ? `@${member.profile.username}` : member.userId}</span></div><span className="room-tier-record-chip">{member.role}</span></article>
        ))}
      </div>
      <div className="room-tier-inline-actions">
        <button type="button" className="rooms-live-secondary-action" disabled={page <= 1} onClick={() => { setPage(Math.max(1, page - 1)); window.setTimeout(reload, 0); }}>Previous</button>
        <button type="button" className="rooms-live-secondary-action" disabled={page * pageSize >= total} onClick={() => { setPage(page + 1); window.setTimeout(reload, 0); }}>Next</button>
      </div>
    </div>
  );
}
