from pathlib import Path

path = Path("src/components/room-tier-modules-workspace.tsx")
source = path.read_text()


def replace_once(old: str, new: str) -> None:
    global source
    count = source.count(old)
    if count != 1:
        raise SystemExit(f"Expected one match, found {count}: {old[:100]!r}")
    source = source.replace(old, new, 1)


replace_once(
    '''  useEffect,
  useMemo,
  useState,
} from "react";''',
    '''  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";''',
)

replace_once(
    '''  const [moduleData, setModuleData] = useState<unknown>(null);
  const [loadingManifest, setLoadingManifest] = useState(false);
  const [loadingModule, setLoadingModule] = useState(false);''',
    '''  const [moduleData, setModuleData] = useState<unknown>(null);
  const [loadedModule, setLoadedModule] = useState<RoomModuleKey | null>(null);
  const [loadingManifest, setLoadingManifest] = useState(false);
  const [loadingModule, setLoadingModule] = useState(false);''',
)

replace_once(
    '''  const [highCapacityPage, setHighCapacityPage] = useState(1);
  const [highCapacitySearch, setHighCapacitySearch] = useState("");

  useEffect(() => {''',
    '''  const [highCapacityPage, setHighCapacityPage] = useState(1);
  const [highCapacitySearch, setHighCapacitySearch] = useState("");
  const selectedModuleRef = useRef<RoomModuleKey>("overview");
  const moduleRequestIdRef = useRef(0);

  const selectModule = useCallback((moduleKey: RoomModuleKey) => {
    selectedModuleRef.current = moduleKey;
    moduleRequestIdRef.current += 1;
    setSelectedModule(moduleKey);
    setMessage("");
    setMessageIsError(false);
    setLoadingModule(!CORE_TAB_LABELS[moduleKey]);
    setModuleData(null);
    setLoadedModule(null);
  }, []);

  useEffect(() => {''',
)

replace_once(
    '''      const nextHosts = findPortalHosts();
      if (nextHosts) setHosts(nextHosts);''',
    '''      const nextHosts = findPortalHosts();
      if (!nextHosts) return;
      setHosts((current) => {
        if (
          current?.shell === nextHosts.shell &&
          current.originalNav === nextHosts.originalNav &&
          current.navHost === nextHosts.navHost &&
          current.moduleHost === nextHosts.moduleHost
        ) {
          return current;
        }
        return nextHosts;
      });''',
)

replace_once(
    '''      const included = nextManifest.modules?.some(
        (moduleDefinition) => moduleDefinition.id === selectedModule
      );
      if (!included) setSelectedModule("overview");''',
    '''      const included = nextManifest.modules?.some(
        (moduleDefinition) =>
          moduleDefinition.id === selectedModuleRef.current
      );
      if (!included) selectModule("overview");''',
)

replace_once(
    '''  }, [roomId, selectedModule]);''',
    '''  }, [roomId, selectModule]);''',
)

replace_once(
    '''  const loadModule = useCallback(
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
  );''',
    '''  const loadModule = useCallback(
    async (moduleKey: RoomModuleKey) => {
      if (!roomId || CORE_TAB_LABELS[moduleKey]) return;
      const requestId = ++moduleRequestIdRef.current;
      setLoadingModule(true);
      setMessage("");
      setMessageIsError(false);
      try {
        const token = await accessToken();
        if (!token) {
          throw new Error("Sign in again before continuing.");
        }
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
        if (requestId !== moduleRequestIdRef.current) return;
        setModuleData(result.data ?? null);
        setLoadedModule(moduleKey);
      } catch (error) {
        if (requestId !== moduleRequestIdRef.current) return;
        setModuleData(null);
        setLoadedModule(null);
        setMessage(
          error instanceof Error ? error.message : "The Room module could not be loaded."
        );
        setMessageIsError(true);
      } finally {
        if (requestId === moduleRequestIdRef.current) {
          setLoadingModule(false);
        }
      }
    },
    [highCapacityPage, highCapacitySearch, roomId]
  );''',
)

replace_once(
    '''    if (CORE_TAB_LABELS[selectedModule]) {
      hosts.shell.classList.remove("is-room-tier-module-active");
      clickOriginalTab(hosts, selectedModule);
      setModuleData(null);
      return;
    }''',
    '''    if (CORE_TAB_LABELS[selectedModule]) {
      moduleRequestIdRef.current += 1;
      hosts.shell.classList.remove("is-room-tier-module-active");
      clickOriginalTab(hosts, selectedModule);
      setLoadingModule(false);
      setModuleData(null);
      setLoadedModule(null);
      return;
    }''',
)

replace_once(
    '''  const selectedDefinition = modules.find(
    (moduleDefinition) => moduleDefinition.id === selectedModule
  );''',
    '''  const selectedDefinition = modules.find(
    (moduleDefinition) => moduleDefinition.id === selectedModule
  );
  const selectedModuleReady = loadedModule === selectedModule;''',
)

replace_once(
    '''              onClick={() => setSelectedModule(moduleDefinition.id)}''',
    '''              onClick={() => selectModule(moduleDefinition.id)}''',
)

replace_once(
    '''      <section className="room-tier-module-panel">''',
    '''      <section
        className="room-tier-module-panel"
        aria-busy={loadingModule}
      >''',
)

replace_once(
    '''        {loadingModule ? (
          <div className="room-tier-module-loading">
            <Loader2 aria-hidden="true" className="is-spinning" />
            Loading {selectedDefinition?.label ?? "Room module"}…
          </div>
        ) : (
          <ModuleBody''',
    '''        {!selectedModuleReady ? (
          loadingModule ? (
            <div className="room-tier-module-loading" role="status" aria-live="polite">
              <Loader2 aria-hidden="true" className="is-spinning" />
              Loading {selectedDefinition?.label ?? "Room module"}…
            </div>
          ) : null
        ) : (
          <ModuleBody''',
)

path.write_text(source)
print("Applied stable Room module loading state fix.")
