import type { NextConfig } from "next";

const permissionsPolicy = [
  "camera=()",
  "microphone=()",
  "geolocation=()",
  "payment=()",
  "usb=()",
  "bluetooth=()",
  "accelerometer=()",
  "gyroscope=()",
  "magnetometer=()",
  "clipboard-read=()",
  "clipboard-write=()",
].join(", ");

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "off",
  },
  {
    key: "X-Download-Options",
    value: "noopen",
  },
  {
    key: "X-Permitted-Cross-Domain-Policies",
    value: "none",
  },
  {
    key: "X-XSS-Protection",
    value: "0",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: permissionsPolicy,
  },
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin",
  },
  {
    key: "Origin-Agent-Cluster",
    value: "?1",
  },
];

const v2LegacyCleanRedirects = [
  { source: "/v2/discussions/:path*", destination: "/discussions/:path*", permanent: false },
];

const v2CleanRouteRewrites = [
  { source: "/discussions", destination: "/v2/discussions" },
  { source: "/discussions/:path*", destination: "/v2/discussions/:path*" },
  { source: "/create", destination: "/v2/create" },
  { source: "/messages", destination: "/v2/messages" },
  { source: "/people", destination: "/v2/people" },
  { source: "/saved", destination: "/v2/saved" },
  { source: "/following", destination: "/v2/following" },
  { source: "/profile", destination: "/v2/profile" },
  { source: "/my-activity", destination: "/v2/my-activity" },
  { source: "/notifications", destination: "/v2/notifications" },
  { source: "/settings", destination: "/v2/settings" },
  { source: "/support", destination: "/v2/support" },
  { source: "/premium", destination: "/v2/premium" },
  { source: "/topics", destination: "/v2/topics" },
  { source: "/privacy-security", destination: "/v2/privacy-security" },
  { source: "/home", destination: "/v2" },
  { source: "/rooms", destination: "/v2/rooms" },
  { source: "/rooms/:path*", destination: "/v2/rooms/:path*" },
  { source: "/create-room", destination: "/v2/create-room" },
  { source: "/labs", destination: "/v2/labs" },
  { source: "/labs/:path*", destination: "/v2/labs/:path*" },
  { source: "/stickies", destination: "/v2/stickies" },
  { source: "/reading-history", destination: "/v2/reading-history" },
  { source: "/my-discussions", destination: "/v2/my-discussions" },
  { source: "/my-replies", destination: "/v2/my-replies" },
  { source: "/search", destination: "/v2/search" },
  { source: "/onboarding", destination: "/v2/onboarding" },
  { source: "/admin", destination: "/v2/admin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  async redirects() {
    return v2LegacyCleanRedirects;
  },
  async rewrites() {
    return {
      beforeFiles: v2CleanRouteRewrites,
    };
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
