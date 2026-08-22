import { Suspense } from "react";
import { LibraryDiscussionFeedbackSurface } from "@/components/library/library-discussion-feedback-surface";

export default function LibraryDiscussionFeedbackPage() {
  return (
    <Suspense fallback={null}>
      <LibraryDiscussionFeedbackSurface />
    </Suspense>
  );
}
