# Loombus file-upload security posture

Issue: #673  
Posture version: 2026-09-01

## Production decision

Loombus **does not currently enforce malware scanning on all uploaded files**. File-type, extension, size, count, duration, account, audience, membership, storage-path, and selected stored-object metadata checks are validation controls; they are not malware scanning and must never be described as malware scanning.

The repository contains no ClamAV/VirusTotal integration, scanner dependency, scanner service configuration, scan queue, storage-event scanner, persisted malware verdict, or active quarantine workflow. Supabase Storage access control is not an antivirus service.

This is an explicit validation-only posture, not an implied partial scanner. Until an actual scanner is provisioned and enforced, no upload may be labeled `clean`, `scanned`, `malware-free`, or `quarantined` merely because validation passed.

## Shared rules

1. MIME/type/extension/size checks are validation only.
2. Private or restricted uploads must remain private at rest and may only be delivered after the existing application authorization succeeds.
3. Service-role code may bypass Storage RLS; every service-role delivery or mutation must therefore repeat the canonical application authorization before issuing a signed URL or deleting an object.
4. A public bucket is public as soon as an object is successfully uploaded. Public uploads therefore have no pre-delivery malware decision under the current posture.
5. Search, AI, extraction, or indexing must not infer trust from the existence of a storage object. Existing private/restricted authorization boundaries remain authoritative.
6. Unsupported file types fail closed at the applicable upload surface.
7. A future scanner must use `pending -> clean | rejected | failed`, keep pending/rejected/failed objects non-public, and fail closed on timeout/unavailability for surfaces represented as scan-protected.
8. Private Loombus files must not be sent to a third-party scanner until privacy/data-processing review and contractual handling are complete.

## Deterministic upload inventory

The inventory below records the production state found in the #673 repository audit. The repository verifier walks `src` for Storage upload/signed-upload, `FormData`, and file-input primitives and fails when a detected source file is not named in this document.

