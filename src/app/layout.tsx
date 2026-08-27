import "./globals.css";
import "./loombus-brand-accent.css";
import "./desktop-navigation-shell.css";
import "./mobile-navigation-shell.css";
import "./adaptive-shell-controls.css";
import "./persistent-mobile-primary-dock.css";
import "./persistent-quick-rail.css";
import "./legacy-right-rail-cleanup.css";
import "./create-v2-shell.css";
import "./create-flat-sections.css";
import "./discussion-audience-controls.css";
import "./home-v2-shell.css";
import "./home-mobile-viewport-fix.css";
import "./mobile-card-polish.css"; // Mobile-only Home and Create card refinements.
import "./people-v2-shell.css";
import "./discussion-detail-shell-polish.css";
import "./loombus-brand-correction.css";
import "./auth-account-v2.css";
import "./trust-safety-appearance-fixes.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import RouteClientLayout from "./route-client-layout";
import { AdaptiveFloatingUtilityLauncher } from "@/components/adaptive-floating-utility-launcher";
import { AppChromeBoundary } from "@/components/app-chrome-boundary";
import { AuthSessionCleanup } from "@/components/auth-session-cleanup";
import { CanonicalAppHomeLinks } from "@/components/canonical-app-home-links";
import { DesktopAccountAutoCloseController } from "@/components/desktop-account-auto-close-controller";
import { DesktopMessagesPreviewTrayController } from "@/components/desktop-messages-preview-tray-controller";
import { DesktopNotificationsTrayController } from "@/components/desktop-notifications-tray-controller";
import { DesktopNavigationShell } from "@/components/desktop-navigation-shell";
import { MobileNavigationShell } from "@/components/mobile-navigation-shell";
import { NativeBiometricSessionGate } from "@/components/native-biometric-session-gate";
import { NativePushRegistration } from "@/components/native-push-registration";
import { PersistentMobilePrimaryDock } from "@/components/persistent-mobile-primary-dock";
import { PlatformNativeAlertBridge } from "@/components/platform-native-alert-bridge";
import { PlatformPromptBridge } from "@/components/platform-prompt-bridge";
import { PlatformPromptDomBridge } from "@/components/platform-prompt-dom-bridge";
import { SessionLifecycleGuard } from "@/components/session-lifecycle-guard";
import { WelcomeEmailTrigger } from "@/components/welcome-email-trigger";

const siteUrl = "https://loombus.com";
const siteTitle = "Loombus";
const siteSocialTitle = "Loombus | Signal over noise";
const siteDescription =
  "Loombus is a signal-first platform where ideas become structured conversations, stronger understanding, meaningful connections, and real opportunities.";

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
  title: { default: siteTitle, template: `%s | ${siteTitle}` },
  description: siteDescription,
  applicationName: siteTitle,
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: siteTitle, statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  openGraph: {
    title: siteSocialTitle,
    description: siteDescription,
    url: siteUrl,
    siteName: siteTitle,
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: "Loombus, a signal-first platform where ideas move forward" }],
    type: "website",
  },
  twitter: { card: "summary_large_image", title: siteSocialTitle, description: siteDescription, images: ["/opengraph-image.png"] },
  icons: { icon: "/icon.png", apple: "/apple-icon.png", shortcut: "/favicon.ico" },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-[color:var(--loombus-page-bg)] text-[color:var(--loombus-text)] antialiased">
        <script dangerouslySetInnerHTML={{ __html: `
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
        ` }} />
        <AppChromeBoundary>
          <DesktopNavigationShell />
          <DesktopAccountAutoCloseController />
          <DesktopMessagesPreviewTrayController />
          <DesktopNotificationsTrayController />
          <MobileNavigationShell />
          <PersistentMobilePrimaryDock />
        </AppChromeBoundary>
        <RouteClientLayout>{children}</RouteClientLayout>
        <PlatformPromptBridge />
        <PlatformPromptDomBridge />
        <PlatformNativeAlertBridge />
        <AppChromeBoundary><AdaptiveFloatingUtilityLauncher /></AppChromeBoundary>
        <CanonicalAppHomeLinks />
        <AuthSessionCleanup />
        <SessionLifecycleGuard />
        <WelcomeEmailTrigger />
        <NativeBiometricSessionGate />
        <NativePushRegistration />
      </body>
    </html>
  );
}
