import { Suspense } from "react";
import { LibraryReplyFeedbackSurface } from "@/components/library/library-reply-feedback-surface";

export default function LibraryResearchFromReplyPage() {
  return (
    <Suspense fallback={null}>
      <LibraryReplyFeedbackSurface />
    </Suspense>
  );
}
