"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

const ACTIONS_ATTR = "data-loombus-room-actions";
const SAVED_KEY = "loombus:room:saved-posts";
const MUTED_KEY = "loombus:room:muted-posts";

type RoomPostActionRow = {
  id: string;
  title: string | null;
  body: string | null;
  author_id: string | null;
};

type RoomActionContext = {
  roomId: string;
  userId: string | null;
  ownerId: string | null;
  createdBy: string | null;
  posts: RoomPostActionRow[];
};

function closeOtherMenus(currentMenu: HTMLElement) {
  document.querySelectorAll<HTMLElement>(`[${ACTIONS_ATTR}] [data-room-card-menu]`).forEach((menu) => {
    if (menu !== currentMenu) menu.hidden = true;
  });
}

function getRoomIdFromPath() {
  const match = window.location.pathname.match(/\/rooms\/([^/]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : "";
}

function readList(key: string) {
  try {
    return JSON.parse(window.localStorage.getItem(key) || "[]") as string[];
  } catch {
    return [];
  }
}

function writeList(key: string, values: string[]) {
  window.localStorage.setItem(key, JSON.stringify(Array.from(new Set(values))));
}

function addAction(menu: HTMLElement, label: string, tone: "default" | "danger", onClick: () => void) {
  const item = document.createElement("button");
  item.type = "button";
  item.className = tone === "danger"
    ? "block w-full rounded-xl px-3 py-2 text-left text-sm font-black text-rose-700 hover:bg-rose-50"
    : "block w-full rounded-xl px-3 py-2 text-left text-sm font-black text-slate-700 hover:bg-slate-50";
  item.textContent = label;
  item.addEventListener("click", (event) => {
    event.stopPropagation();
    onClick();
  });
  menu.appendChild(item);
}

async function copyPostLink(postId: string) {
  const url = new URL(window.location.href);
  url.hash = `room-post-${postId}`;
  await navigator.clipboard?.writeText(url.toString());
  window.alert("Room post link copied.");
}

function savePost(postId: string) {
  writeList(SAVED_KEY, [...readList(SAVED_KEY), postId]);
  window.alert("Saved on this device. A synced saved-room-posts system can be added next.");
}

function mutePost(postId: string) {
  writeList(MUTED_KEY, [...readList(MUTED_KEY), postId]);
  window.alert("Muted on this device. Thread notifications can be connected when room replies are added.");
}

async function editPost(post: RoomPostActionRow) {
  const nextTitle = window.prompt("Edit title", post.title ?? "") ?? post.title ?? "";
  const nextBody = window.prompt("Edit post", post.body ?? "") ?? post.body ?? "";
  if (!nextBody.trim()) return;

  const { error } = await supabase
    .from("room_posts")
    .update({ title: nextTitle.trim() || null, body: nextBody.trim() })
    .eq("id", post.id);

  if (error) {
    window.alert("Loombus could not edit this post yet.");
    return;
  }

  window.location.reload();
}

async function deletePost(postId: string, ownerAction: boolean) {
  const confirmed = window.confirm(ownerAction ? "Remove this room post?" : "Delete your room post?");
  if (!confirmed) return;

  const { error } = await supabase.from("room_posts").delete().eq("id", postId);
  if (error) {
    window.alert("Loombus could not remove this post yet.");
    return;
  }

  window.location.reload();
}

function reportPost(article: HTMLElement) {
  article.dispatchEvent(new CustomEvent("loombus:room-post-report", { bubbles: true }));
  window.alert("Report option selected. Full room post reporting can now be wired to the moderation queue.");
}

function createActionsMenu(article: HTMLElement, context: RoomActionContext, index: number) {
  if (article.querySelector(`[${ACTIONS_ATTR}]`)) return;

  const post = context.posts[index];
  if (!post?.id) return;

  const isAuthor = Boolean(context.userId && post.author_id === context.userId);
  const isOwner = Boolean(context.userId && (context.ownerId === context.userId || context.createdBy === context.userId));

  article.classList.add("relative");
  article.id = `room-post-${post.id}`;
  article.dataset.roomPostId = post.id;

  const container = document.createElement("div");
  container.setAttribute(ACTIONS_ATTR, "true");
  container.className = "absolute right-3 top-3 z-10";

  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", "Open discussion actions");
  button.className = "grid size-8 place-items-center rounded-full bg-white text-lg font-black leading-none text-slate-500 ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-slate-950";
  button.textContent = "⋯";

  const menu = document.createElement("div");
  menu.setAttribute("data-room-card-menu", "true");
  menu.hidden = true;
  menu.className = "absolute right-0 top-10 w-48 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 text-left shadow-xl";

  addAction(menu, "Copy link", "default", () => {
    menu.hidden = true;
    void copyPostLink(post.id);
  });

  addAction(menu, "Save", "default", () => {
    menu.hidden = true;
    savePost(post.id);
  });

  addAction(menu, "Mute updates", "default", () => {
    menu.hidden = true;
    mutePost(post.id);
  });

  if (isAuthor) {
    addAction(menu, "Edit post", "default", () => {
      menu.hidden = true;
      void editPost(post);
    });

    addAction(menu, "Delete post", "danger", () => {
      menu.hidden = true;
      void deletePost(post.id, false);
    });
  }

  if (isOwner && !isAuthor) {
    addAction(menu, "Remove post", "danger", () => {
      menu.hidden = true;
      void deletePost(post.id, true);
    });
  }

  addAction(menu, "Report", "danger", () => {
    menu.hidden = true;
    reportPost(article);
  });

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    closeOtherMenus(menu);
    menu.hidden = !menu.hidden;
  });

  container.appendChild(button);
  container.appendChild(menu);
  article.appendChild(container);
}

async function getActionContext(roomId: string, articleCount: number): Promise<RoomActionContext | null> {
  if (!roomId || !articleCount) return null;

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id ?? null;

  const [{ data: roomData }, { data: postData }] = await Promise.all([
    supabase.from("rooms").select("owner_id, created_by").eq("id", roomId).maybeSingle(),
    supabase
      .from("room_posts")
      .select("id, title, body, author_id")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false })
      .limit(articleCount),
  ]);

  const room = (roomData ?? {}) as { owner_id?: string | null; created_by?: string | null };

  return {
    roomId,
    userId,
    ownerId: room.owner_id ?? null,
    createdBy: room.created_by ?? null,
    posts: (postData ?? []) as RoomPostActionRow[],
  };
}

export function RoomDiscussionCardActions() {
  useEffect(() => {
    let timer: number | null = null;

    async function enhanceCards() {
      const articles = Array.from(document.querySelectorAll<HTMLElement>("main.loombus-v2-page-bg section#discussions article"));
      if (!articles.length) return;

      const context = await getActionContext(getRoomIdFromPath(), articles.length);
      if (!context) return;

      articles.forEach((article, index) => createActionsMenu(article, context, index));
    }

    function scheduleEnhance() {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void enhanceCards();
      }, 100);
    }

    scheduleEnhance();

    const observer = new MutationObserver(scheduleEnhance);
    observer.observe(document.body, { childList: true, subtree: true });

    function closeMenus() {
      document.querySelectorAll<HTMLElement>(`[${ACTIONS_ATTR}] [data-room-card-menu]`).forEach((menu) => {
        menu.hidden = true;
      });
    }

    document.addEventListener("click", closeMenus);

    return () => {
      if (timer) window.clearTimeout(timer);
      observer.disconnect();
      document.removeEventListener("click", closeMenus);
    };
  }, []);

  return null;
}
