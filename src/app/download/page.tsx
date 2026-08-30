import type { Metadata } from "next";
import Link from "next/link";

const iosAppStoreUrl = "https://apps.apple.com/us/app/loombus/id6774788429";
const googlePlayUrl =
  "https://play.google.com/store/apps/details?id=com.loombus.app";

function qrCodeUrl(url: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=16&data=${encodeURIComponent(
    url
  )}`;
}

const downloadOptions = [
  {
    platform: "iPhone",
    label: "Open in the App Store",
    href: iosAppStoreUrl,
    qrAlt: "QR code for opening Loombus in the App Store",
    description:
      "Open the App Store link on your iPhone, or scan the code with your camera to find Loombus.",
    note: "The link opens the official Loombus App Store listing.",
  },
  {
    platform: "Android",
    label: "Open in Google Play",
    href: googlePlayUrl,
    qrAlt: "QR code for opening Loombus in Google Play",
    description:
      "Open the Google Play link on your Android phone, or scan the code to check the Loombus listing.",
    note: "The link opens the official Loombus Google Play listing.",
  },
];

export const metadata: Metadata = {
  title: "Download Loombus | Loombus",
  description:
    "Download Loombus for iPhone and Android to explore structured discussions, Library, The Floor, private Rooms, meaningful connections, and real-world opportunities.",
  alternates: {
    canonical: "https://loombus.com/download",
  },
};

export default function DownloadPage() {
  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-6 text-[var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center border-b border-[var(--loombus-border)] text-sm font-semibold text-[var(--loombus-text-muted)] transition-colors hover:border-[#cbab5b] hover:text-[#cbab5b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#cbab5b]"
        >
          ← Back to Loombus
        </Link>

        <header className="border-b border-[var(--loombus-border)] pb-8 pt-10 sm:pb-10 sm:pt-14">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#cbab5b]">
            Download
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-[-0.04em] sm:text-5xl lg:text-6xl">
            Download Loombus
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-[var(--loombus-text-muted)] sm:text-lg">
            Read and discuss publications in Library, research investments on The
            Floor, join structured discussions and Rooms, and discover meaningful
            connections and real-world opportunities in one signal-first platform.
          </p>
        </header>

        <section aria-label="Download options" className="divide-y divide-[var(--loombus-border)]">
          {downloadOptions.map((option) => (
            <article
              key={option.platform}
              className="grid gap-8 py-8 sm:py-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-14"
            >
              <div className="min-w-0">
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#cbab5b]">
                  Platform
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em] sm:text-3xl">
                  {option.platform}
                </h2>
                <p className="mt-4 max-w-2xl leading-7 text-[var(--loombus-text-muted)]">
                  {option.description}
                </p>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--loombus-text-subtle)]">
                  {option.note}
                </p>

                <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3">
                  <a
                    href={option.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center border-b-2 border-[#cbab5b] py-2 text-sm font-extrabold text-[var(--loombus-text)] transition-colors hover:text-[#cbab5b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#cbab5b]"
                  >
                    {option.label}
                  </a>
                  <Link
                    href="/signup"
                    className="inline-flex min-h-11 items-center border-b border-[var(--loombus-border)] py-2 text-sm font-semibold text-[var(--loombus-text-muted)] transition-colors hover:border-[#cbab5b] hover:text-[#cbab5b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#cbab5b]"
                  >
                    Create an account
                  </Link>
                </div>
              </div>

              <div className="w-fit border-l-2 border-[#cbab5b] pl-5 sm:pl-6">
                <p className="mb-4 text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--loombus-text-muted)]">
                  Scan with your phone
                </p>
                <div className="bg-white p-3">
                  <img
                    src={qrCodeUrl(option.href)}
                    alt={option.qrAlt}
                    width={220}
                    height={220}
                    className="h-44 w-44 sm:h-52 sm:w-52"
                  />
                </div>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
