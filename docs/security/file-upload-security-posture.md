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

The inventory below records the production state found in the #673 repository audit. A verification script guards the high-confidence upload primitives and the public disclosure language so future scanner claims cannot be introduced accidentally.

| Surface | Entry point / upload primitive | Bucket / path | Access model | Validation | Malware state | Delivery before malware decision | Deletion / service-role notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Public Discussion attachments (image/PDF/video) | Discussion composer + `src/app/api/discussions/attachments/route.ts`; public client Storage upload | `discussion-attachments`, `${userId}/${discussionId}/...` | Public bucket for public Discussions | MIME, size, count, video duration/plan limits, ownership, storage path | `not_enforced` | **Yes**. Public object can be reachable after upload; registration validation is not a scan | API deletion removes metadata then Storage object with service role; storage-delete failure is audited/returned |
| Restricted Discussion attachments | `src/app/api/discussions/attachments/upload-url/route.ts` signed upload; registration in `attachments/route.ts` | `discussion-attachments-protected`, `${userId}/${discussionId}/...` | Private bucket; #672 canonical audience authorization and short-lived signed delivery | MIME, size, count, duration/plan, owner/admin, protected-bucket/path consistency | `not_enforced` | Not public, but authorized delivery can occur immediately after registration because there is no scan verdict | Service role creates upload/delivery URLs and deletes; it must preserve #672 `can_view_discussion_audience` fail-closed boundary |
| Private-message attachments | `src/app/messages/use-messages-v2.ts` + `src/app/api/messages/attachments/route.ts` | `message-attachments`, `${userId}/${conversationId}/${messageId}/...` | **#673 hardening: private bucket; thread API returns short-lived signed URL only after conversation membership** | JPG/PNG/WebP/GIF/PDF, <=10 MB, <=3/message, membership, owner path; server verifies stored object metadata before registration | `not_enforced` | Not public after #673; authorized participants can receive signed delivery immediately after validation | Service-role registration/delivery; failed registration removes object; bucket privacy requires migration |
| Room resources/documents/media | `src/app/api/rooms/[roomId]/resources/route.ts` signed upload, then `complete_upload` | `room-resources`, `${roomId}/${userId}/...` | Private; Room membership/role authorization; signed delivery | allowlisted images/video/PDF/text/CSV/Office, plan size/storage limits; stored MIME/size re-check | `not_enforced` | Not public, but authorized signed delivery begins after validation/metadata registration | Service role bypasses Storage RLS; Room access is checked before URL issuance/deletion; object removed on failed completion and delete |
| Room Discussion attachments | `src/app/api/rooms/[roomId]/discussion-attachments/route.ts` | Room attachment storage used by Room discussion feature | Room access controlled | Route-level Room/account/file checks | `not_enforced` | Authorized Room delivery can precede any malware verdict because none exists | Service-role operations must remain Room-authorized |
| Marketplace listing photos | `src/app/api/marketplace/photos/route.ts` signed upload | `marketplace-images`, `${userId}/${year}/...` | Public URL returned for listing media | JPEG/PNG/WebP, <=12 MB, authenticated marketplace viewer | `not_enforced` | **Yes** after upload to the public media bucket | DELETE verifies owner path and refuses deletion while listing references the object; service role performs Storage mutation |
| Profile avatar | client Storage upload + `src/app/api/profile/avatar/route.ts` URL registration | `avatars`, `${userId}/...` | Public avatar URL | profile route validates authenticated account and exact user-owned public URL prefix; client/bucket constraints remain separate | `not_enforced` | **Yes** after public upload | Existing avatar lifecycle applies; profile API is not a scanner |
| Business / Local / Jobs / Requests | Audited API trees contain data routes but no dedicated upload route in the audited server subtrees | N/A unless a UI reuses another declared media route | Existing record visibility | N/A | `no_dedicated_upload_found` | N/A | Any future direct upload primitive must be added to this inventory before merge |
| Support-case files | No repository-backed support-case upload route was located in the audited application API | N/A | N/A | N/A | `no_upload_found` | N/A | Support wording must not imply attachment malware scanning |
| Library ingestion/import | Authenticated Library ingestion/parser paths are separate content-ingestion capabilities; they are not a general-purpose Storage malware scanner | feature-specific | authenticated/capability-gated | format/parser-specific | `not_enforced` | Input may be processed after format checks; parsing is not antivirus scanning | Treat imported content as untrusted; do not reuse parser success as a malware verdict |

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
