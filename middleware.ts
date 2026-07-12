import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const topic = request.nextUrl.searchParams.get("topic")?.trim();

  if (request.nextUrl.pathname === "/discussions" && topic) {
    const destination = request.nextUrl.clone();
    destination.pathname = `/topics/${encodeURIComponent(topic)}`;
    destination.search = "";

    return NextResponse.redirect(destination);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/discussions"],
};
