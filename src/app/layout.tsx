import "./globals.css";
import "./v2-mobile-theme-fixes.css";
import "./v2-public-landing-theme.css";
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
      <body className="bg-black text-white antialiased">
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
        <ClientLayout>{children}</ClientLayout>
        <NativeBiometricSessionGate />
        <NativePushRegistration />
      </body>
    </html>
  );
}