| Surface | Entry point / upload primitive | Bucket / path | Access model | Validation | Malware state | Delivery before malware decision | Deletion / service-role notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Public Discussion attachments (image/PDF/video) | Discussion composer through `src/lib/discussion-attachment-upload-client.ts` and `src/app/api/discussions/attachments/route.ts`; public client Storage upload | `discussion-attachments`, `${userId}/${discussionId}/...` | Public bucket for public Discussions | MIME, size, count, video duration/plan limits, ownership, storage path | `not_enforced` | **Yes**. Public object can be reachable after upload; registration validation is not a scan | API deletion removes metadata then Storage object with service role; storage-delete failure is audited/returned |
| Restricted Discussion attachments | `src/app/api/discussions/attachments/upload-url/route.ts` signed upload + shared Discussion upload client; registration in `attachments/route.ts` | `discussion-attachments-protected`, `${userId}/${discussionId}/...` | Private bucket; #672 canonical audience authorization and short-lived signed delivery | MIME, size, count, duration/plan, owner/admin, protected-bucket/path consistency | `not_enforced` | Not public, but authorized delivery can occur immediately after registration because there is no scan verdict | Service role creates upload/delivery URLs and deletes; it must preserve #672 `can_view_discussion_audience` fail-closed boundary |
| Private-message attachments | `src/app/messages/use-messages-v2.ts`, `src/app/messages/messages-v2-client.tsx`, floating-message support in `src/app/client-layout.tsx`, and `src/app/api/messages/attachments/route.ts` | `message-attachments`, `${userId}/${conversationId}/${messageId}/...` | **#673 hardening: private bucket; thread API returns short-lived signed URL only after conversation membership** | JPG/PNG/WebP/GIF/PDF, <=10 MB, <=3/message, membership, sender-owned message/path; server verifies stored object MIME/size before registration | `not_enforced` | Not public after #673; authorized participants can receive signed delivery immediately after validation | Service-role registration/delivery; failed registration removes object; bucket privacy requires migration |
| Room resources/documents/media | `src/app/api/rooms/[roomId]/resources/route.ts` signed upload, plus Room resource/document/maintenance/reservation clients listed below | `room-resources`, `${roomId}/${userId}/...` | Private; Room membership/role authorization; signed delivery | allowlisted images/video/PDF/text/CSV/Office, plan size/storage limits; stored MIME/size re-check | `not_enforced` | Not public, but authorized signed delivery begins after validation/metadata registration | Service role bypasses Storage RLS; Room access is checked before URL issuance/deletion; object removed on failed completion and delete |
| Room Discussion attachments | `src/app/api/rooms/[roomId]/discussion-attachments/route.ts` + `src/components/room-discussion-attachments.tsx` | Room Discussion attachment storage controlled by the route | Room access controlled | Route-level Room/account/file checks | `not_enforced` | Authorized Room delivery can precede any malware verdict because none exists | Service-role operations must remain Room-authorized |
| Marketplace listing photos | `src/app/api/marketplace/photos/route.ts`, `src/components/marketplace-listing-editor.tsx`, `src/components/marketplace-manager-page.tsx` | `marketplace-images`, `${userId}/${year}/...` | Public URL returned for listing media | JPEG/PNG/WebP, <=12 MB, authenticated marketplace viewer | `not_enforced` | **Yes** after upload to public media storage | DELETE verifies owner path and refuses deletion while listing references the object; service role performs Storage mutation |
| Public Request attachments | `src/app/api/requests/attachments/route.ts` | `service-request-attachments`, `${userId}/${year}/...` | Public attachment URL | JPEG/PNG/WebP/PDF, <=12 MB, account + age-safety gate, hourly upload rate limit | `not_enforced` | **Yes**. Server uploads bytes with service role then returns public URL; no malware verdict exists | DELETE verifies user path and refuses deletion while a Request references it; service-role Storage bypass is constrained in route |
| Public professional Service portfolio attachments | `src/app/api/services/attachments/route.ts` + `src/components/services-manager-page.tsx` | `provider-service-attachments`, `${userId}/${year}/...` | Public attachment URL | JPEG/PNG/WebP/PDF, <=12 MB, account + age-safety + Premium Pro/admin entitlement, hourly upload rate limit | `not_enforced` | **Yes**. Server uploads bytes with service role then returns public URL; no malware verdict exists | DELETE verifies user path and refuses deletion while a Service references it; service-role Storage bypass is constrained in route |
| Profile avatar | direct client Storage path in `src/app/profile/profile-editorial-page.tsx` + `src/app/api/profile/avatar/route.ts` URL registration | `avatars`, `${userId}/...` | Public avatar URL | profile route validates authenticated account and exact user-owned public URL prefix; client/bucket constraints remain separate | `not_enforced` | **Yes** after public upload | Existing avatar lifecycle applies; profile API is not a scanner |
| Library author cover / EPUB ingestion | `src/components/library/library-author-cover-upload.tsx`, `src/components/library/library-author-epub-upload.tsx`, `src/app/library/publish/revisions/page.tsx` | Library feature-specific buckets/paths governed by Library ingestion contract | authenticated/capability-gated according to Library routes | file-format/parser/content-contract checks | `not_enforced` | Input can be stored/processed after validation; parser/ingestion success is not antivirus scanning | Treat originals as untrusted; deletion/revision lifecycle follows Library source records |
| Admin fictional EPUB validation fixture | `src/app/api/admin/library/fictional-epub-validation/route.ts` | `LIBRARY_ORIGINALS_BUCKET`, fixed validation path | Disabled unless explicit validation flag + timing-safe token; synthetic fixture only | generated known fixture and Library ingestion contract | `not_enforced`; not a user upload | No user distribution path is created by this fixture route | Rollback removes the fixture object/source; must never be represented as malware testing |
| Support-case files | No repository-backed support-case upload route was located in the audited application API | N/A | N/A | N/A | `no_upload_found` | N/A | Support wording must not imply attachment malware scanning |
| Business / Local / Jobs | Audited server/API inventory contains no dedicated direct file-upload route for these surfaces; any media reuse must pass through a declared upload surface above | N/A unless another declared media route is reused | Existing record visibility | N/A | `no_dedicated_upload_found` | N/A | Any future direct upload primitive must be added to this inventory before merge |

## Detector source manifest

The deterministic verifier currently detects the following 30 upload-capable or upload-adjacent source files. Some are actual Storage/API upload implementations; others are UI/adapters with file inputs or `FormData`. All are intentionally named so a future newly detected file fails CI until classified.

