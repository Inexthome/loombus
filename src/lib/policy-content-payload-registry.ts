import "server-only";

import accessibilityPayload202607181 from "@/content/policies/POLICY-ACCESSIBILITY/2026.07.18.1.json";
import accessibilityPayload202608101 from "@/content/policies/POLICY-ACCESSIBILITY/2026.08.10.1.json";
import {
  validateStructuredPolicyPayload,
  type StructuredPolicyPayload,
} from "@/lib/policy-content-payload";

export type PolicyPayloadSource = {
  documentId: string;
  version: string;
  payloadPath: string;
  payload: StructuredPolicyPayload;
};

const RAW_POLICY_PAYLOAD_SOURCES: Readonly<
  Record<
    string,
    {
      documentId: string;
      version: string;
      payloadPath: string;
      payload: unknown;
    }
  >
> = {
  "POLICY-ACCESSIBILITY:2026.07.18.1": {
    documentId: "POLICY-ACCESSIBILITY",
    version: "2026.07.18.1",
    payloadPath:
      "src/content/policies/POLICY-ACCESSIBILITY/2026.07.18.1.json",
    payload: accessibilityPayload202607181,
  },
  "POLICY-ACCESSIBILITY:2026.08.10.1": {
    documentId: "POLICY-ACCESSIBILITY",
    version: "2026.08.10.1",
    payloadPath:
      "src/content/policies/POLICY-ACCESSIBILITY/2026.08.10.1.json",
    payload: accessibilityPayload202608101,
  },
};

function sourceKey(documentId: string, version: string) {
  return `${documentId}:${version}`;
}

export function getPolicyPayloadSource(
  documentId: string,
  version: string,
): PolicyPayloadSource | null {
  const raw = RAW_POLICY_PAYLOAD_SOURCES[sourceKey(documentId, version)];
  if (!raw) return null;

  const validation = validateStructuredPolicyPayload(raw.payload);
  if (!validation.ok) return null;

  const payload = validation.payload;
  if (
    payload.documentId !== raw.documentId ||
    payload.version !== raw.version
  ) {
    return null;
  }

  return {
    documentId: raw.documentId,
    version: raw.version,
    payloadPath: raw.payloadPath,
    payload,
  };
}
