import "server-only";

import { randomUUID } from "node:crypto";
import { ACCEPTED_ROOM_MIME_TYPES, ROOM_RESOURCE_BUCKET, ExpansionError, cleanText, ensureRoomModule, mediaKind, normalizeFolderPath, randomStoragePath, resourceUsage, safeFileName, storedObjectInfo, uploadMimeType, validUuid } from "@/lib/room-expansion-service";
import { asString } from "@/lib/room-operations";
import { activeRoom } from "@/lib/room-expansion-actions-shared";

export async function prepareFileUpload(service, access, body) {
  const plan = ensureRoomModule(access, "files");
  activeRoom(access);
  if (!plan.fileUploads) throw new ExpansionError("File uploads are not enabled.", 403);
  const fileName = safeFileName(body.fileName);
  const mimeType = uploadMimeType(fileName, body.mimeType);
  const size = Number(body.fileSizeBytes ?? 0);
  const kind = mediaKind(mimeType);
  if (!ACCEPTED_ROOM_MIME_TYPES.has(mimeType)) {
    throw new ExpansionError("This file type is not supported.", 400);
  }
  if (kind === "video" && !plan.inlineVideo) {
    throw new ExpansionError("Inline video is not included in this plan.", 403);
  }
  if (!Number.isSafeInteger(size) || size <= 0 || size > plan.maxFileBytes) {
    throw new ExpansionError("The file exceeds this Room plan's upload limit.", 413);
  }
  const used = await resourceUsage(service, access.room.id);
  if (used + size > plan.storageBytes) {
    throw new ExpansionError("This Room has reached its storage allowance.", 413);
  }
  let replaceResource = null;
  if (validUuid(body.replaceResourceId)) {
    const result = await service
      .from("room_resources")
      .select("*")
      .eq("id", body.replaceResourceId)
      .eq("room_id", access.room.id)
      .maybeSingle();
    if (result.error || !result.data) {
      throw new ExpansionError("The file version target was not found.", 404);
    }
    replaceResource = result.data;
  }
  const storagePath = randomStoragePath(access.room.id, fileName);
  const signed = await service.storage
    .from(ROOM_RESOURCE_BUCKET)
    .createSignedUploadUrl(storagePath);
  if (signed.error || !signed.data?.token) {
    throw new ExpansionError("A secure upload could not be prepared.", 503);
  }
  return {
    ok: true,
    storagePath,
    token: signed.data.token,
    fileName,
    mimeType,
    fileSizeBytes: size,
    mediaKind: kind,
    folderPath: replaceResource
      ? normalizeFolderPath(replaceResource.folder_path)
      : normalizeFolderPath(body.folderPath),
    replaceResourceId: replaceResource?.id ?? null,
    versionGroupId:
      replaceResource?.version_group_id ?? replaceResource?.id ?? randomUUID(),
    versionNumber: replaceResource
      ? Math.max(1, Number(replaceResource.version_number ?? 1)) + 1
      : 1,
  };
}

export async function completeFileUpload(service, access, userId, body) {
  const plan = ensureRoomModule(access, "files");
  activeRoom(access);
  const storagePath = cleanText(body.storagePath, 700);
  if (!storagePath.startsWith(`${access.room.id}/`)) {
    throw new ExpansionError("Invalid Room upload path.", 400);
  }
  const fileName = safeFileName(body.fileName);
  const mimeType = uploadMimeType(fileName, body.mimeType);
  const kind = mediaKind(mimeType);
  const expectedSize = Number(body.fileSizeBytes ?? 0);
  const object = await storedObjectInfo(service, storagePath);
  if (!object || object.sizeBytes <= 0) {
    throw new ExpansionError("The uploaded object could not be verified.", 409);
  }
  if (object.sizeBytes !== expectedSize || object.sizeBytes > plan.maxFileBytes) {
    await service.storage.from(ROOM_RESOURCE_BUCKET).remove([storagePath]);
    throw new ExpansionError("The uploaded file size did not match the prepared upload.", 409);
  }
  if (object.mimeType && object.mimeType !== mimeType) {
    await service.storage.from(ROOM_RESOURCE_BUCKET).remove([storagePath]);
    throw new ExpansionError("The uploaded file type did not match the prepared upload.", 409);
  }
  if (!ACCEPTED_ROOM_MIME_TYPES.has(mimeType) || (kind === "video" && !plan.inlineVideo)) {
    await service.storage.from(ROOM_RESOURCE_BUCKET).remove([storagePath]);
    throw new ExpansionError("The uploaded file type is not allowed.", 400);
  }
  const used = await resourceUsage(service, access.room.id);
  if (used + object.sizeBytes > plan.storageBytes) {
    await service.storage.from(ROOM_RESOURCE_BUCKET).remove([storagePath]);
    throw new ExpansionError("This Room has reached its storage allowance.", 413);
  }
  let replace = null;
  if (validUuid(body.replaceResourceId)) {
    const result = await service
      .from("room_resources")
      .select("*")
      .eq("id", body.replaceResourceId)
      .eq("room_id", access.room.id)
      .maybeSingle();
    if (result.error || !result.data) {
      await service.storage.from(ROOM_RESOURCE_BUCKET).remove([storagePath]);
      throw new ExpansionError("The file version target was not found.", 404);
    }
    replace = result.data;
  }
  const versionGroupId = replace?.version_group_id ?? replace?.id ?? randomUUID();
  const versionNumber = replace
    ? Math.max(1, Number(replace.version_number ?? 1)) + 1
    : 1;
  const inserted = await service
    .from("room_resources")
    .insert({
      room_id: access.room.id,
      uploaded_by: userId,
      file_name: fileName,
      storage_path: storagePath,
      mime_type: mimeType,
      media_kind: kind,
      file_size_bytes: object.sizeBytes,
      folder_path: replace
        ? normalizeFolderPath(replace.folder_path)
        : normalizeFolderPath(body.folderPath),
      version_group_id: versionGroupId,
      version_number: versionNumber,
      replaces_resource_id: replace?.id ?? null,
      is_current: true,
    })
    .select("id")
    .single();
  if (inserted.error) {
    await service.storage.from(ROOM_RESOURCE_BUCKET).remove([storagePath]);
    throw new ExpansionError(inserted.error.message, 503);
  }
  if (replace) {
    const retired = await service
      .from("room_resources")
      .update({ is_current: false })
      .eq("id", replace.id)
      .eq("room_id", access.room.id);
    if (retired.error) {
      await service.from("room_resources").delete().eq("id", inserted.data.id);
      await service.storage.from(ROOM_RESOURCE_BUCKET).remove([storagePath]);
      throw new ExpansionError(retired.error.message, 503);
    }
  }
  return { ok: true, resourceId: inserted.data.id };
}

export async function moveFile(service, access, userId, body) {
  ensureRoomModule(access, "files");
  activeRoom(access);
  if (!validUuid(body.resourceId)) throw new ExpansionError("Invalid file.", 400);
  const result = await service
    .from("room_resources")
    .select("uploaded_by")
    .eq("id", body.resourceId)
    .eq("room_id", access.room.id)
    .maybeSingle();
  if (result.error || !result.data) throw new ExpansionError("File not found.", 404);
  if (!access.canManage && asString(result.data.uploaded_by) !== userId) {
    throw new ExpansionError("Only the uploader or a Room manager can move this file.", 403);
  }
  const moved = await service
    .from("room_resources")
    .update({ folder_path: normalizeFolderPath(body.folderPath) })
    .eq("id", body.resourceId)
    .eq("room_id", access.room.id);
  if (moved.error) throw new ExpansionError(moved.error.message, 503);
  return { ok: true };
}
