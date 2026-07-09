import "./globals.css";
import "./desktop-nav-top.css";
import "./legacy-right-rail-cleanup.css";
import "./create-v2-shell.css";
import "./home-v2-shell.css";
import "./discussion-detail-shell-polish.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import ClientLayout from "./client-layout";
import { NativeBiometricSessionGate } from "@/components/native-biometric-session-gate";
import { NativePushRegistration } from "@/components/native-push-registration";

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
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <NativeBiometricSessionGate />
        <NativePushRegistration />
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