- `src/app/api/admin/library/fictional-epub-validation/route.ts` — synthetic admin Library fixture upload/rollback.
- `src/app/api/discussions/attachments/upload-url/route.ts` — restricted Discussion signed-upload authorization.
- `src/app/api/marketplace/photos/route.ts` — Marketplace public photo upload authorization.
- `src/app/api/requests/attachments/route.ts` — public Request attachment upload/delete.
- `src/app/api/rooms/[roomId]/discussion-attachments/route.ts` — Room Discussion attachment route.
- `src/app/api/rooms/[roomId]/resources/route.ts` — private Room resource signed upload/complete/delete.
- `src/app/api/services/attachments/route.ts` — public professional Service attachment upload/delete.
- `src/app/client-layout.tsx` — floating private-message attachment client entry point.
- `src/app/library/publish/revisions/page.tsx` — Library revision upload UI.
- `src/app/messages/messages-v2-client.tsx` — private-message file-input client shell.
- `src/app/messages/use-messages-v2.ts` — private-message Storage upload and attachment registration.
- `src/app/profile/profile-editorial-page.tsx` — avatar/media client upload entry point.
- `src/app/rooms/[roomId]/documents/room-documents-client.tsx` — Room document upload UI over Room resources.
- `src/app/rooms/[roomId]/maintenance/room-maintenance-client.tsx` — Room maintenance upload-capable UI.
- `src/app/rooms/[roomId]/reservations/room-reservations-client.tsx` — Room reservation upload-capable UI.
- `src/components/create-discussion-audience-policy-guard.tsx` — Discussion composer file-input/audience guard.
- `src/components/create-discussion-composer.tsx` — Discussion attachment composer entry point.
- `src/components/create-edit-hydrator.tsx` — Discussion create/edit attachment hydration adapter.
- `src/components/create-mobile-composer-adapter.tsx` — mobile Discussion composer attachment adapter.
- `src/components/library/library-author-cover-upload.tsx` — Library cover upload component.
- `src/components/library/library-author-epub-upload.tsx` — Library EPUB upload component.
- `src/components/marketplace-listing-editor.tsx` — Marketplace file-input/upload orchestration.
- `src/components/marketplace-manager-page.tsx` — Marketplace management upload UI.
- `src/components/room-discussion-attachments.tsx` — Room Discussion attachment UI.
- `src/components/room-expansion-view-files.jsx` — legacy/expansion Room file view/upload UI.
- `src/components/room-resources-feature.tsx` — Room resource feature upload UI.
- `src/components/room-resources-workspace.tsx` — Room resource workspace upload UI.
- `src/components/services-manager-page.tsx` — professional Service attachment UI.
- `src/lib/discussion-attachment-upload-client.ts` — shared Discussion Storage upload client.
- `src/lib/room-expansion-actions-files.js` — Room expansion file action adapter.

A detected source file is not proof of a separate bucket. UI/adapter files inherit the security posture of the API/Storage path they call. The manifest exists to prevent unclassified upload entry points from being added silently.

## Quarantine and failure behavior

There is **no active malware quarantine workflow** in this posture. Consequently, there is no meaningful `pending`, `clean`, `rejected`, or `failed` malware verdict persisted today. The platform must not fabricate those statuses.

If Loombus later enables actual malware scanning:

- upload target must be private/quarantine storage;
- ordinary application delivery must be impossible while `pending`, `rejected`, or `failed`;
- timeout, engine error, unavailable service, malformed scanner response, or unsupported scanner type must not silently become `clean`;
- malicious/test-positive objects must be withheld from ordinary delivery and indexing;
- EICAR may be used for scanner verification; live malware must not be used;
- scanner provider/version/signature timestamps and the decision reason should be retained for operations;
- re-scan policy must define what happens when signatures/engines materially change.

## Privacy and data handling

Private Messages, restricted Discussions, and Room resources are private application content. A future third-party scanner would be a new processor/subprocessor path and needs privacy/data-processing review before private content is transmitted to it. Self-hosted scanning keeps file bytes within Loombus-controlled infrastructure but still requires operational access controls and logging.

The #673 hardening makes the `message-attachments` bucket private and moves normal thread delivery to short-lived signed URLs after membership authorization. Existing restricted Discussion authorization from #672 is unchanged.

## Retention, deletion, evidence, and legal hold

Normal deletion should remove both application metadata and its Storage object where the feature supports deletion. Failed uploads should be cleaned up rather than left as orphaned objects. The current validation-only posture does not preserve copies merely because a file is suspected to be malicious.

If an actual scanner later rejects an object, default handling should be delete-after-short-operational-retention, with only the minimum verdict/hash/metadata needed for abuse investigation. Raw malicious bytes should not be retained for convenience. Any legal hold or evidence preservation must be explicit, access-controlled, auditable, and must override ordinary deletion only for the required period.

## Administrator operations

Administrators must treat all user uploads as untrusted because there is no malware-clean verdict. Admin review should prefer metadata, reports, hashes, MIME/size, storage path, uploader, and authorization context rather than downloading an unknown file. An administrator must not infer safety from a successful upload or preview.

A future scanner administration surface must show verdict, engine/provider, timestamps, failure/retry state, uploader/surface, and deletion/hold state without requiring the raw file to be opened.

## Public disclosure language

Approved language:

> Loombus validates supported file types, sizes, counts, access rules, and selected upload metadata. Loombus does not currently enforce malware scanning on all uploaded files. An accepted file is not a guarantee that the file is safe; use caution with unexpected files, links, macros, QR codes, and downloads.

Do not say that Loombus "scans uploads for malware", "virus scans files", "quarantines suspicious uploads", or marks files "clean" unless an actual scanner and quarantine decision are enforced for the described surface.

## Scanner adoption gate

Do not change `malwareScanning` in `src/lib/file-security-posture.ts` from `not_enforced` until all of the following are implemented and tested together: private pending storage, persisted decisions, actual engine/provider, fail-closed timeout/error handling, clean-only promotion/delivery, malicious/test-positive handling, deletion/retention, admin status, Search/AI exclusion, privacy review, and EICAR verification.
