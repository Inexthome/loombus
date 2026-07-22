import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, PageShell, Panel } from "@/components/ui";

const iosAppStoreUrl = "https://apps.apple.com/us/search?term=loombus";
const googlePlayUrl =
  "https://play.google.com/store/apps/details?id=com.loombus.mobile";

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
    note:
      "If the direct app listing does not appear yet, search for “Loombus” in the App Store.",
  },
  {
    platform: "Android",
    label: "Open in Google Play",
    href: googlePlayUrl,
    qrAlt: "QR code for opening Loombus in Google Play",
    description:
      "Open the Google Play link on your Android phone, or scan the code to check the Loombus listing.",
    note:
      "Android public release is still being prepared. If you are a tester, use the Google Play testing access assigned to your account.",
  },
];

export const metadata: Metadata = {
  title: "Download Loombus | Loombus",
  description:
    "Download Loombus for iPhone and Android to explore structured discussions, private Rooms, local discovery, services, events, jobs, Marketplace listings, and more in one signal-first platform.",
  alternates: {
    canonical: "https://loombus.com/download",
  },
};

export default function DownloadPage() {
  return (
    <PageShell width="lg">
      <Link
        href="/"
        className="mb-10 inline-block text-sm text-[var(--loombus-text-muted)] hover:text-[var(--loombus-text)]"
      >
        ← Back to Loombus
      </Link>

      <PageHeader
        eyebrow="Download"
        title="Download Loombus"
        description={
          <>
            Get Loombus on mobile and bring structured discussions, private
            Rooms, local discovery, services, events, jobs, Marketplace, and
            useful connections into one signal-first platform.
          </>
        }
      />

      <div className="grid gap-6 md:grid-cols-2">
        {downloadOptions.map((option) => (
          <Panel key={option.platform}>
            <div className="flex h-full flex-col gap-6">
              <div>
                <h2 className="mb-4 text-2xl font-semibold text-[var(--loombus-text)]">
                  {option.platform}
                </h2>

                <p className="leading-relaxed text-[var(--loombus-text-muted)]">
                  {option.description}
                </p>

                <p className="mt-4 text-sm leading-relaxed text-[var(--loombus-text-subtle)]">
                  {option.note}
                </p>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <a
                  href={option.href}
                  target="_blank"
                  rel="noreferrer"
                  className="loombus-store-primary-cta inline-flex justify-center rounded-full px-5 py-3 text-sm font-semibold transition hover:opacity-90"
                >
                  {option.label}
                </a>

                <Link
                  href="/signup"
                  className="loombus-store-secondary-cta inline-flex justify-center rounded-full border px-5 py-3 text-sm font-semibold transition hover:bg-[var(--loombus-surface-muted)]"
                >
                  Create an account
                </Link>
              </div>

              <div className="rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] p-5">
                <p className="mb-4 text-sm font-medium text-[var(--loombus-text-muted)]">
                  Scan with your phone
                </p>

                <div className="inline-flex rounded-2xl bg-white p-4">
                  <img
                    src={qrCodeUrl(option.href)}
                    alt={option.qrAlt}
                    width={220}
                    height={220}
                    className="h-44 w-44 sm:h-52 sm:w-52"
                  />
                </div>
              </div>
            </div>
          </Panel>
        ))}
      </div>
    </PageShell>
  );
}
