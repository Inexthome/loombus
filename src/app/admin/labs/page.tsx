"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { ProfileAvatar, getProfileDisplayName } from "@/components/profile-avatar";
import { supabase } from "@/lib/supabase/client";

type LabsFeatureRequestStatus =
  | "all"
  | "submitted"
  | "reviewing"
  | "planned"
  | "shipped"
  | "declined";

type LabsFeatureRequestRow = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  status: Exclude<LabsFeatureRequestStatus, "all">;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

const STATUS_OPTIONS: Exclude<LabsFeatureRequestStatus, "all">[] = [
  "submitted",
  "reviewing",
  "planned",
  "shipped",
  "declined",
];

const STATUS_LABELS: Record<Exclude<LabsFeatureRequestStatus, "all">, string> = {
  submitted: "Submitted",
  reviewing: "Reviewing",
  planned: "Planned",
  shipped: "Shipped",
  declined: "Declined",
};

const STATUS_CLASSES: Record<Exclude<LabsFeatureRequestStatus, "all">, string> = {
  submitted: "border-zinc-800 text-zinc-400",
  reviewing: "border-sky-800 bg-sky-950/30 text-sky-300",
  planned: "border-violet-800 bg-violet-950/30 text-violet-300",
  shipped: "border-emerald-800 bg-emerald-950/30 text-emerald-300",
  declined: "border-red-900 bg-red-950/20 text-red-300",
};

