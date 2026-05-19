"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Notification = {
  id: string;
  type: string;
  target_type: string;
  target_id: string | null;
  message: string;
  read_at: string | null;
  created_at: string;
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadNotifications() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        window.location.href = "/login";
        return;
      }

      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: false });

      setNotifications(data ?? []);
      setLoading(false);
    }

    loadNotifications();
  }, []);

  async function markRead(id: string) {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);

    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id
          ? { ...notification, read_at: new Date().toISOString() }
          : notification
      )
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-6 text-5xl font-semibold tracking-tight">
          Notifications
        </h1>

        <p className="mb-12 text-zinc-500">
          Updates from conversations and activity connected to you.
        </p>

        {loading && (
          <p className="text-zinc-500">
            Loading notifications...
          </p>
        )}

        {!loading && notifications.length === 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <h2 className="mb-3 text-2xl font-medium">
              No notifications yet.
            </h2>

            <p className="text-zinc-400">
              Replies and other activity will appear here.
            </p>
          </div>
        )}

        <div className="space-y-4">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`rounded-2xl border p-6 ${
                notification.read_at
                  ? "border-zinc-900 bg-zinc-950"
                  : "border-zinc-700 bg-zinc-950"
              }`}
            >
              <p className="mb-3 text-zinc-300">
                {notification.message}
              </p>

              <p className="mb-4 text-sm text-zinc-600">
                {new Date(notification.created_at).toLocaleString()}
              </p>

              <div className="flex flex-wrap gap-3">
                {notification.target_type === "discussion" &&
                  notification.target_id && (
                    <a
                      href={`/discussions/${notification.target_id}`}
                      className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                    >
                      Open discussion
                    </a>
                  )}

                {!notification.read_at && (
                  <button
                    onClick={() => markRead(notification.id)}
                    className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-400 transition hover:border-zinc-500 hover:text-white"
                  >
                    Mark read
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
