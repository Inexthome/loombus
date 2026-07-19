import "./globals.css";
import "./loombus-brand-accent.css";
import "./desktop-top-navbar.css";
import "./mobile-navigation-shell.css";
import "./legacy-right-rail-cleanup.css";
import "./create-v2-shell.css";
import "./home-v2-shell.css";
import "./home-mobile-viewport-fix.css";
import "./people-v2-shell.css";
import "./discussion-detail-shell-polish.css";
import "./loombus-brand-correction.css";
import "./auth-account-v2.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import ClientLayout from "./client-layout";
import { AuthSessionCleanup } from "@/components/auth-session-cleanup";
import { CanonicalAppHomeLinks } from "@/components/canonical-app-home-links";
import { DesktopTopNavbar } from "@/components/desktop-top-navbar";
import { MobileNavigationShell } from "@/components/mobile-navigation-shell";
import { NativeBiometricSessionGate } from "@/components/native-biometric-session-gate";
import { NativePushRegistration } from "@/components/native-push-registration";
import { SessionLifecycleGuard } from "@/components/session-lifecycle-guard";

const siteUrl = "https://loombus.com";
const siteTitle = "Loombus";
const siteDescription = "A high-signal discussion platform for thoughtful conversations.";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: "#000000",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteTitle,
    template: `%s | ${siteTitle}`,
  },
  description: siteDescription,
  applicationName: siteTitle,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: siteTitle,
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: siteUrl,
    siteName: siteTitle,
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "Loombus",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/opengraph-image.png"],
  },
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
    shortcut: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-[color:var(--loombus-page-bg)] text-[color:var(--loombus-text)] antialiased">
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (() => {
                try {
                  const stored = window.localStorage.getItem("loombus:appearance");
                  const allowed = ["system", "dark", "light"];
                  const mode = allowed.includes(stored || "") ? stored : "system";
                  document.documentElement.dataset.loombusTheme = mode || "system";
                } catch {
                  document.documentElement.dataset.loombusTheme = "system";
                }
              })();
            `,
          }}
        />
        <DesktopTopNavbar />
        <MobileNavigationShell />
        <ClientLayout>{children}</ClientLayout>
        <CanonicalAppHomeLinks />
        <AuthSessionCleanup />
        <SessionLifecycleGuard />
        <NativeBiometricSessionGate />
        <NativePushRegistration />
      </body>
    </html>
  );
}
