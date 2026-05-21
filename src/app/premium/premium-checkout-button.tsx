"use client";

export function PremiumCheckoutButton() {
  return (
    <div>
      <button
        type="button"
        disabled
        className="rounded-full border border-zinc-800 px-5 py-3 text-sm text-zinc-600 disabled:cursor-not-allowed"
      >
        Premium checkout coming soon
      </button>

      <p className="mt-4 max-w-md text-sm text-zinc-500">
        Premium subscriptions are being prepared. The Premium AI-Assisted Layer
        is currently available by admin access while checkout is finalized.
      </p>
    </div>
  );
}
