"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type SavedDiscussion = {
  id: string;
  created_at: string;
  collection_id: string | null;
  private_note: string | null;
  private_note_updated_at: string | null;
  discussions: {
    id: string;
    title: string;
    topic: string;
    reality_lens: string | null;
    purpose_lane: string | null;
    body: string;
    created_at: string;
  } | null;
};

type BookmarkCollection = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

type AiEntitlement = {
  tier: string | null;
  ai_assisted_enabled: boolean | null;
  monthly_summary_limit: number | null;
} | null;

type ExportFormat = "markdown" | "json";

type KnowledgeSignal = {
  label: string;
  count: number;
};

type LearningPathStep = {
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
};

function sortKnowledgeSignals(counts: Record<string, number>) {
  return Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }

      return a.label.localeCompare(b.label);
    });
}

function incrementSignal(counts: Record<string, number>, value: string | null | undefined) {
  const label = value?.trim();

  if (!label) {
    return;
  }

  counts[label] = (counts[label] ?? 0) + 1;
}

function getSafeExportDate() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

function hasCollectionAccess(entitlement: AiEntitlement, isAdmin: boolean) {
  if (isAdmin) {
    return true;
  }

  if (!entitlement?.ai_assisted_enabled) {
    return false;
  }

  return entitlement.tier === "premium" || entitlement.tier === "admin";
}

function hasPrivateNotesAccess(entitlement: AiEntitlement, isAdmin: boolean) {
  if (isAdmin) {
    return true;
  }

  if (!entitlement) {
    return false;
  }

  if (entitlement.tier === "admin") {
    return true;
  }

  return (
    entitlement.ai_assisted_enabled === true &&
    entitlement.tier === "premium" &&
    (entitlement.monthly_summary_limit ?? 0) > 50
  );
}

