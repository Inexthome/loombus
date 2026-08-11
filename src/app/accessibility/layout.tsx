import type { ReactNode } from "react";
import { StructuredPolicyRenderer } from "@/components/policy-content/structured-policy-renderer";
import { resolvePolicyCanonicalRoutePayload } from "@/lib/policy-content-canonical-route";

export default function AccessibilityLayout({
  children,
}: {
  children: ReactNode;
}) {
  const resolution = resolvePolicyCanonicalRoutePayload(
    "POLICY-ACCESSIBILITY",
  );

  if (!resolution.resolved || !resolution.payload) {
    return children;
  }

  return <StructuredPolicyRenderer payload={resolution.payload} />;
}
