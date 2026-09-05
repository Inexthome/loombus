export default function DiscussionDetailLoading() {
  return (
    <main className="discussion-v2-page">
      <div className="discussion-v2-loading-shell" aria-label="Loading discussion" aria-busy="true">
        <div className="discussion-v2-skeleton discussion-v2-skeleton-short" />
        <div className="discussion-v2-skeleton discussion-v2-skeleton-title" />
        <div className="discussion-v2-skeleton discussion-v2-skeleton-line" />
        <div className="discussion-v2-skeleton discussion-v2-skeleton-line" />
        <div className="discussion-v2-skeleton discussion-v2-skeleton-card" />
      </div>
    </main>
  );
}