function KnowledgeSignalGroup({
  title,
  empty,
  signals,
}: {
  title: string;
  empty: string;
  signals: KnowledgeSignal[];
}) {
  return (
    <div className="rounded-2xl border border-zinc-900 bg-black p-4">
      <h3 className="mb-3 text-sm font-medium text-zinc-300">
        {title}
      </h3>

      {signals.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {signals.map((signal) => (
            <span
              key={signal.label}
              className="rounded-full border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400"
            >
              {signal.label} · {signal.count}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-zinc-600">
          {empty}
        </p>
      )}
    </div>
  );
}

function LearningPathCard({
  step,
  index,
}: {
  step: LearningPathStep;
  index: number;
}) {
  return (
    <div className="rounded-2xl border border-zinc-900 bg-black p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <span className="rounded-full border border-zinc-800 px-2.5 py-1 text-xs text-zinc-500">
          Step {index + 1}
        </span>
      </div>

      <h3 className="mb-2 text-base font-medium text-zinc-200">
        {step.title}
      </h3>

      <p className="mb-4 text-sm leading-relaxed text-zinc-600">
        {step.description}
      </p>

      <Link
        href={step.actionHref}
        className="inline-flex rounded-full border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-zinc-600 hover:text-white"
      >
        {step.actionLabel}
      </Link>
    </div>
  );
}

export default function SavedPage() {
  const [saved, setSaved] = useState<SavedDiscussion[]>([]);
  const [collections, setCollections] = useState<BookmarkCollection[]>([]);
  const [entitlement, setEntitlement] = useState<AiEntitlement>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState("all");
  const [savedSearchQuery, setSavedSearchQuery] = useState("");
  const [activeSavedTool, setActiveSavedTool] =
    useState<"none" | "search" | "folders" | "notes">("none");
  const [activeSavedInsight, setActiveSavedInsight] =
    useState<"none" | "knowledge" | "purpose" | "learning" | "path">("none");
  const [showSavedNotesOnly, setShowSavedNotesOnly] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [creatingCollection, setCreatingCollection] = useState(false);
  const [removingBookmarkId, setRemovingBookmarkId] = useState<string | null>(null);
  const [movingBookmarkId, setMovingBookmarkId] = useState<string | null>(null);
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);
  const [deletingCollectionId, setDeletingCollectionId] = useState<string | null>(null);
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const canUseCollections = hasCollectionAccess(entitlement, isAdmin);
  const canUsePrivateNotes = hasPrivateNotesAccess(entitlement, isAdmin);
  const canExportSavedNotes = canUsePrivateNotes;

  useEffect(() => {
    async function loadSaved() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        window.location.href = "/login";
        return;
      }

      setCurrentUserId(userData.user.id);

      const [
        { data: profileData },
        { data: entitlementData },
        { data: collectionData },
        { data: bookmarkData },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", userData.user.id)
          .maybeSingle(),
        supabase
          .from("user_ai_entitlements")
          .select("tier, ai_assisted_enabled, monthly_summary_limit")
          .eq("user_id", userData.user.id)
          .maybeSingle(),
        supabase
          .from("bookmark_collections")
          .select("id, user_id, name, description, created_at, updated_at")
          .eq("user_id", userData.user.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("bookmarks")
          .select(`
            id,
            created_at,
            collection_id,
            private_note,
            private_note_updated_at,
            discussions (
              id,
              title,
              topic,
              reality_lens,
              purpose_lane,
              body,
              created_at
            )
          `)
          .eq("user_id", userData.user.id)
          .order("created_at", { ascending: false }),
      ]);

      setIsAdmin(Boolean(profileData?.is_admin));
      setEntitlement((entitlementData ?? null) as AiEntitlement);
      setCollections((collectionData ?? []) as BookmarkCollection[]);

      const normalized = (bookmarkData ?? []).map((item) => ({
        ...item,
        collection_id: item.collection_id ?? null,
        private_note: item.private_note ?? null,
        private_note_updated_at: item.private_note_updated_at ?? null,
        discussions: Array.isArray(item.discussions)
          ? item.discussions[0] ?? null
          : item.discussions,
      })) as SavedDiscussion[];

      setSaved(normalized);
      setNoteDrafts(
        normalized.reduce<Record<string, string>>((drafts, item) => {
          drafts[item.id] = item.private_note ?? "";
          return drafts;
        }, {})
      );
      setLoading(false);
    }

    loadSaved();
  }, []);

  const collectionCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: saved.length,
      unfiled: 0,
    };

    for (const item of saved) {
      if (!item.collection_id) {
        counts.unfiled += 1;
        continue;
      }

      counts[item.collection_id] = (counts[item.collection_id] ?? 0) + 1;
    }

    return counts;
  }, [saved]);

  const collectionNameById = useMemo(() => {
    return collections.reduce<Record<string, string>>((map, collection) => {
      map[collection.id] = collection.name;
      return map;
    }, {});
  }, [collections]);

  const selectedCollectionLabel =
    selectedCollectionId === "all"
      ? "All saved"
      : selectedCollectionId === "unfiled"
        ? "Unfiled"
        : collectionNameById[selectedCollectionId] ?? "Selected folder";

  const filteredSaved = useMemo(() => {
    const collectionFiltered =
      selectedCollectionId === "all"
        ? saved
        : selectedCollectionId === "unfiled"
          ? saved.filter((item) => !item.collection_id)
          : saved.filter((item) => item.collection_id === selectedCollectionId);

    const noteFiltered = showSavedNotesOnly
      ? collectionFiltered.filter((item) =>
          (noteDrafts[item.id] ?? item.private_note ?? "").trim()
        )
      : collectionFiltered;

    const query = savedSearchQuery.trim().toLowerCase();

    if (!query) {
      return noteFiltered;
    }

    return noteFiltered.filter((item) => {
      const discussion = item.discussions;
      const note = noteDrafts[item.id] ?? item.private_note ?? "";

      return (
        (discussion?.title ?? "").toLowerCase().includes(query) ||
        (discussion?.topic ?? "").toLowerCase().includes(query) ||
        (discussion?.purpose_lane ?? "").toLowerCase().includes(query) ||
        (discussion?.body ?? "").toLowerCase().includes(query) ||
        note.toLowerCase().includes(query)
      );
    });
  }, [saved, selectedCollectionId, savedSearchQuery, noteDrafts, showSavedNotesOnly]);

  const knowledgeSnapshot = useMemo(() => {
    const topicCounts: Record<string, number> = {};
    const lensCounts: Record<string, number> = {};
    const purposeCounts: Record<string, number> = {};
    const folderCounts: Record<string, number> = {};
    let notesCount = 0;
    let recentSavedCount = 0;

    const recentCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;

    for (const item of saved) {
      const discussion = item.discussions;

      if (!discussion) {
        continue;
      }

      incrementSignal(topicCounts, discussion.topic);
      incrementSignal(lensCounts, discussion.reality_lens);
      incrementSignal(purposeCounts, discussion.purpose_lane);

      const folderName = item.collection_id
        ? collectionNameById[item.collection_id] ?? "Unknown folder"
        : "Unfiled";

      incrementSignal(folderCounts, folderName);

      const note = noteDrafts[item.id] ?? item.private_note ?? "";

      if (note.trim()) {
        notesCount += 1;
      }

      if (new Date(item.created_at).getTime() >= recentCutoff) {
        recentSavedCount += 1;
      }
    }

    return {
      topics: sortKnowledgeSignals(topicCounts).slice(0, 6),
      lenses: sortKnowledgeSignals(lensCounts).slice(0, 6),
      purposeSignals: sortKnowledgeSignals(purposeCounts).slice(0, 6),
      folders: sortKnowledgeSignals(folderCounts).slice(0, 6),
      notesCount,
      recentSavedCount,
    };
  }, [collectionNameById, noteDrafts, saved]);

  const purposePathCards = useMemo(() => {
    const primaryPurposeLane = knowledgeSnapshot.purposeSignals[0]?.label ?? null;
    const secondaryPurposeLane = knowledgeSnapshot.purposeSignals[1]?.label ?? null;
    const primaryTopic = knowledgeSnapshot.topics[0]?.label ?? null;
    const hasNotes = knowledgeSnapshot.notesCount > 0;

    return [
      {
        title: primaryPurposeLane
          ? `Revisit ${primaryPurposeLane}`
          : "Choose a purpose direction",
        description: primaryPurposeLane
          ? `Start with saved discussions in ${primaryPurposeLane}. Look for what you can learn, build, contribute, or revisit next.`
          : "Save discussions with Purpose Lanes so your reading path can show a clearer direction.",
        actionLabel: primaryPurposeLane ? `Search ${primaryPurposeLane}` : "Browse Purpose Lanes",
        actionHref: primaryPurposeLane
          ? `/saved?search=${encodeURIComponent(primaryPurposeLane)}`
          : "/discussions",
      },
      {
        title: primaryTopic && primaryPurposeLane
          ? `Connect ${primaryTopic} to ${primaryPurposeLane}`
          : "Connect topic to direction",
        description: primaryTopic && primaryPurposeLane
          ? `Your saved library links ${primaryTopic} with ${primaryPurposeLane}. Use that connection to decide what is worth reading more deeply.`
          : "A useful path forms when saved topics connect to a purpose direction like learning, contribution, mastery, or community.",
        actionLabel: primaryTopic ? `Search ${primaryTopic}` : "Review saved",
        actionHref: primaryTopic
          ? `/saved?search=${encodeURIComponent(primaryTopic)}`
          : "/saved",
      },
      {
        title: secondaryPurposeLane
          ? `Compare with ${secondaryPurposeLane}`
          : "Add one more useful lane",
        description: secondaryPurposeLane
          ? `${secondaryPurposeLane} is another direction in your saved library. Compare it with your strongest lane before adding more saves.`
          : "A second purpose lane can help you separate what you are learning from what you may want to contribute or build.",
        actionLabel: secondaryPurposeLane ? `Search ${secondaryPurposeLane}` : "Find discussions",
        actionHref: secondaryPurposeLane
          ? `/saved?search=${encodeURIComponent(secondaryPurposeLane)}`
          : "/discussions",
      },
      {
        title: hasNotes
          ? "Turn notes into next steps"
          : "Add notes to clarify why it matters",
        description: hasNotes
          ? "Your private notes can explain why a saved discussion matters and what you may want to do with it later."
          : "A short private note can turn a saved discussion from passive reading into a useful purpose path.",
        actionLabel: hasNotes ? "Review notes" : "Open saved",
        actionHref: "/saved",
      },
    ];
  }, [knowledgeSnapshot]);

  const learningPath = useMemo(() => {
    const primaryTopic = knowledgeSnapshot.topics[0]?.label ?? null;
    const primaryLens = knowledgeSnapshot.lenses[0]?.label ?? null;
    const primaryFolder = knowledgeSnapshot.folders.find((folder) => folder.label !== "Unfiled")?.label ?? null;
    const primaryPurposeLane = knowledgeSnapshot.purposeSignals[0]?.label ?? null;
    const hasNotes = knowledgeSnapshot.notesCount > 0;
    const hasRecentSaves = knowledgeSnapshot.recentSavedCount > 0;

    const steps: LearningPathStep[] = [];

    steps.push({
      title: primaryTopic
        ? `Start with ${primaryTopic}`
        : "Start with your strongest saved discussion",
      description: primaryTopic
        ? `Your saved library currently points most strongly toward ${primaryTopic}. Begin there before branching into other topics.`
        : "Pick one saved discussion that still feels useful and reread it before adding more saved items.",
      actionLabel: primaryTopic ? `Search ${primaryTopic}` : "View saved",
      actionHref: primaryTopic
        ? `/saved?search=${encodeURIComponent(primaryTopic)}`
        : "/saved",
    });

    steps.push({
      title: primaryLens
        ? `Deepen the ${primaryLens} thread`
        : "Add a Reality Lens to your reading",
      description: primaryLens
        ? `${primaryLens} appears in your saved library. Use it as the deeper human-reality theme behind what you are learning.`
        : "As more saved discussions include Reality Lenses, this path can show the human themes behind your reading.",
      actionLabel: primaryLens ? `Search ${primaryLens}` : "Browse discussions",
      actionHref: primaryLens
        ? `/saved?search=${encodeURIComponent(primaryLens)}`
        : "/discussions",
    });

    steps.push({
      title: primaryPurposeLane
        ? `Follow the ${primaryPurposeLane} direction`
        : "Add purpose direction to your saved path",
      description: primaryPurposeLane
        ? `${primaryPurposeLane} is showing up in your saved library. Use it as the direction behind what you revisit next.`
        : "As more saved discussions include Purpose Lanes, this path can show what kind of direction your saved library is forming around.",
      actionLabel: primaryPurposeLane ? `Search ${primaryPurposeLane}` : "Browse discussions",
      actionHref: primaryPurposeLane
        ? `/saved?search=${encodeURIComponent(primaryPurposeLane)}`
        : "/discussions",
    });

    steps.push({
      title: hasNotes
        ? "Revisit your private notes"
        : "Add notes to make saved items useful",
      description: hasNotes
        ? "Your private notes are becoming the personal layer of your saved library. Review them to find what still matters."
        : "Private notes turn saved discussions from a list into a working knowledge shelf.",
      actionLabel: hasNotes ? "Search notes" : "Review saved",
      actionHref: "/saved",
    });

    steps.push({
      title: primaryFolder
        ? `Organize around ${primaryFolder}`
        : "Create one focused folder",
      description: primaryFolder
        ? `${primaryFolder} is already acting like a learning lane. Keep related discussions grouped there.`
        : "A single focused folder can turn scattered saved discussions into a path you can return to.",
      actionLabel: primaryFolder ? `Open ${primaryFolder}` : "Organize saved",
      actionHref: "/saved",
    });

    if (hasRecentSaves) {
      steps.push({
        title: "Revisit recent saves next",
        description: "Recent saves show what currently has your attention. Revisit them before adding too many new items.",
        actionLabel: "View recent saved",
        actionHref: "/saved",
      });
    }

    return steps.slice(0, 5);
  }, [knowledgeSnapshot]);

  const activeSavedSearch = savedSearchQuery.trim();
  const hasActiveSavedSearch = activeSavedSearch.length > 0;
  const hasActiveSavedFilters =
    hasActiveSavedSearch || selectedCollectionId !== "all" || showSavedNotesOnly;

  function resetSavedFilters() {
    setSavedSearchQuery("");
    setSelectedCollectionId("all");
    setShowSavedNotesOnly(false);
    setActiveSavedTool("none");
  }

  function showAllSaved() {
    setSelectedCollectionId("all");
    setSavedSearchQuery("");
    setShowSavedNotesOnly(false);
    setActiveSavedTool("none");
  }

  function showUnfiledSaved() {
    setSelectedCollectionId("unfiled");
    setShowSavedNotesOnly(false);
    setActiveSavedTool("none");
  }

  function toggleSavedTool(tool: "search" | "folders" | "notes") {
    setActiveSavedInsight("none");

    setActiveSavedTool((current) => {
      const next = current === tool ? "none" : tool;

      if (tool === "notes") {
        setShowSavedNotesOnly(next === "notes");
        setSavedSearchQuery("");
      }

      if (tool !== "notes" && next !== "notes") {
        setShowSavedNotesOnly(false);
      }

      if (tool === "search" && next === "search") {
        window.setTimeout(() => {
          document.getElementById("saved-search")?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
          (document.getElementById("saved-search") as HTMLInputElement | null)?.focus();
        }, 0);
      }

      return next;
    });
  }

  function toggleSavedInsight(
    insight: "knowledge" | "purpose" | "learning" | "path"
  ) {
    setActiveSavedTool("none");
    setActiveSavedInsight((current) => current === insight ? "none" : insight);
  }

  const savedItemsWithNotesCount = saved.filter((item) =>
    (noteDrafts[item.id] ?? item.private_note ?? "").trim()
  ).length;

  const activeMobileSavedView =
    showSavedNotesOnly
      ? "Saved with notes"
      : hasActiveSavedSearch
        ? `Search: “${activeSavedSearch}”`
        : selectedCollectionId === "all"
          ? "All saved"
          : selectedCollectionLabel;

  async function createCollection(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!currentUserId || creatingCollection) {
      return;
    }

    if (!canUseCollections) {
      setMessage("Saved folders require Premium access.");
      return;
    }

    const cleanName = newCollectionName.trim();

    if (!cleanName) {
      setMessage("Enter a folder name.");
      return;
    }

    setCreatingCollection(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      setCreatingCollection(false);
      window.location.href = "/login";
      return;
    }

    const response = await fetch("/api/bookmarks/collections", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        name: cleanName,
      }),
    });

    const result = await response.json().catch(() => ({}));

    setCreatingCollection(false);

    if (!response.ok) {
      setMessage(result.error ?? "Unable to create folder.");
      return;
    }

    const created = result.collection as BookmarkCollection;
    setCollections((current) => [...current, created]);
    setSelectedCollectionId(created.id);
    setNewCollectionName("");
    setMessage("Saved folder created.");
  }

  async function moveBookmark(bookmarkId: string, collectionId: string) {
    setMessage("");

    if (!currentUserId || movingBookmarkId) {
      return;
    }

    if (!canUseCollections) {
      setMessage("Moving saved discussions into folders requires Premium access.");
      return;
    }

    const nextCollectionId = collectionId === "unfiled" ? null : collectionId;
    setMovingBookmarkId(bookmarkId);

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      setMovingBookmarkId(null);
      window.location.href = "/login";
      return;
    }

    const response = await fetch("/api/bookmarks/move", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        bookmarkId,
        collectionId: nextCollectionId,
      }),
    });

    const result = await response.json().catch(() => ({}));

    setMovingBookmarkId(null);

    if (!response.ok) {
      setMessage(result.error ?? "Unable to move saved discussion.");
      return;
    }

    setSaved((current) =>
      current.map((item) =>
        item.id === bookmarkId
          ? {
              ...item,
              collection_id: nextCollectionId,
            }
          : item
      )
    );

    setMessage(nextCollectionId ? "Saved discussion moved." : "Saved discussion moved to Unfiled.");
  }

  async function deleteCollection(collectionId: string) {
    setMessage("");

    if (!currentUserId || deletingCollectionId) {
      return;
    }

    if (!canUseCollections) {
      setMessage("Deleting saved folders requires Premium access.");
      return;
    }

    setDeletingCollectionId(collectionId);

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      setDeletingCollectionId(null);
      window.location.href = "/login";
      return;
    }

    const response = await fetch("/api/bookmarks/collections", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        collectionId,
      }),
    });

    const result = await response.json().catch(() => ({}));

    setDeletingCollectionId(null);

    if (!response.ok) {
      setMessage(result.error ?? "Unable to delete folder.");
      return;
    }

    setCollections((current) =>
      current.filter((collection) => collection.id !== collectionId)
    );

    setSaved((current) =>
      current.map((item) =>
        item.collection_id === collectionId
          ? {
              ...item,
              collection_id: null,
            }
          : item
      )
    );

    if (selectedCollectionId === collectionId) {
      setSelectedCollectionId("all");
    }

    setMessage("Saved folder deleted. Its saved discussions were moved to Unfiled.");
  }

  async function savePrivateNote(bookmarkId: string) {
    setMessage("");

    if (!currentUserId || savingNoteId) {
      return;
    }

    if (!canUsePrivateNotes) {
      setMessage("Private notes require Premium Plus access.");
      return;
    }

    const cleanNote = (noteDrafts[bookmarkId] ?? "").trim();
    setSavingNoteId(bookmarkId);

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      setSavingNoteId(null);
      window.location.href = "/login";
      return;
    }

    const response = await fetch("/api/bookmarks/note", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        bookmarkId,
        note: cleanNote,
      }),
    });

    const result = await response.json().catch(() => ({}));

    setSavingNoteId(null);

    if (!response.ok) {
      setMessage(result.error ?? "Unable to save private note.");
      return;
    }

    const updatedNote = result.bookmark?.private_note ?? null;
    const updatedAt = result.bookmark?.private_note_updated_at ?? null;

    setSaved((current) =>
      current.map((item) =>
        item.id === bookmarkId
          ? {
              ...item,
              private_note: updatedNote,
              private_note_updated_at: updatedAt,
            }
          : item
      )
    );

    setNoteDrafts((current) => ({
      ...current,
      [bookmarkId]: updatedNote ?? "",
    }));

    setMessage(updatedNote ? "Private note saved." : "Private note cleared.");
  }

  function exportSavedDiscussions(format: ExportFormat) {
    setMessage("");

    if (!canExportSavedNotes) {
      setMessage("Exporting saved discussions and notes requires Premium Plus access.");
      return;
    }

    const exportItems = saved
      .map((item) => {
        const discussion = item.discussions;

        if (!discussion) {
          return null;
        }

        return {
          bookmark_id: item.id,
          discussion_id: discussion.id,
          title: discussion.title,
          topic: discussion.topic,
          reality_lens: discussion.reality_lens,
          purpose_lane: discussion.purpose_lane,
          body: discussion.body,
          discussion_created_at: discussion.created_at,
          saved_at: item.created_at,
          collection:
            item.collection_id
              ? collectionNameById[item.collection_id] ?? "Unknown folder"
              : "Unfiled",
          private_note: noteDrafts[item.id]?.trim() || item.private_note || "",
          private_note_updated_at: item.private_note_updated_at,
          url:
            typeof window !== "undefined"
              ? `${window.location.origin}/discussions/${discussion.id}`
              : `/discussions/${discussion.id}`,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    if (exportItems.length === 0) {
      setMessage("There are no saved discussions to export.");
      return;
    }

    setExportingFormat(format);

    try {
      const timestamp = getSafeExportDate();

      if (format === "json") {
        downloadTextFile(
          `loombus-saved-discussions-${timestamp}.json`,
          JSON.stringify(
            {
              exported_at: new Date().toISOString(),
              item_count: exportItems.length,
              items: exportItems,
            },
            null,
            2
          ),
          "application/json;charset=utf-8"
        );

        setMessage("Saved discussions exported as JSON.");
        return;
      }

      const markdown = [
        "# Loombus Saved Discussions",
        "",
        `Exported: ${new Date().toLocaleString()}`,
        `Items: ${exportItems.length}`,
        "",
        ...exportItems.flatMap((item, index) => [
          `## ${index + 1}. ${item.title}`,
          "",
          `- Topic: ${item.topic}`,
          `- Reality Lens: ${item.reality_lens ?? "None"}`,
          `- Purpose Lane: ${item.purpose_lane ?? "None"}`,
          `- Folder: ${item.collection}`,
          `- Saved: ${new Date(item.saved_at).toLocaleString()}`,
          `- Discussion created: ${new Date(item.discussion_created_at).toLocaleString()}`,
          `- URL: ${item.url}`,
          "",
          "### Discussion",
          "",
          item.body,
          "",
          "### Private note",
          "",
          item.private_note || "_No private note._",
          "",
          "---",
          "",
        ]),
      ].join("\n");

      downloadTextFile(
        `loombus-saved-discussions-${timestamp}.md`,
        markdown,
        "text/markdown;charset=utf-8"
      );

      setMessage("Saved discussions exported as Markdown.");
    } finally {
      setExportingFormat(null);
    }
  }

  async function removeBookmark(bookmarkId: string) {
    setMessage("");

    if (!currentUserId || removingBookmarkId) {
      return;
    }

    setRemovingBookmarkId(bookmarkId);

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      setRemovingBookmarkId(null);
      window.location.href = "/login";
      return;
    }

    const response = await fetch("/api/bookmarks", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        bookmarkId,
      }),
    });

    const result = await response.json().catch(() => ({}));

    setRemovingBookmarkId(null);

    if (!response.ok) {
      setMessage(result.error ?? "Unable to remove saved discussion.");
      return;
    }

    setSaved((current) =>
      current.filter((item) => item.id !== bookmarkId)
    );

    setMessage("Saved discussion removed.");
  }

  return (
    <main className="min-h-screen bg-black px-4 pb-24 pt-4 text-white sm:px-6 sm:py-10 lg:py-12 loombus-shell-with-right-rail">
      <div className="mx-auto max-w-[58rem]">
        <div className="saved-shell-grid">
          <div className="min-w-0">
        <div className="mb-5 flex flex-col gap-3 sm:mb-10 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="mb-2 text-2xl font-semibold tracking-tight sm:mb-3 sm:text-4xl md:text-5xl">
              Saved discussions
            </h1>

            <p className="text-sm leading-relaxed text-zinc-500 sm:text-base">
              Discussions you saved for later reflection.
            </p>
          </div>

          {!isAdmin && (
            <Link
              href="/premium"
              className="hidden w-full rounded-full border border-zinc-800 px-5 py-3 text-center text-sm text-zinc-400 transition hover:border-zinc-600 hover:text-white sm:w-fit md:inline-block"
            >
              Premium folders
            </Link>
          )}
        </div>

        {!loading && (
          <section className="mb-4 xl:hidden">
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="Saved tools rail">
              <button
                type="button"
                onClick={showAllSaved}
                className={`shrink-0 rounded-full px-4 py-2.5 text-base transition ${
                  selectedCollectionId === "all" &&
                  activeSavedTool !== "search" &&
                  !hasActiveSavedSearch &&
                  !showSavedNotesOnly
                    ? "bg-white text-black"
                    : "border border-zinc-800 bg-black/40 text-zinc-400 hover:border-zinc-600 hover:text-white"
                }`}
              >
                All
              </button>

              <button
                type="button"
                onClick={() => toggleSavedTool("search")}
                className={`shrink-0 rounded-full px-4 py-2.5 text-base transition ${
                  hasActiveSavedSearch
                    ? "bg-white text-black"
                    : "border border-zinc-800 bg-black/40 text-zinc-400 hover:border-zinc-600 hover:text-white"
                }`}
              >
                Search
              </button>

              <button
                type="button"
                onClick={showUnfiledSaved}
                className={`shrink-0 rounded-full px-4 py-2.5 text-base transition ${
                  selectedCollectionId === "unfiled"
                    ? "bg-white text-black"
                    : "border border-zinc-800 bg-black/40 text-zinc-400 hover:border-zinc-600 hover:text-white"
                }`}
              >
                Unfiled
              </button>

              <button
                type="button"
                onClick={() => toggleSavedTool("folders")}
                disabled={!canUseCollections || collections.length === 0}
                className="shrink-0 rounded-full border border-zinc-800 bg-black/40 px-4 py-2.5 text-base text-zinc-400 transition hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
              >
                Folders
              </button>

              <button
                type="button"
                onClick={() => toggleSavedTool("notes")}
                disabled={!canUsePrivateNotes || savedItemsWithNotesCount === 0}
                className={`shrink-0 rounded-full px-4 py-2.5 text-base transition ${
                  showSavedNotesOnly
                    ? "bg-white text-black"
                    : "border border-zinc-800 bg-black/40 text-zinc-400 hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                }`}
              >
                Notes
              </button>

              <Link
                href="/discussions"
                className="shrink-0 rounded-full border border-zinc-800 bg-black/40 px-4 py-2.5 text-base text-zinc-400 transition hover:border-zinc-600 hover:text-white"
              >
                Add more
              </Link>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-zinc-900 bg-black px-3 py-1.5 text-xs text-zinc-600">
                {activeMobileSavedView}
              </span>

              <span className="rounded-full border border-zinc-900 bg-black px-3 py-1.5 text-xs text-zinc-600">
                {filteredSaved.length} of {saved.length} saved
              </span>

              {hasActiveSavedFilters && (
                <button
                  type="button"
                  onClick={resetSavedFilters}
                  className="rounded-full border border-zinc-800 px-3 py-1.5 text-xs text-zinc-500 transition hover:border-zinc-600 hover:text-white"
                >
                  Reset
                </button>
              )}
            </div>
          </section>
        )}

        {!loading && saved.length > 0 && (
          <section className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl shadow-black/20 xl:hidden" aria-label="Saved Cards shell">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.22em] text-zinc-600">
                  Saved cards
                </p>

                <h2 className="text-xl font-semibold tracking-tight">
                  Your saved discussions.
                </h2>

                <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                  Use the rails to filter, search, organize, or open private snapshots without pushing your saved cards too far down.
                </p>
              </div>

              <span className="shrink-0 rounded-full border border-zinc-800 px-3 py-1.5 text-xs text-zinc-500">
                {filteredSaved.length}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-zinc-900 bg-black px-3 py-1.5 text-xs text-zinc-600">
                {activeMobileSavedView}
              </span>

              <span className="rounded-full border border-zinc-900 bg-black px-3 py-1.5 text-xs text-zinc-600">
                {saved.length} total
              </span>

              {savedItemsWithNotesCount > 0 && (
                <span className="rounded-full border border-zinc-900 bg-black px-3 py-1.5 text-xs text-zinc-600">
                  {savedItemsWithNotesCount} notes
                </span>
              )}
            </div>
          </section>
        )}

        {!loading && saved.length > 0 && (
          <section className="mb-4 xl:hidden">
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="Saved insight tools rail">
              <button
                type="button"
                onClick={() => toggleSavedInsight("knowledge")}
                className={`shrink-0 rounded-full px-4 py-2.5 text-base transition ${
                  activeSavedInsight === "knowledge"
                    ? "bg-white text-black"
                    : "border border-zinc-800 bg-black/40 text-zinc-400 hover:border-zinc-600 hover:text-white"
                }`}
              >
                Knowledge
              </button>

              <button
                type="button"
                onClick={() => toggleSavedInsight("purpose")}
                className={`shrink-0 rounded-full px-4 py-2.5 text-base transition ${
                  activeSavedInsight === "purpose"
                    ? "bg-white text-black"
                    : "border border-zinc-800 bg-black/40 text-zinc-400 hover:border-zinc-600 hover:text-white"
                }`}
              >
                Purpose
              </button>

              <button
                type="button"
                onClick={() => toggleSavedInsight("learning")}
                className={`shrink-0 rounded-full px-4 py-2.5 text-base transition ${
                  activeSavedInsight === "learning"
                    ? "bg-white text-black"
                    : "border border-zinc-800 bg-black/40 text-zinc-400 hover:border-zinc-600 hover:text-white"
                }`}
              >
                Learning
              </button>

              <button
                type="button"
                onClick={() => toggleSavedInsight("path")}
                className={`shrink-0 rounded-full px-4 py-2.5 text-base transition ${
                  activeSavedInsight === "path"
                    ? "bg-white text-black"
                    : "border border-zinc-800 bg-black/40 text-zinc-400 hover:border-zinc-600 hover:text-white"
                }`}
              >
                Purpose Path
              </button>
            </div>
          </section>
        )}

        <section className="mb-6 hidden rounded-2xl border border-zinc-800 bg-zinc-950 p-6 md:block">
          <p className="mb-2 text-sm uppercase tracking-[0.25em] text-zinc-500">
            Saved discussions guide
          </p>

          <h2 className="mb-4 text-2xl font-medium">
            Save what is worth returning to.
          </h2>

          <p className="mb-5 max-w-3xl text-sm leading-relaxed text-zinc-500">
            Saved discussions should become your personal reading shelf. Use it
            for threads you want to revisit, compare, cite, or organize into
            future ideas.
          </p>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-zinc-900 bg-black p-4">
              <p className="mb-2 text-sm font-medium text-zinc-300">
                Save for a reason
              </p>

              <p className="text-sm leading-relaxed text-zinc-600">
                Save discussions with useful framing, strong replies, research value, or ideas you may build on later.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-900 bg-black p-4">
              <p className="mb-2 text-sm font-medium text-zinc-300">
                Revisit your thinking
              </p>

              <p className="text-sm leading-relaxed text-zinc-600">
                Return to saved threads when you want to reply better, compare viewpoints, or continue learning.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-900 bg-black p-4">
              <p className="mb-2 text-sm font-medium text-zinc-300">
                Organize when needed
              </p>

              <p className="text-sm leading-relaxed text-zinc-600">
                {isAdmin
                  ? "Saved-library tools are available for this account."
                  : "Premium folders and Premium Plus notes help when your saved list becomes a working library."}
              </p>
            </div>
          </div>
        </section>

        {!loading && !canUseCollections && (
          <div className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:mb-8 sm:rounded-3xl sm:p-6">
            <h2 className="mb-2 text-xl font-medium sm:text-2xl">
              Saved folders are a Premium feature.
            </h2>

            <p className="max-w-3xl text-sm leading-relaxed text-zinc-500 sm:text-base">
              You can still save and remove discussions on the Free plan. Premium and
              Premium accounts can organize saved discussions into folders.
            </p>
          </div>
        )}

        {!loading && canUseCollections && !canUsePrivateNotes && (
          <div className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:mb-8 sm:rounded-3xl sm:p-6">
            <h2 className="mb-2 text-xl font-medium sm:text-2xl">
              Private notes are a Premium Plus feature.
            </h2>

            <p className="max-w-3xl text-sm leading-relaxed text-zinc-500 sm:text-base">
              Your saved folders are available. Upgrade to Premium Plus to add private notes and export saved discussions.
            </p>
          </div>
        )}

        {!loading && saved.length > 0 && (
          <section className={`mb-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:mb-8 sm:rounded-3xl sm:p-6 ${activeSavedInsight === "knowledge" ? "block" : "hidden"} md:block`}>
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="mb-2 text-sm uppercase tracking-[0.25em] text-zinc-500">
                  Saved knowledge snapshot
                </p>

                <h2 className="text-xl font-medium sm:text-2xl">
                  What your saved discussions are becoming.
                </h2>

                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-500">
                  This is a private, on-page snapshot based only on your saved discussions, folders, and private notes.
                </p>
              </div>

              <span className="w-fit rounded-full border border-zinc-800 px-3 py-1.5 text-xs text-zinc-500">
                {saved.length} saved
              </span>
            </div>

            <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-zinc-900 bg-black p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-600">
                  Saved recently
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {knowledgeSnapshot.recentSavedCount}
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-900 bg-black p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-600">
                  Private notes
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {knowledgeSnapshot.notesCount}
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-900 bg-black p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-600">
                  Topic signals
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {knowledgeSnapshot.topics.length}
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-900 bg-black p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-600">
                  Reality signals
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {knowledgeSnapshot.lenses.length}
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-900 bg-black p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-600">
                  Purpose signals
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {knowledgeSnapshot.purposeSignals.length}
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <KnowledgeSignalGroup
                title="Saved topics"
                empty="No topic signals yet."
                signals={knowledgeSnapshot.topics}
              />

              <KnowledgeSignalGroup
                title="Reality Lenses"
                empty="No Reality Lens signals yet."
                signals={knowledgeSnapshot.lenses}
              />

              <KnowledgeSignalGroup
                title="Purpose Lanes"
                empty="No Purpose Lane signals yet."
                signals={knowledgeSnapshot.purposeSignals}
              />

              <KnowledgeSignalGroup
                title="Folders"
                empty="No folder signals yet."
                signals={knowledgeSnapshot.folders}
              />
            </div>
          </section>
        )}

        {!loading && saved.length > 0 && (
          <section className={`mb-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:mb-8 sm:rounded-3xl sm:p-6 ${activeSavedInsight === "purpose" ? "block" : "hidden"} md:block`}>
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="mb-2 text-sm uppercase tracking-[0.25em] text-zinc-500">
                  Purpose snapshot
                </p>

                <h2 className="text-xl font-medium sm:text-2xl">
                  What direction your saved library is forming.
                </h2>

                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-500">
                  This private snapshot uses saved Purpose Lanes only. It is not therapy, diagnosis, life coaching, scoring, or ranking.
                </p>
              </div>

              <span className="w-fit rounded-full border border-zinc-800 px-3 py-1.5 text-xs text-zinc-500">
                Private
              </span>
            </div>

            {knowledgeSnapshot.purposeSignals.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {knowledgeSnapshot.purposeSignals.map((signal) => (
                  <Link
                    key={signal.label}
                    href={`/saved?search=${encodeURIComponent(signal.label)}`}
                    className="rounded-2xl border border-zinc-900 bg-black p-4 transition hover:border-zinc-700"
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <h3 className="text-base font-medium text-zinc-200">
                        {signal.label}
                      </h3>

                      <span className="rounded-full border border-zinc-800 px-2.5 py-1 text-xs text-zinc-500">
                        {signal.count} saved
                      </span>
                    </div>

                    <p className="text-sm leading-relaxed text-zinc-600">
                      Revisit saved discussions in this lane to see what learning, contribution, mastery, or community direction is emerging.
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="rounded-2xl border border-zinc-900 bg-black p-4 text-sm text-zinc-600">
                Save discussions with Purpose Lanes to build a private purpose snapshot.
              </p>
            )}
          </section>
        )}

        {!loading && saved.length > 0 && (
          <section className={`mb-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:mb-8 sm:rounded-3xl sm:p-6 ${activeSavedInsight === "learning" || activeSavedInsight === "path" ? "block" : "hidden"} md:block`}>
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="mb-2 text-sm uppercase tracking-[0.25em] text-zinc-500">
                  Learning path snapshot
                </p>

                <h2 className="text-xl font-medium sm:text-2xl">
                  What to read, revisit, and organize next.
                </h2>

                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-500">
                  This path is generated on-page from your saved topics, Reality Lenses, folders, and notes. It is private to your saved library.
                </p>
              </div>
            </div>

            <div className={`grid gap-4 md:grid md:grid-cols-2 xl:grid-cols-5 ${activeSavedInsight === "path" ? "hidden" : "grid"}`}>
              {learningPath.map((step, index) => (
                <LearningPathCard
                  key={`${step.title}-${index}`}
                  step={step}
                  index={index}
                />
              ))}
            </div>

            <div className={`mt-5 rounded-2xl border border-zinc-900 bg-black/40 p-4 sm:p-5 ${activeSavedInsight === "learning" ? "hidden" : "block"} md:block`}>
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="mb-2 text-xs uppercase tracking-[0.22em] text-zinc-600">
                    Purpose-aware path
                  </p>

                  <h3 className="text-lg font-medium text-zinc-200">
                    Connect what you save to what you may learn, build, or contribute.
                  </h3>
                </div>

                <span className="w-fit rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-500">
                  Private
                </span>
              </div>

              <p className="mb-4 max-w-3xl text-sm leading-relaxed text-zinc-600">
                This stays private and uses saved topics, Purpose Lanes, and notes. It does not diagnose, coach, score, or rank you.
              </p>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {purposePathCards.map((step, index) => (
                  <LearningPathCard
                    key={`${step.title}-${index}`}
                    step={step}
                    index={index}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        {canExportSavedNotes && (
          <section className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:mb-8 sm:rounded-3xl sm:p-6">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="mb-2 text-sm uppercase tracking-wide text-zinc-500">
                  "Premium Plus export"
                </p>

                <h2 className="text-xl font-medium sm:text-2xl">
                  Export saved discussions and notes
                </h2>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  onClick={() => exportSavedDiscussions("markdown")}
                  disabled={Boolean(exportingFormat)}
                  className="w-full rounded-full border border-zinc-700 px-5 py-3 text-center text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700 sm:w-fit"
                >
                  {exportingFormat === "markdown" ? "Exporting..." : "Export Markdown"}
                </button>

                <button
                  type="button"
                  onClick={() => exportSavedDiscussions("json")}
                  disabled={Boolean(exportingFormat)}
                  className="w-full rounded-full border border-zinc-800 px-5 py-3 text-center text-sm text-zinc-400 transition hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700 sm:w-fit"
                >
                  {exportingFormat === "json" ? "Exporting..." : "Export JSON"}
                </button>
              </div>
            </div>

            <p className="max-w-3xl text-sm leading-relaxed text-zinc-500">
              Export includes saved discussion text, folder names, saved dates,
              links, and your private notes.
            </p>
          </section>
        )}

        {canUseCollections && (
          <form
            onSubmit={createCollection}
            className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:mb-8 sm:rounded-3xl sm:p-6"
          >
            <h2 className="mb-2 text-xl font-medium sm:text-2xl">
              Create saved folder
            </h2>

            <p className="mb-4 hidden max-w-2xl leading-relaxed text-zinc-500 sm:block">
              Use folders to group high-signal discussions by research area,
              project, topic, or reading priority.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={newCollectionName}
                onChange={(event) => setNewCollectionName(event.target.value)}
                placeholder="Folder name, for example AI strategy"
                maxLength={60}
                className="min-w-0 flex-1 rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-base text-white outline-none transition placeholder:text-zinc-600 focus:border-zinc-600 sm:px-5"
              />

              <button
                type="submit"
                disabled={creatingCollection}
                className="w-full rounded-full border border-zinc-700 px-5 py-3 text-center text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700 sm:w-fit"
              >
                {creatingCollection ? "Creating..." : "Create folder"}
              </button>
            </div>
          </form>
        )}

        {message && (
          <p className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
            {message}
          </p>
        )}

        <section className={`mb-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-3 sm:mb-8 sm:rounded-3xl sm:p-5 ${activeSavedTool === "search" ? "block" : "hidden"} md:block`}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex-1">
              <label htmlFor="saved-search" className="mb-2 block text-sm font-medium text-zinc-300">
                Search saved discussions
              </label>

              <input
                id="saved-search"
                type="text"
                value={savedSearchQuery}
                onChange={(event) => setSavedSearchQuery(event.target.value)}
                placeholder="Search saved titles, topics, bodies, or private notes..."
                className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-base text-white outline-none transition placeholder:text-zinc-600 focus:border-zinc-600 sm:px-5 sm:py-4"
              />
            </div>

            {hasActiveSavedFilters && (
              <button
                type="button"
                onClick={resetSavedFilters}
                className="w-fit rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Clear search and filters
              </button>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {selectedCollectionId !== "all" && (
              <span className="rounded-full border border-zinc-800 bg-black px-3 py-1.5 text-xs font-medium text-zinc-400">
                Folder: {selectedCollectionLabel}
              </span>
            )}

            {hasActiveSavedSearch && (
              <span className="rounded-full border border-zinc-800 bg-black px-3 py-1.5 text-xs font-medium text-zinc-400">
                Search: “{activeSavedSearch}”
              </span>
            )}

            {!hasActiveSavedFilters && (
              <p className="hidden text-sm text-zinc-600 sm:block">
                Search scans saved discussion titles, topics, bodies, and private notes when available.
              </p>
            )}
          </div>

          {!loading && (
            <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="text-xs text-zinc-600 sm:text-sm">
                Showing {filteredSaved.length} of {saved.length} saved discussions
              </p>

              {hasActiveSavedFilters && (
                <button
                  type="button"
                  onClick={resetSavedFilters}
                  className="w-fit text-sm text-zinc-500 underline decoration-zinc-800 underline-offset-4 transition hover:text-white hover:decoration-white"
                >
                  Reset view
                </button>
              )}
            </div>
          )}
        </section>

        <div className={`mb-6 gap-2 overflow-x-auto pb-2 sm:mb-8 sm:flex-wrap sm:gap-3 sm:overflow-visible sm:pb-0 ${activeSavedTool === "folders" ? "flex" : "hidden"} md:flex`}>
          <button
            type="button"
            onClick={() => setSelectedCollectionId("all")}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm transition ${
              selectedCollectionId === "all"
                ? "border-zinc-400 text-white"
                : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-white"
            }`}
          >
            All saved ({collectionCounts.all ?? 0})
          </button>

          <button
            type="button"
            onClick={() => setSelectedCollectionId("unfiled")}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm transition ${
              selectedCollectionId === "unfiled"
                ? "border-zinc-400 text-white"
                : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-white"
            }`}
          >
            Unfiled ({collectionCounts.unfiled ?? 0})
          </button>

          {collections.map((collection) => (
            <div key={collection.id} className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedCollectionId(collection.id)}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm transition ${
                  selectedCollectionId === collection.id
                    ? "border-zinc-400 text-white"
                    : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-white"
                }`}
              >
                {collection.name} ({collectionCounts[collection.id] ?? 0})
              </button>

              {canUseCollections && (
                <button
                  type="button"
                  onClick={() => deleteCollection(collection.id)}
                  disabled={deletingCollectionId === collection.id}
                  className="rounded-full border border-zinc-900 px-3 py-2 text-xs text-zinc-600 transition hover:border-zinc-700 hover:text-zinc-300 disabled:cursor-not-allowed disabled:text-zinc-800"
                >
                  {deletingCollectionId === collection.id ? "Deleting..." : "Delete"}
                </button>
              )}
            </div>
          ))}
        </div>

        {loading && (
          <p className="text-sm leading-relaxed text-zinc-500 sm:text-base">
            Loading saved discussions...
          </p>
        )}

        {!loading && saved.length === 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black/30 sm:rounded-3xl sm:p-8">
            <h2 className="mb-3 text-xl font-medium sm:text-2xl">
              Nothing saved yet.
            </h2>

            <p className="mb-6 max-w-3xl text-zinc-400">
              Save discussions that are worth revisiting, comparing, citing, or
              building on later. Your saved list becomes more useful when it is
              intentional.
            </p>

            <div className="mb-5 hidden gap-3 md:grid md:grid-cols-3">
              <div className="rounded-2xl border border-zinc-900 bg-black p-4">
                <p className="mb-2 text-sm font-medium text-zinc-300">
                  Start with signal
                </p>

                <p className="text-sm leading-relaxed text-zinc-600">
                  Save threads with strong framing, useful replies, or ideas worth returning to.
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-900 bg-black p-4">
                <p className="mb-2 text-sm font-medium text-zinc-300">
                  Build a library
                </p>

                <p className="text-sm leading-relaxed text-zinc-600">
                  Treat saved discussions as a working shelf for research, planning, and future replies.
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-900 bg-black p-4">
                <p className="mb-2 text-sm font-medium text-zinc-300">
                  Revisit often
                </p>

                <p className="text-sm leading-relaxed text-zinc-600">
                  Return to saved threads when you want to compare viewpoints or continue thinking.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href="/discussions"
                className="inline-flex rounded-full bg-white px-5 py-3 text-sm text-black transition hover:bg-zinc-200"
              >
                Browse discussions to save
              </Link>

              <Link
                href="/following"
                className="inline-flex rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Open following feed
              </Link>

              <Link
                href="/people"
                className="inline-flex rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Find people
              </Link>

              <Link
                href="/onboarding"
                className="inline-flex rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Open setup guide
              </Link>
            </div>
          </div>
        )}

        {!loading && saved.length > 0 && filteredSaved.length === 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black/30 sm:rounded-3xl sm:p-8">
            <h2 className="mb-3 text-xl font-medium sm:text-2xl">
              No saved discussions found.
            </h2>

            <p className="mb-6 max-w-3xl text-zinc-400">
              No saved discussions match the current folder or search. Try clearing the filters,
              using a broader search term, or browsing more discussions to save.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={resetSavedFilters}
                className="inline-flex rounded-full bg-white px-5 py-3 text-sm text-black transition hover:bg-zinc-200"
              >
                Clear search and filters
              </button>

              <button
                type="button"
                onClick={() => setSelectedCollectionId("all")}
                className="inline-flex rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Show all saved
              </button>

              <Link
                href="/discussions"
                className="inline-flex rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Browse more discussions
              </Link>
            </div>
          </div>
        )}

        <div className="space-y-3 sm:space-y-5">
          {filteredSaved.map((item) => {
            const discussion = item.discussions;

            if (!discussion) {
              return null;
            }

            return (
              <article
                key={item.id}
                className="group rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl shadow-black/20 transition hover:border-zinc-700 sm:rounded-[1.5rem] sm:p-5"
              >
                <Link
                  href={`/discussions/${discussion.id}`}
                  className="block"
                >
                  <div className="mb-3 flex flex-nowrap gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
                    <span className="shrink-0 rounded-full border border-zinc-800 bg-black px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500 sm:px-3 sm:text-[11px] sm:tracking-[0.18em]">
                      {discussion.topic}
                    </span>

                    {discussion.reality_lens && (
                      <span className="shrink-0 rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[10px] font-medium text-zinc-400 sm:px-3 sm:text-[11px]">
                        {discussion.reality_lens}
                      </span>
                    )}

                    {discussion.purpose_lane && (
                      <span className="shrink-0 rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[10px] font-medium text-zinc-400 sm:px-3 sm:text-[11px]">
                        {discussion.purpose_lane}
                      </span>
                    )}
                  </div>

                  <h2 className="mb-2 text-lg font-semibold leading-snug tracking-tight transition group-hover:text-white sm:text-2xl">
                    {discussion.title}
                  </h2>

                  <p className="mb-3 line-clamp-2 text-sm leading-relaxed text-zinc-400 sm:text-base">
                    {discussion.body}
                  </p>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-zinc-900 pt-4 text-xs text-zinc-500 sm:text-sm">
                    <span>
                      Saved {new Date(item.created_at).toLocaleDateString()}
                    </span>

                    <span>
                      {item.collection_id
                        ? collectionNameById[item.collection_id] ?? "Folder"
                        : "Unfiled"}
                    </span>

                    <span className="ml-auto hidden text-zinc-400 sm:inline">
                      Open discussion →
                    </span>
                  </div>
                </Link>

                {canUsePrivateNotes && (
                  <div className="mt-4 rounded-2xl border border-zinc-900 bg-black/30 p-3 sm:p-4">
                    <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <label className="text-sm font-medium text-zinc-300">
                        Private note
                      </label>

                      {item.private_note_updated_at && (
                        <p className="text-xs text-zinc-600">
                          Updated {new Date(item.private_note_updated_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>

                    <textarea
                      value={noteDrafts[item.id] ?? ""}
                      onChange={(event) =>
                        setNoteDrafts((current) => ({
                          ...current,
                          [item.id]: event.target.value,
                        }))
                      }
                      maxLength={1000}
                      rows={2}
                      placeholder="Why did you save this?"
                      className="mb-3 w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-300 outline-none transition placeholder:text-zinc-700 focus:border-zinc-600 sm:text-base"
                    />

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-zinc-600">
                        {(noteDrafts[item.id] ?? "").length}/1000 characters
                      </p>

                      <button
                        type="button"
                        onClick={() => savePrivateNote(item.id)}
                        disabled={savingNoteId === item.id}
                        className="w-fit rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-400 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                      >
                        {savingNoteId === item.id ? "Saving..." : "Save note"}
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex flex-col gap-3 border-t border-zinc-900 pt-4 md:flex-row md:items-center md:justify-between">
                  <p className="text-xs text-zinc-600 sm:text-sm">
                    Saved library actions
                  </p>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <select
                      value={item.collection_id ?? "unfiled"}
                      onChange={(event) => moveBookmark(item.id, event.target.value)}
                      disabled={!canUseCollections || movingBookmarkId === item.id}
                      className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-base text-zinc-300 outline-none transition focus:border-zinc-600 disabled:cursor-not-allowed disabled:text-zinc-700 sm:w-auto sm:py-2 sm:text-sm"
                    >
                      <option value="unfiled">Unfiled</option>
                      {collections.map((collection) => (
                        <option key={collection.id} value={collection.id}>
                          {collection.name}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => removeBookmark(item.id)}
                      disabled={removingBookmarkId === item.id}
                      className="rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-500 transition hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                    >
                      {removingBookmarkId === item.id ? "Removing..." : "Remove"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
          </div>

          <aside className="loombus-right-rail fixed inset-y-0 right-0 z-30 hidden overflow-y-auto border-l border-zinc-900 bg-black/95 px-4 py-6 backdrop-blur-xl xl:block">
            <div className="space-y-4">
              <section className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/20">
                <div className="border-b border-zinc-900 p-5">
                  <p className="mb-2 text-xs uppercase tracking-[0.25em] text-zinc-600">
                    Saved Library Panel
                  </p>

                  <h2 className="text-xl font-semibold tracking-tight">
                    Save with intent.
                  </h2>

                  <p className="mt-3 text-sm leading-relaxed text-zinc-500">
                    Your saved library should become a working shelf for threads worth revisiting, comparing, citing, or building on later.
                  </p>
                </div>

                <div className="grid grid-cols-2 border-b border-zinc-900">
                  <div className="border-r border-zinc-900 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-700">
                      Showing
                    </p>
                    <p className="mt-2 text-lg font-semibold text-zinc-200">
                      {filteredSaved.length}
                    </p>
                  </div>

                  <div className="p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-700">
                      Saved
                    </p>
                    <p className="mt-2 text-lg font-semibold text-zinc-200">
                      {saved.length}
                    </p>
                  </div>
                </div>

                <div className="p-5">
                  <Link
                    href="/discussions"
                    className="inline-flex w-full justify-center rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200"
                  >
                    Browse discussions
                  </Link>
                </div>
              </section>

              <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black/20">
                <p className="mb-3 text-xs uppercase tracking-[0.22em] text-zinc-600">
                  Current library view
                </p>

                <div className="space-y-2">
                  <div className="rounded-2xl border border-zinc-900 bg-black p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-700">
                      Folder
                    </p>
                    <p className="mt-1 text-sm text-zinc-300">
                      {selectedCollectionLabel}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-zinc-900 bg-black p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-700">
                      Search
                    </p>
                    <p className="mt-1 text-sm text-zinc-300">
                      {hasActiveSavedSearch ? `“${activeSavedSearch}”` : "None"}
                    </p>
                  </div>
                </div>

                {hasActiveSavedFilters && (
                  <button
                    type="button"
                    onClick={resetSavedFilters}
                    className="mt-4 w-full rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-500 transition hover:border-zinc-600 hover:text-white"
                  >
                    Reset library
                  </button>
                )}
              </section>

              <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black/20">
                <p className="mb-3 text-xs uppercase tracking-[0.22em] text-zinc-600">
                  Library tools
                </p>

                <div className="space-y-2">
                  <div className="rounded-2xl border border-zinc-900 bg-black p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-700">
                      Folders
                    </p>
                    <p className="mt-1 text-sm text-zinc-300">
                      {canUseCollections ? `${collections.length} folders` : "Premium"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-zinc-900 bg-black p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-700">
                      Notes
                    </p>
                    <p className="mt-1 text-sm text-zinc-300">
                      {canUsePrivateNotes ? `${knowledgeSnapshot.notesCount} notes` : "Premium Plus"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-zinc-900 bg-black p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-700">
                      Export
                    </p>
                    <p className="mt-1 text-sm text-zinc-300">
                      {canExportSavedNotes ? "Available" : "Premium Plus"}
                    </p>
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black/20">
                <p className="mb-3 text-xs uppercase tracking-[0.22em] text-zinc-600">
                  Save standard
                </p>

                <div className="space-y-3 text-sm leading-relaxed text-zinc-500">
                  <p className="rounded-2xl border border-zinc-900 bg-black p-3">
                    Save threads with framing you may need again.
                  </p>

                  <p className="rounded-2xl border border-zinc-900 bg-black p-3">
                    Revisit before saving too many more.
                  </p>

                  <p className="rounded-2xl border border-zinc-900 bg-black p-3">
                    Use notes when a saved thread connects to future work.
                  </p>
                </div>

                <Link
                  href="/search"
                  className="mt-4 inline-flex w-full justify-center rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-400 transition hover:border-zinc-600 hover:text-white"
                >
                  Search Loombus
                </Link>
              </section>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
