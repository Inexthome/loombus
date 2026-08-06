"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function DiscussionMobileBackNavigation() {
  const router = useRouter();

  const handleBack = () => {
    const referrer = document.referrer;

    if (referrer) {
      try {
        const previousUrl = new URL(referrer);
        const cameFromLoombus = previousUrl.origin === window.location.origin;
        const isDifferentPage = previousUrl.pathname !== window.location.pathname;

        if (cameFromLoombus && isDifferentPage && window.history.length > 1) {
          router.back();
          return;
        }
      } catch {
        // Fall through to the canonical discussions route.
      }
    }

    router.push("/discussions");
  };

  return (
    <div className="discussion-mobile-back-navigation">
      <button type="button" onClick={handleBack} aria-label="Back to discussions">
        <ArrowLeft aria-hidden="true" size={18} strokeWidth={2.25} />
        <span>Discussions</span>
      </button>
    </div>
  );
}
