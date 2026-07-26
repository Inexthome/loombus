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

function jsonError(message: string, status: number, code: string) {
  return NextResponse.json(
    { error: message, code },
    {
      status,
      headers: { "Cache-Control": "private, no-store" },
    }
  );
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? "60");

  try {
    const result = await runEverythingSearch({
      request,
      query,
      limit,
    });

    const service = createMemberPrivacyServiceClient();
    const { user } = await requireMemberUser(request);
    let filteredResults = result.results;

    if (service && user && !(await isAdmin(service, user.id))) {
      const personOwnerIds = [
        ...new Set(
          result.results
            .filter((item) => item.type === "person" && item.ownerId)
            .map((item) => item.ownerId as string)
        ),
      ].filter((id) => id !== user.id);

      if (personOwnerIds.length > 0) {
        const { data: hiddenRows, error: privacyError } = await service
          .from("member_privacy_settings")
          .select("user_id")
          .in("user_id", personOwnerIds)
          .eq("discoverable", false);

        if (privacyError) {
          // Fail closed for member identities when discoverability cannot be verified.
          filteredResults = result.results.filter(
            (item) => item.type !== "person" || item.ownerId === user.id
          );
        } else {
          const hiddenIds = new Set((hiddenRows ?? []).map((row) => row.user_id));
          filteredResults = result.results.filter(
            (item) =>
              item.type !== "person" ||
              !item.ownerId ||
              item.ownerId === user.id ||
              !hiddenIds.has(item.ownerId)
          );
        }
      }
    }

    const counts = filteredResults.reduce<Record<string, number>>((next, item) => {
      const group = getEverythingSearchGroup(item.type);
      next[group] = (next[group] ?? 0) + 1;
      return next;
    }, {});

    return NextResponse.json(
      { ...result, results: filteredResults, counts },
      {
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  } catch (error) {
    if (error instanceof EverythingSearchError) {
      return jsonError(error.message, error.status, error.code);
    }

    console.error("Everything Search failed:", error);
    return jsonError(
      "Everything Search could not load. Try again.",
      500,
      "everything_search_failed"
    );
  }
}
