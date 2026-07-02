"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ProfileAvatar, getProfileDisplayName } from "@/components/profile-avatar";
import { supabase } from "@/lib/supabase/client";
import {
  getSubscriptionDisplay,
  getSubscriptionDisplayKey,
} from "@/lib/subscription-plans";
import {
  getIdentityVerificationDisplay,
  normalizeIdentityVerificationStatus,
  type IdentityVerificationStatus,
} from "@/lib/identity-verification";
import { validatePublicProfileCompletion } from "@/lib/profile-completion";

type ProfileRow = {
  id: string;
  username: string | null;
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_admin: boolean | null;
  account_status: string | null;
  identity_verification_status: string | null;
  identity_verification_provider: string | null;
  identity_verified_at: string | null;
  legal_name_verified: boolean | null;
  identity_restriction_reason: string | null;
  date_of_birth: string | null;
  age_band: string | null;
  teen_safety_mode: boolean | null;
  guardian_required: boolean | null;
};

type EntitlementRow = {
  user_id: string;
  tier: string | null;
  ai_assisted_enabled: boolean | null;
  monthly_summary_limit: number | null;
  monthly_writing_limit: number | null;
  monthly_research_limit: number | null;
  monthly_discovery_limit: number | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  stripe_subscription_status: string | null;
  stripe_current_period_end: string | null;
  updated_at: string | null;
};

const IDENTITY_STATUS_OPTIONS: IdentityVerificationStatus[] = [
  "unverified",
  "pending",
  "verified",
  "failed",
  "restricted",
];

