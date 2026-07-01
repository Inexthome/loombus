import "./globals.css";
import "./v2-mobile-theme-fixes.css";
import "./v2-public-landing-theme.css";
import "./v2-public-signed-out-theme.css";
import "./v2-public-final-contrast.css";
import "./v2-public-landing-login-readability.css";
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
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: siteUrl,
    siteName: siteTitle,
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Loombus",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/twitter-image"],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ClientLayout>
          <NativeBiometricSessionGate />
          <NativePushRegistration />
          {children}
        </ClientLayout>
      </body>
    </html>
  );
}
