import { NextRequest, NextResponse } from "next/server";
import {
  EverythingSearchError,
  runEverythingSearch,
} from "@/lib/everything-search-server";

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

    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
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
