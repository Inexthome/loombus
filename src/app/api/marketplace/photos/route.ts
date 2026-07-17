import { NextRequest, NextResponse } from "next/server";
import {
  MarketplaceError,
  cleanMarketplaceText,
  resolveMarketplaceViewer,
} from "@/lib/marketplace-server";

const MAX_PHOTO_BYTES = 12 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function response(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function errorResponse(error: unknown) {
  if (error instanceof MarketplaceError) {
    return response({ error: error.message, code: error.code }, error.status);
  }
  console.error("Marketplace photo request failed:", error);
  return response(
    { error: "The Marketplace photo request failed.", code: "photo_failed" },
    500
  );
}

function safeFilename(value: string) {
  const cleaned = value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return cleaned || "marketplace-photo";
}

export async function POST(request: NextRequest) {
  try {
    const viewer = await resolveMarketplaceViewer(request, true);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new MarketplaceError(
        "Choose a Marketplace photo.",
        400,
        "photo_required"
      );
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      throw new MarketplaceError(
        "Marketplace photos must be JPEG, PNG, or WebP.",
        400,
        "photo_type_not_allowed"
      );
    }
    if (file.size <= 0 || file.size > MAX_PHOTO_BYTES) {
      throw new MarketplaceError(
        "Each Marketplace photo must be 12 MB or smaller.",
        400,
        "photo_too_large"
      );
    }

    const extension =
      file.type === "image/png" ? ".png" : file.type === "image/webp" ? ".webp" : ".jpg";
    const rawName = safeFilename(file.name.replace(/\.[^.]+$/, ""));
    const path = `${viewer.user!.id}/${new Date().getUTCFullYear()}/${crypto.randomUUID()}-${rawName}${extension}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error } = await viewer.service.storage
      .from("marketplace-images")
      .upload(path, bytes, {
        contentType: file.type,
        upsert: false,
        cacheControl: "31536000",
      });
    if (error) {
      throw new MarketplaceError(
        "Unable to upload the Marketplace photo.",
        503,
        "photo_upload_failed"
      );
    }
    const { data } = viewer.service.storage
      .from("marketplace-images")
      .getPublicUrl(path);
    return response({ photo: { path, url: data.publicUrl } }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const viewer = await resolveMarketplaceViewer(request, true);
    const body = await request.json().catch(() => null);
    const path = cleanMarketplaceText(
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>).path
        : "",
      500
    );
    if (!path || !path.startsWith(`${viewer.user!.id}/`)) {
      throw new MarketplaceError(
        "This Marketplace photo cannot be removed.",
        403,
        "photo_forbidden"
      );
    }
    const { data: attached } = await viewer.service
      .from("marketplace_listings")
      .select("id")
      .contains("photo_paths", [path])
      .limit(1);
    if ((attached ?? []).length > 0) {
      throw new MarketplaceError(
        "Remove the photo from the listing before deleting it.",
        409,
        "photo_in_use"
      );
    }
    const { error } = await viewer.service.storage
      .from("marketplace-images")
      .remove([path]);
    if (error) {
      throw new MarketplaceError(
        "Unable to delete the Marketplace photo.",
        503,
        "photo_delete_failed"
      );
    }
    return response({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
