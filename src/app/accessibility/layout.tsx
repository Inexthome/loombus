import type { ReactNode } from "react";
import { PolicyAnalyticsView } from "@/components/policy-content/policy-analytics-view";
import { PolicyChangeNote } from "@/components/policy-content/policy-change-note";
import { StructuredPolicyRenderer } from "@/components/policy-content/structured-policy-renderer";
import { resolvePolicyCanonicalRoutePayload } from "@/lib/policy-content-canonical-route";
import { policyHistoryHref } from "@/lib/policy-content-history";

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
  if (!resolution.version) {
    return children;
  }

  return (
    <>
      <PolicyAnalyticsView
        surface="current"
        documentId={resolution.version.documentId}
        version={resolution.version.version}
      />
      <PolicyChangeNote
        changeNote={resolution.version.changeNote}
        version={resolution.version.version}
        historyHref={policyHistoryHref(resolution.version.documentId)}
      />
      <StructuredPolicyRenderer payload={resolution.payload} />
    </>
  );
}
