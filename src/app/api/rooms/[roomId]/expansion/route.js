import { NextResponse } from "next/server";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";
import {
  createRequestSupabase,
  createRoomServiceSupabase,
} from "@/lib/room-operations";
import {
  ExpansionError,
  loadExpansionAccess,
  validUuid,
} from "@/lib/room-expansion-service";
import {
  exportFormCsv,
  loadCalendar,
  loadExpansionManifest,
  loadFiles,
  loadForms,
  loadKnowledge,
  loadOrganizationConsole,
  loadPolls,
  loadTasks,
  searchOrganization,
} from "@/lib/room-expansion-loaders";
import { handleExpansionAction } from "@/lib/room-expansion-actions";

function jsonError(message, status, code) {
  return NextResponse.json(code ? { error: message, code } : { error: message }, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

async function authorize(request) {
  try {
    const accountAccess = await verifyRequestAccountAccess(
      createRequestSupabase(request)
    );
    if (!accountAccess.ok) {
      return {
        ok: false,
        response: jsonError(
          accountAccess.error,
          accountAccess.status,
          accountAccess.code
        ),
      };
    }
    return {
      ok: true,
      userId: accountAccess.user.id,
      service: createRoomServiceSupabase(),
    };
  } catch {
    return {
      ok: false,
      response: jsonError("Rooms service is not configured.", 500),
    };
  }
}

function expansionFailure(error) {
  if (error instanceof ExpansionError) {
    return jsonError(error.message, error.status, error.code);
  }
  console.error("Room expansion failure:", error);
  return jsonError("The Room expansion service could not complete this request.", 503);
}

export async function GET(request, context) {
  const authorized = await authorize(request);
  if (!authorized.ok) return authorized.response;
  const { roomId } = await context.params;
  if (!validUuid(roomId)) return jsonError("Invalid Room id.", 400);

  try {
    const { access } = await loadExpansionAccess(roomId, authorized.userId);
    const view = request.nextUrl.searchParams.get("view") || "manifest";
    let data;
    if (view === "manifest") {
      data = await loadExpansionManifest(access, authorized.userId);
    } else if (view === "tasks") {
      data = await loadTasks(authorized.service, roomId, access, authorized.userId);
    } else if (view === "polls") {
      data = await loadPolls(authorized.service, roomId, access, authorized.userId);
    } else if (view === "forms") {
      data = await loadForms(authorized.service, roomId, access, authorized.userId);
    } else if (view === "knowledge") {
      data = await loadKnowledge(authorized.service, roomId, access);
    } else if (view === "calendar") {
      data = await loadCalendar(authorized.service, roomId, access, authorized.userId);
    } else if (view === "files") {
      data = await loadFiles(authorized.service, roomId, access, authorized.userId);
    } else if (view === "organization") {
      data = await loadOrganizationConsole(
        authorized.service,
        access,
        authorized.userId
      );
    } else if (view === "organization_search") {
      data = await searchOrganization(
        authorized.service,
        access,
        authorized.userId,
        request.nextUrl.searchParams.get("q") || ""
      );
    } else if (view === "form_export") {
      const exported = await exportFormCsv(
        authorized.service,
        roomId,
        access,
        request.nextUrl.searchParams.get("recordId") || ""
      );
      return new NextResponse(exported.csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${exported.fileName}"`,
          "Cache-Control": "private, no-store",
        },
      });
    } else {
      return jsonError("Unknown Room Studio view.", 400);
    }

    return NextResponse.json(
      { view, data },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    return expansionFailure(error);
  }
}

export async function POST(request, context) {
  const authorized = await authorize(request);
  if (!authorized.ok) return authorized.response;
  const { roomId } = await context.params;
  if (!validUuid(romId)) return jsonError("Invalid Room id.", 400);
  const body = await request.json().catch(() => ({}));

  try {
    const { access } = await loadExpansionAccess(roomId, authorized.userId);
    const result = await handleExpansionAction({
      service: authorized.service,
      access,
      userId: authorized.userId,
      body,
    });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return expansionFailure(error);
  }
}
