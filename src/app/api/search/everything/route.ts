import { NextRequest, NextResponse } from "next/server";
import { getEverythingSearchGroup } from "@/lib/everything-search";
import {
  EverythingSearchError,
  runEverythingSearch,
} from "@/lib/everything-search-server";
import {
  createMemberPrivacyServiceClient,
  isAdmin,
  requireMemberUser,
} from "@/lib/member-privacy-server";
import {
  canDiscoverTeenProfile,
  getAgeSafetyRecord,
  isTeenRestrictedSearchType,
} from "@/lib/teen-safety-server";

function jsonError(message: string, status: number, code: string) {
  return NextResponse.json(
    { error: message, code },
    {
      status,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? "60");

  try {
    const result = await runEverythingSearch({ request, query, limit });
    const service = createMemberPrivacyServiceClient();
    const { user } = await requireMemberUser(request);
    let filteredResults = result.results;
    let teenSafetyFiltered = false;

    if (service && user) {
      const admin = await isAdmin(service, user.id);
      const viewerAge = await getAgeSafetyRecord(service, user.id);

      if (!admin) {
        const personVisibilityEntries = await Promise.all(
          result.results
            .filter((item) => item.type === "person" && item.ownerId)
            .map(async (item) => [
              item.ownerId as string,
              await canDiscoverTeenProfile(service, user.id, item.ownerId as string),
            ] as const),
        );
        const personVisibility = new Map(personVisibilityEntries);

        const personOwnerIds = [
          ...new Set(
            result.results
              .filter((item) => item.type === "person" && item.ownerId)
              .map((item) => item.ownerId as string),
          ),
        ].filter((id) => id !== user.id);

        let hiddenIds = new Set<string>();
        if (personOwnerIds.length > 0) {
          const { data: hiddenRows, error: privacyError } = await service
            .from("member_privacy_settings")
            .select("user_id")
            .in("user_id", personOwnerIds)
            .eq("discoverable", false);

          if (privacyError) {
            hiddenIds = new Set(personOwnerIds);
          } else {
            hiddenIds = new Set((hiddenRows ?? []).map((row) => row.user_id));
          }
        }

        filteredResults = result.results.filter((item) => {
          if (item.type === "person" && item.ownerId && item.ownerId !== user.id) {
            if (hiddenIds.has(item.ownerId)) return false;
            if (personVisibility.get(item.ownerId) === false) return false;
          }

          if (
            viewerAge?.age_band === "teen" &&
            isTeenRestrictedSearchType(item.type)
          ) {
            return false;
          }

          return true;
        });
        teenSafetyFiltered = filteredResults.length !== result.results.length;
      }
    }

    const counts = filteredResults.reduce<Record<string, number>>((next, item) => {
      const group = getEverythingSearchGroup(item.type);
      next[group] = (next[group] ?? 0) + 1;
      return next;
    }, {});

    return NextResponse.json(
      {
        ...result,
        results: filteredResults,
        counts,
        teenSafetyFiltered,
      },
      {
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (error) {
    if (error instanceof EverythingSearchError) {
      return jsonError(error.message, error.status, error.code);
    }

    console.error("Everything Search failed:", error);
    return jsonError(
      "Everything Search could not load. Try again.",
      500,
      "everything_search_failed",
    );
  }
}
