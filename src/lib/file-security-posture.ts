export const FILE_SECURITY_POSTURE = {
  version: "2026-09-01",
  malwareScanning: "not_enforced",
  quarantine: "not_active",
  validation: "surface_specific",
  disclosure:
    "Loombus validates supported file types, sizes, counts, access rules, and selected stored-object metadata. Loombus does not currently enforce malware scanning on all uploaded files, so an accepted upload must not be treated as malware-scanned or certified safe.",
  operations: {
    scannerFailurePolicy:
      "No malware scanner is currently in the acceptance path. If scanning is introduced, scanner timeout, error, or unavailability must fail closed for surfaces declared scan-protected; it must never silently produce a clean decision.",
    quarantinePolicy:
      "No production quarantine state is currently active. A future quarantine implementation must use non-public storage and must not issue ordinary delivery URLs until a clean decision is persisted.",
    privateUploadPolicy:
      "Restricted files must remain in private storage and be delivered only after the existing audience or membership authorization succeeds.",
    indexingPolicy:
      "Files that are private, pending review, rejected, or otherwise unavailable to a viewer must not be added to Search or AI context merely because a storage object exists.",
  },
} as const;

export type FileSecurityPosture = typeof FILE_SECURITY_POSTURE;