function maskId(value: string | null | undefined) {
  if (!value) return "—";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function normalizeAccountStatus(status: string | null | undefined) {
  return status || "active";
}

function accountStatusClass(status: string | null | undefined) {
  const normalized = normalizeAccountStatus(status);

  if (normalized === "active") return "border-emerald-900 text-emerald-300";
  if (normalized === "warned") return "border-amber-900 text-amber-300";
  if (normalized === "suspended") return "border-orange-900 text-orange-300";
  if (normalized === "banned") return "border-red-900 text-red-300";
  if (normalized === "deactivated") return "border-zinc-800 text-zinc-500";
  if (normalized === "deletion_requested") return "border-violet-900 text-violet-300";

  return "border-zinc-800 text-zinc-400";
}

function normalizeAgeBand(value: string | null | undefined) {
  if (
    value === "unknown" ||
    value === "under_13" ||
    value === "teen" ||
    value === "adult"
  ) {
    return value;
  }

  return "unknown";
}

function formatAgeBandLabel(value: string | null | undefined) {
  const ageBand = normalizeAgeBand(value);

  if (ageBand === "under_13") return "Under 13";
  if (ageBand === "teen") return "Teen";
  if (ageBand === "adult") return "Adult";

  return "Unknown";
}

function ageBandClass(value: string | null | undefined) {
  const ageBand = normalizeAgeBand(value);

  if (ageBand === "under_13") return "border-red-900 text-red-300";
  if (ageBand === "teen") return "border-amber-900 text-amber-300";
  if (ageBand === "adult") return "border-emerald-900 text-emerald-300";

  return "border-zinc-800 text-zinc-500";
}

function formatIdentityStatusLabel(status: IdentityVerificationStatus) {
  return status.replaceAll("_", " ");
}

function formatOptionalDate(value: string | null | undefined) {
  if (!value) return "—";

  const timestamp = new Date(value).getTime();

  if (!Number.isFinite(timestamp)) {
    return "—";
  }

  return new Date(value).toLocaleDateString();
}

export default function AdminUsersPage() {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [entitlements, setEntitlements] = useState<Record<string, EntitlementRow>>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [identityFilter, setIdentityFilter] = useState("all");
  const [ageFilter, setAgeFilter] = useState("all");
  const [publicProfileFilter, setPublicProfileFilter] = useState("all");
  const [identityReasonByUserId, setIdentityReasonByUserId] = useState<Record<string, string>>({});
  const [workingIdentityUserId, setWorkingIdentityUserId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const memberQuery = params.get("member") || params.get("search");

    if (memberQuery) {
      setSearchQuery(memberQuery);
    }

    async function loadUsers() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        window.location.href = "/login";
        return;
      }

      const { data: adminProfile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", userData.user.id)
        .maybeSingle();

      if (!adminProfile?.is_admin) {
        setAuthChecked(true);
        setLoading(false);
        return;
      }

      setIsAdmin(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch("/api/admin/users", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(`Unable to load users: ${result.error ?? "Unknown error."}`);
        setAuthChecked(true);
        setLoading(false);
        return;
      }

      const loadedProfiles = (result.profiles ?? []) as ProfileRow[];
      setProfiles(loadedProfiles);

      const entitlementMap: Record<string, EntitlementRow> = {};

      for (const entitlement of (result.entitlements ?? []) as EntitlementRow[]) {
        entitlementMap[entitlement.user_id] = entitlement;
      }

      setEntitlements(entitlementMap);

      setAuthChecked(true);
      setLoading(false);
    }

    loadUsers();
  }, []);

  const rows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return profiles
      .map((profile) => {
        const entitlement = entitlements[profile.id] ?? null;
        const planKey = getSubscriptionDisplayKey(entitlement);
        const planDisplay = getSubscriptionDisplay(entitlement);
        const accountStatus = normalizeAccountStatus(profile.account_status);
        const identityStatus = normalizeIdentityVerificationStatus(
          profile.identity_verification_status
        );
        const identityDisplay = getIdentityVerificationDisplay(identityStatus);
        const ageBand = normalizeAgeBand(profile.age_band);
        const teenSafetyMode = Boolean(profile.teen_safety_mode);
        const guardianRequired = Boolean(profile.guardian_required);
        const publicProfileGate = validatePublicProfileCompletion({
          fullName: profile.full_name,
          username: profile.username,
          bio: profile.bio,
        });
        const publicProfileComplete = publicProfileGate.ok;
        const publicProfileIssue = publicProfileGate.ok ? "" : publicProfileGate.message;

        return {
          profile,
          entitlement,
          planKey,
          planDisplay,
          accountStatus,
          identityStatus,
          identityDisplay,
          ageBand,
          teenSafetyMode,
          guardianRequired,
          publicProfileGate,
          publicProfileComplete,
          publicProfileIssue,
        };
      })
      .filter((row) => {
        if (statusFilter !== "all" && row.accountStatus !== statusFilter) {
          return false;
        }

        if (planFilter !== "all" && row.planKey !== planFilter) {
          return false;
        }

        if (identityFilter !== "all" && row.identityStatus !== identityFilter) {
          return false;
        }

        if (ageFilter === "teen_safety" && !row.teenSafetyMode) {
          return false;
        }

        if (ageFilter === "guardian_required" && !row.guardianRequired) {
          return false;
        }

        if (
          ageFilter !== "all" &&
          ageFilter !== "teen_safety" &&
          ageFilter !== "guardian_required" &&
          row.ageBand !== ageFilter
        ) {
          return false;
        }

        if (publicProfileFilter === "complete" && !row.publicProfileComplete) {
          return false;
        }

        if (publicProfileFilter === "incomplete" && row.publicProfileComplete) {
          return false;
        }

        if (!query) {
          return true;
        }

        const searchable = [
          row.profile.id,
          row.profile.username,
          row.profile.full_name,
          row.profile.bio,
          row.publicProfileComplete ? "profile complete public profile complete" : "profile incomplete public profile incomplete",
          row.publicProfileIssue,
          row.accountStatus,
          row.identityStatus,
          row.profile.identity_verification_provider,
          row.profile.identity_restriction_reason,
          row.ageBand,
          row.teenSafetyMode ? "teen safety teen_safety_mode" : "",
          row.guardianRequired ? "guardian required guardian_required" : "",
          row.profile.date_of_birth ? "date of birth on file dob on file" : "date of birth missing",
          row.planKey,
          row.planDisplay.label,
          row.entitlement?.stripe_subscription_status,
          row.entitlement?.stripe_customer_id,
          row.entitlement?.stripe_subscription_id,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchable.includes(query);
      });
  }, [profiles, entitlements, searchQuery, statusFilter, planFilter, identityFilter, ageFilter, publicProfileFilter]);

  const counts = useMemo(() => {
    const allRows = profiles.map((profile) => {
      const entitlement = entitlements[profile.id] ?? null;
      return {
        profile,
        planKey: getSubscriptionDisplayKey(entitlement),
        accountStatus: normalizeAccountStatus(profile.account_status),
        identityStatus: normalizeIdentityVerificationStatus(
          profile.identity_verification_status
        ),
        ageBand: normalizeAgeBand(profile.age_band),
        teenSafetyMode: Boolean(profile.teen_safety_mode),
        guardianRequired: Boolean(profile.guardian_required),
        publicProfileGate: validatePublicProfileCompletion({
          fullName: profile.full_name,
          username: profile.username,
          bio: profile.bio,
        }),
        hasStripeCustomer: Boolean(entitlement?.stripe_customer_id),
      };
    });

    return {
      total: allRows.length,
      admins: allRows.filter((row) => row.profile.is_admin).length,
      premium: allRows.filter((row) => row.planKey === "premium").length,
      premiumPlus: allRows.filter((row) => row.planKey === "premium_plus").length,
      billingLinked: allRows.filter((row) => row.hasStripeCustomer).length,
      restricted: allRows.filter((row) => row.accountStatus !== "active").length,
      identityVerified: allRows.filter((row) => row.identityStatus === "verified").length,
      identityUnverified: allRows.filter((row) => row.identityStatus === "unverified").length,
      teenSafety: allRows.filter((row) => row.teenSafetyMode).length,
      ageUnknown: allRows.filter((row) => row.ageBand === "unknown").length,
      under13: allRows.filter((row) => row.ageBand === "under_13" || row.guardianRequired).length,
      publicProfileComplete: allRows.filter((row) => row.publicProfileGate.ok).length,
      publicProfileIncomplete: allRows.filter((row) => !row.publicProfileGate.ok).length,
    };
  }, [profiles, entitlements]);

  async function updateIdentityVerification(
    profile: ProfileRow,
    status: IdentityVerificationStatus
  ) {
    if (workingIdentityUserId) {
      return;
    }

    setMessage("");
    setWorkingIdentityUserId(profile.id);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch("/api/admin/moderation/actions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action: "update_identity_verification",
          targetUserId: profile.id,
          identityVerificationStatus: status,
          identityRestrictionReason: identityReasonByUserId[profile.id] ?? "",
          legalNameVerified: status === "verified",
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(result.error ?? "Unable to update identity verification.");
        return;
      }

      setProfiles((current) =>
        current.map((currentProfile) =>
          currentProfile.id === profile.id
            ? {
                ...currentProfile,
                identity_verification_status: result.identityVerificationStatus ?? status,
                identity_verification_provider:
                  result.identityVerificationProvider ?? null,
                identity_verified_at: result.identityVerifiedAt ?? null,
                legal_name_verified: Boolean(result.legalNameVerified),
                identity_restriction_reason:
                  result.identityRestrictionReason ?? null,
              }
            : currentProfile
        )
      );

      setMessage("Identity verification status updated.");
    } catch {
      setMessage("Unable to update identity verification.");
    } finally {
      setWorkingIdentityUserId(null);
    }
  }

  if (!authChecked || loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-6xl text-zinc-500">
          Loading admin users...
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-3xl">
          <Link href="/admin" className="mb-10 inline-block text-sm text-zinc-500 hover:text-white">
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
              User lookup is available only to Admin accounts.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-7xl">
        <Link href="/admin" className="mb-10 inline-block text-sm text-zinc-500 hover:text-white">
          ← Back to admin
        </Link>

        <div className="mb-10 rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
          <p className="mb-4 text-sm uppercase tracking-[0.3em] text-zinc-500">
            Administration
          </p>

          <h1 className="mb-5 text-5xl font-semibold tracking-tight">
            User lookup.
          </h1>

          <p className="max-w-3xl leading-relaxed text-zinc-400">
            Search members, review account status, identity verification,
            Premium access, usage limits, and billing identity presence.
          </p>
        </div>

        {message && (
          <p className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
            {message}
          </p>
        )}

        <section className="mb-8 grid gap-4 md:grid-cols-4 lg:grid-cols-12">
          <Metric label="Users" value={counts.total} />
          <Metric label="Admins" value={counts.admins} />
          <Metric label="Premium" value={counts.premium} />
          <Metric label="Premium Plus" value={counts.premiumPlus} />
          <Metric label="Billing linked" value={counts.billingLinked} />
          <Metric label="Restricted" value={counts.restricted} />
          <Metric label="ID verified" value={counts.identityVerified} />
          <Metric label="Unverified" value={counts.identityUnverified} />
          <Metric label="Teen Safety" value={counts.teenSafety} />
          <Metric label="Age unknown" value={counts.ageUnknown} />
          <Metric label="Under 13" value={counts.under13} />
          <Metric label="Profile complete" value={counts.publicProfileComplete} />
          <Metric label="Profile incomplete" value={counts.publicProfileIncomplete} />
        </section>

        <section className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
          <div className="grid gap-4 xl:grid-cols-[1fr_190px_190px_190px_190px_190px]">
            <label>
              <span className="mb-2 block text-sm text-zinc-400">Search users</span>
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search username, name, id, plan, account status, identity status, Stripe id..."
                className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-zinc-600"
              />
            </label>

            <label>
              <span className="mb-2 block text-sm text-zinc-400">Account status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-300 outline-none transition focus:border-zinc-600"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="warned">Warned</option>
                <option value="suspended">Suspended</option>
                <option value="banned">Banned</option>
                <option value="deactivated">Deactivated</option>
                <option value="deletion_requested">Deletion requested</option>
              </select>
            </label>

            <label>
              <span className="mb-2 block text-sm text-zinc-400">Plan</span>
              <select
                value={planFilter}
                onChange={(event) => setPlanFilter(event.target.value)}
                className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-300 outline-none transition focus:border-zinc-600"
              >
                <option value="all">All plans</option>
                <option value="free">Free</option>
                <option value="premium">Premium</option>
                <option value="premium_plus">Premium Plus</option>
                <option value="admin">Admin</option>
              </select>
            </label>

            <label>
              <span className="mb-2 block text-sm text-zinc-400">Identity status</span>
              <select
                value={identityFilter}
                onChange={(event) => setIdentityFilter(event.target.value)}
                className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-300 outline-none transition focus:border-zinc-600"
              >
                <option value="all">All identity statuses</option>
                <option value="unverified">Unverified</option>
                <option value="pending">Pending</option>
                <option value="verified">Verified</option>
                <option value="failed">Failed</option>
                <option value="restricted">Restricted</option>
              </select>
            </label>

            <label>
              <span className="mb-2 block text-sm text-zinc-400">Age safety</span>
              <select
                value={ageFilter}
                onChange={(event) => setAgeFilter(event.target.value)}
                className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-300 outline-none transition focus:border-zinc-600"
              >
                <option value="all">All age safety</option>
                <option value="unknown">Age unknown</option>
                <option value="teen">Teen</option>
                <option value="adult">Adult</option>
                <option value="under_13">Under 13</option>
                <option value="teen_safety">Teen Safety Mode</option>
                <option value="guardian_required">Guardian required</option>
              </select>
            </label>

            <label>
              <span className="mb-2 block text-sm text-zinc-400">Public profile</span>
              <select
                value={publicProfileFilter}
                onChange={(event) => setPublicProfileFilter(event.target.value)}
                className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-300 outline-none transition focus:border-zinc-600"
              >
                <option value="all">All profiles</option>
                <option value="complete">Complete</option>
                <option value="incomplete">Incomplete</option>
              </select>
            </label>
          </div>

          <p className="mt-4 text-sm text-zinc-600">
            Showing {rows.length} of {profiles.length} users.
          </p>
        </section>

        <section className="space-y-4">
          {rows.length === 0 ? (
            <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
              <h2 className="mb-3 text-2xl font-medium">No users found.</h2>
              <p className="text-zinc-500">
                Adjust search or filters to broaden the lookup.
              </p>
            </div>
          ) : (
            rows.map(({ profile, entitlement, planDisplay, accountStatus, identityStatus, identityDisplay, ageBand, teenSafetyMode, guardianRequired, publicProfileComplete, publicProfileIssue }) => (
              <article
                key={profile.id}
                className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex gap-4">
                    <ProfileAvatar profile={profile} size="lg" />

                    <div>
                      <h2 className="text-xl font-medium">
                        {getProfileDisplayName(profile)}
                      </h2>

                      <p className="mt-1 text-sm text-zinc-500">
                        {profile.username ? `@${profile.username}` : "No username"}
                      </p>

                      <p className="mt-2 text-xs text-zinc-700">
                        User ID: {profile.id}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full border px-3 py-1 text-xs ${accountStatusClass(accountStatus)}`}>
                      {accountStatus.replaceAll("_", " ")}
                    </span>

                    <span className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-400">
                      {planDisplay.label}
                    </span>

                    <span className={`rounded-full border px-3 py-1 text-xs ${identityDisplay.badgeClassName}`}>
                      ID: {identityDisplay.label}
                    </span>

                    <span className={`rounded-full border px-3 py-1 text-xs ${ageBandClass(ageBand)}`}>
                      Age: {formatAgeBandLabel(ageBand)}
                    </span>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs ${
                        publicProfileComplete
                          ? "border-emerald-900 text-emerald-300"
                          : "border-amber-900 text-amber-300"
                      }`}
                    >
                      {publicProfileComplete ? "Profile complete" : "Profile incomplete"}
                    </span>

                    {teenSafetyMode && (
                      <span className="rounded-full border border-amber-900 px-3 py-1 text-xs text-amber-300">
                        Teen Safety
                      </span>
                    )}

                    {guardianRequired && (
                      <span className="rounded-full border border-red-900 px-3 py-1 text-xs text-red-300">
                        Guardian required
                      </span>
                    )}

                    {profile.is_admin && (
                      <span className="rounded-full border border-violet-900 px-3 py-1 text-xs text-violet-300">
                        Admin
                      </span>
                    )}
                  </div>
                </div>

                {!publicProfileComplete && (
                  <div className="mt-5 rounded-2xl border border-amber-900/70 bg-amber-950/20 p-4">
                    <h3 className="text-sm font-semibold text-amber-300">
                      Public profile needs completion
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-amber-200/80">
                      {publicProfileIssue}
                    </p>
                    <Link
                      href={`/admin/users?member=${encodeURIComponent(profile.id)}`}
                      className="mt-3 inline-flex text-xs font-semibold uppercase tracking-[0.18em] text-amber-200 underline-offset-4 hover:underline"
                    >
                      Keep this member in view
                    </Link>
                  </div>
                )}

                <div className="mt-6 grid gap-4 text-sm md:grid-cols-2 lg:grid-cols-4">
                  <Info label="AI enabled" value={entitlement?.ai_assisted_enabled ? "Yes" : "No"} />
                  <Info label="Summary limit" value={`${entitlement?.monthly_summary_limit ?? 0}/month`} />
                  <Info label="Writing limit" value={`${entitlement?.monthly_writing_limit ?? 0}/month`} />
                  <Info label="Research limit" value={`${entitlement?.monthly_research_limit ?? 0}/month`} />
                  <Info label="Discovery limit" value={`${entitlement?.monthly_discovery_limit ?? 0}/month`} />
                  <Info label="Identity provider" value={profile.identity_verification_provider ?? "—"} />
                  <Info label="Legal name" value={profile.legal_name_verified ? "Verified" : "Not verified"} />
                  <Info label="Identity verified at" value={formatOptionalDate(profile.identity_verified_at)} />
                  <Info label="Identity reason" value={profile.identity_restriction_reason ?? "—"} />
                  <Info label="Age band" value={formatAgeBandLabel(ageBand)} />
                  <Info label="Teen safety mode" value={teenSafetyMode ? "Enabled" : "No"} />
                  <Info label="DOB on file" value={profile.date_of_birth ? "Yes" : "No"} />
                  <Info label="Guardian required" value={guardianRequired ? "Yes" : "No"} />
                  <Info label="Public profile" value={publicProfileComplete ? "Complete" : "Incomplete"} />
                  <Info label="Profile issue" value={publicProfileComplete ? "—" : publicProfileIssue} />
                  <Info label="Bio" value={profile.bio?.trim() || "—"} />
                  <Info label="Stripe status" value={entitlement?.stripe_subscription_status ?? "—"} />
                  <Info label="Stripe customer" value={maskId(entitlement?.stripe_customer_id)} />
                  <Info label="Stripe subscription" value={maskId(entitlement?.stripe_subscription_id)} />
                </div>

                <div className="mt-5 rounded-2xl border border-zinc-900 bg-black p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h3 className="text-base font-medium text-zinc-200">
                        Manual identity verification
                      </h3>
                      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">
                        Use this only for internal review/testing. This status does not store identity documents or biometric data.
                      </p>
                    </div>

                    <span className={`w-fit rounded-full border px-3 py-1 text-xs ${identityDisplay.badgeClassName}`}>
                      {formatIdentityStatusLabel(identityStatus)}
                    </span>
                  </div>

                  <label className="mt-4 block">
                    <span className="mb-2 block text-sm text-zinc-500">
                      Reason for failed/restricted status, optional
                    </span>
                    <input
                      type="text"
                      value={identityReasonByUserId[profile.id] ?? ""}
                      onChange={(event) =>
                        setIdentityReasonByUserId((current) => ({
                          ...current,
                          [profile.id]: event.target.value,
                        }))
                      }
                      maxLength={500}
                      className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-300 outline-none transition placeholder:text-zinc-700 focus:border-zinc-600"
                      placeholder="Example: Verification could not be completed."
                    />
                  </label>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {IDENTITY_STATUS_OPTIONS.map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => updateIdentityVerification(profile, status)}
                        disabled={workingIdentityUserId === profile.id}
                        className="rounded-full border border-zinc-800 px-3 py-2 text-xs text-zinc-400 transition hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                      >
                        {workingIdentityUserId === profile.id
                          ? "Updating..."
                          : `Set ${formatIdentityStatusLabel(status)}`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    href="/admin/ai-access"
                    className="rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-400 transition hover:border-zinc-600 hover:text-white"
                  >
                    Manage entitlement
                  </Link>

                  {profile.username && (
                    <Link
                      href={`/u/${profile.username}`}
                      className="rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-400 transition hover:border-zinc-600 hover:text-white"
                    >
                      View public profile
                    </Link>
                  )}

                  <Link
                    href="/admin/reports"
                    className="rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-400 transition hover:border-zinc-600 hover:text-white"
                  >
                    Open reports
                  </Link>
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-600">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-900 bg-black p-4">
      <p className="mb-1 text-xs uppercase tracking-wide text-zinc-700">{label}</p>
      <p className="break-words text-zinc-300">{value}</p>
    </div>
  );
}