export default function AdminLabsPage() {
  const [requests, setRequests] = useState<LabsFeatureRequestRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<LabsFeatureRequestStatus>("all");
  const [statusDrafts, setStatusDrafts] = useState<Record<string, Exclude<LabsFeatureRequestStatus, "all">>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [workingRequestId, setWorkingRequestId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAdminLabs() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        window.location.href = "/login";
        return;
      }

      setCurrentUserId(userData.user.id);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", userData.user.id)
        .maybeSingle();

      if (!profileData?.is_admin) {
        setAuthChecked(true);
        setLoading(false);
        return;
      }

      setIsAdmin(true);

      const { data: requestData, error: requestError } = await supabase
        .from("labs_feature_requests")
        .select("id, user_id, title, description, status, admin_note, reviewed_by, reviewed_at, created_at, updated_at")
        .order("created_at", { ascending: false });

      if (requestError) {
        setMessage(`Unable to load Labs requests: ${requestError.message}`);
        setAuthChecked(true);
        setLoading(false);
        return;
      }

      const loadedRequests = (requestData ?? []) as LabsFeatureRequestRow[];
      setRequests(loadedRequests);

      setStatusDrafts(
        loadedRequests.reduce<Record<string, Exclude<LabsFeatureRequestStatus, "all">>>(
          (drafts, request) => {
            drafts[request.id] = request.status;
            return drafts;
          },
          {}
        )
      );

      setNoteDrafts(
        loadedRequests.reduce<Record<string, string>>((drafts, request) => {
          drafts[request.id] = request.admin_note ?? "";
          return drafts;
        }, {})
      );

      const profileIds = [
        ...new Set(
          loadedRequests
            .flatMap((request) => [request.user_id, request.reviewed_by])
            .filter((id): id is string => Boolean(id))
        ),
      ];

      if (profileIds.length > 0) {
        const { data: profileRows } = await supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", profileIds);

        const profileMap: Record<string, Profile> = {};

        for (const profile of (profileRows ?? []) as Profile[]) {
          profileMap[profile.id] = profile;
        }

        setProfiles(profileMap);
      }

      setAuthChecked(true);
      setLoading(false);
    }

    loadAdminLabs();
  }, []);

  const filteredRequests = useMemo(() => {
    if (statusFilter === "all") {
      return requests;
    }

    return requests.filter((request) => request.status === statusFilter);
  }, [requests, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: requests.length,
    };

    for (const request of requests) {
      counts[request.status] = (counts[request.status] ?? 0) + 1;
    }

    return counts;
  }, [requests]);

  async function updateRequest(event: FormEvent<HTMLFormElement>, requestId: string) {
    event.preventDefault();
    setMessage("");

    if (!currentUserId || workingRequestId) {
      return;
    }

    const nextStatus = statusDrafts[requestId];
    const nextNote = (noteDrafts[requestId] ?? "").trim();

    if (!nextStatus) {
      setMessage("Choose a status before saving.");
      return;
    }

    setWorkingRequestId(requestId);

    const { data, error } = await supabase
      .from("labs_feature_requests")
      .update({
        status: nextStatus,
        admin_note: nextNote || null,
        reviewed_by: currentUserId,
      })
      .eq("id", requestId)
      .select("id, user_id, title, description, status, admin_note, reviewed_by, reviewed_at, created_at, updated_at")
      .single();

    setWorkingRequestId(null);

    if (error) {
      setMessage(`Unable to update request: ${error.message}`);
      return;
    }

    const updated = data as LabsFeatureRequestRow;

    setRequests((current) =>
      current.map((request) => (request.id === requestId ? updated : request))
    );

    setStatusDrafts((current) => ({
      ...current,
      [requestId]: updated.status,
    }));

    setNoteDrafts((current) => ({
      ...current,
      [requestId]: updated.admin_note ?? "",
    }));

    setMessage("Labs request updated.");
  }

  async function deleteRequest(requestId: string) {
    setMessage("");

    if (workingRequestId) {
      return;
    }

    setWorkingRequestId(requestId);

    const { error } = await supabase
      .from("labs_feature_requests")
      .delete()
      .eq("id", requestId);

    setWorkingRequestId(null);

    if (error) {
      setMessage(`Unable to delete request: ${error.message}`);
      return;
    }

    setRequests((current) => current.filter((request) => request.id !== requestId));
    setMessage("Labs request deleted.");
  }

  if (!authChecked || loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-6xl text-zinc-500">
          Loading Loombus Labs admin...
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/admin"
            className="mb-10 inline-block text-sm text-zinc-500 hover:text-white"
          >
            ← Back to admin
          </Link>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
            <p className="mb-3 text-sm uppercase tracking-[0.3em] text-zinc-500">
              Admin only
            </p>

            <h1 className="mb-4 text-4xl font-semibold tracking-tight">
              Access denied.
            </h1>

            <p className="leading-relaxed text-zinc-400">
              Loombus Labs review tools are available only to Admin accounts.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/admin"
          className="mb-10 inline-block text-sm text-zinc-500 hover:text-white"
        >
          ← Back to admin
        </Link>

        <div className="mb-10 rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
          <p className="mb-4 text-sm uppercase tracking-[0.3em] text-zinc-500">
            Loombus Labs Admin
          </p>

          <h1 className="mb-5 text-5xl font-semibold tracking-tight">
            Review Labs requests.
          </h1>

          <p className="max-w-3xl leading-relaxed text-zinc-400">
            Review Premium Plus feature requests, update statuses, and leave
            admin notes for members.
          </p>
        </div>

        {message && (
          <p className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
            {message}
          </p>
        )}

        <div className="mb-8 flex flex-wrap gap-3">
          {(["all", ...STATUS_OPTIONS] as LabsFeatureRequestStatus[]).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`rounded-full border px-4 py-2 text-sm transition ${
                statusFilter === status
                  ? "border-zinc-400 text-white"
                  : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-white"
              }`}
            >
              {status === "all" ? "All" : STATUS_LABELS[status]} ({statusCounts[status] ?? 0})
            </button>
          ))}
        </div>

        {filteredRequests.length === 0 ? (
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
            <h2 className="mb-3 text-2xl font-medium">
              No Labs requests found.
            </h2>

            <p className="text-zinc-500">
              No requests match the current status filter.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredRequests.map((request) => {
              const requester = profiles[request.user_id];
              const reviewer = request.reviewed_by
                ? profiles[request.reviewed_by]
                : null;
              const isWorking = workingRequestId === request.id;

              return (
                <article
                  key={request.id}
                  className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6"
                >
                  <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="mb-3 flex items-center gap-3">
                        <ProfileAvatar profile={requester} size="md" />

                        <div>
                          <p className="text-sm text-zinc-300">
                            {getProfileDisplayName(requester)}
                          </p>

                          <p className="text-xs text-zinc-600">
                            {requester?.username ? `@${requester.username}` : request.user_id}
                          </p>
                        </div>
                      </div>

                      <h2 className="text-2xl font-medium">
                        {request.title}
                      </h2>

                      <p className="mt-2 text-sm text-zinc-600">
                        Submitted {new Date(request.created_at).toLocaleString()}
                      </p>
                    </div>

                    <span
                      className={`w-fit rounded-full border px-4 py-2 text-xs font-medium ${STATUS_CLASSES[request.status]}`}
                    >
                      {STATUS_LABELS[request.status]}
                    </span>
                  </div>

                  <p className="mb-6 whitespace-pre-wrap leading-relaxed text-zinc-400">
                    {request.description}
                  </p>

                  <form
                    onSubmit={(event) => updateRequest(event, request.id)}
                    className="space-y-4 rounded-2xl border border-zinc-900 bg-black p-5"
                  >
                    <div>
                      <label className="mb-2 block text-sm text-zinc-400">
                        Status
                      </label>

                      <select
                        value={statusDrafts[request.id] ?? request.status}
                        onChange={(event) =>
                          setStatusDrafts((current) => ({
                            ...current,
                            [request.id]: event.target.value as Exclude<LabsFeatureRequestStatus, "all">,
                          }))
                        }
                        className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-300 outline-none transition focus:border-zinc-600"
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {STATUS_LABELS[status]}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm text-zinc-400">
                        Admin note
                      </label>

                      <textarea
                        rows={4}
                        value={noteDrafts[request.id] ?? ""}
                        onChange={(event) =>
                          setNoteDrafts((current) => ({
                            ...current,
                            [request.id]: event.target.value,
                          }))
                        }
                        maxLength={2000}
                        placeholder="Add context for this decision or next step..."
                        className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-300 outline-none transition placeholder:text-zinc-700 focus:border-zinc-600"
                      />

                      <p className="mt-2 text-xs text-zinc-600">
                        {(noteDrafts[request.id] ?? "").length}/2000 characters
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="submit"
                          disabled={isWorking}
                          className="rounded-full bg-white px-5 py-3 text-sm text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
                        >
                          {isWorking ? "Saving..." : "Save review"}
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteRequest(request.id)}
                          disabled={isWorking}
                          className="rounded-full border border-zinc-800 px-5 py-3 text-sm text-zinc-500 transition hover:border-red-900 hover:text-red-300 disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                        >
                          {isWorking ? "Working..." : "Delete"}
                        </button>
                      </div>

                      {request.reviewed_at && (
                        <p className="text-xs text-zinc-600">
                          Reviewed {new Date(request.reviewed_at).toLocaleString()}
                          {reviewer ? ` by ${getProfileDisplayName(reviewer)}` : ""}
                        </p>
                      )}
                    </div>
                  </form>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
