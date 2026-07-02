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

const v2PublicRouteRewrites = [
  { source: "/home", destination: "/v2" },
  { source: "/discussions", destination: "/v2/discussions" },
  { source: "/discussions/:path*", destination: "/v2/discussions/:path*" },
  { source: "/create", destination: "/v2/create" },
  { source: "/rooms", destination: "/v2/rooms" },
  { source: "/rooms/:path*", destination: "/v2/rooms/:path*" },
  { source: "/messages", destination: "/v2/messages" },
  { source: "/people", destination: "/v2/people" },
  { source: "/people/:path*", destination: "/v2/people/:path*" },
  { source: "/labs", destination: "/v2/labs" },
  { source: "/labs/:path*", destination: "/v2/labs/:path*" },
  { source: "/topics", destination: "/v2/topics" },
  { source: "/topics/:path*", destination: "/v2/topics/:path*" },
  { source: "/following", destination: "/v2/following" },
  { source: "/saved", destination: "/v2/saved" },
  { source: "/stickies", destination: "/v2/stickies" },
  { source: "/reading-history", destination: "/v2/reading-history" },
  { source: "/my-activity", destination: "/v2/my-activity" },
  { source: "/my-discussions", destination: "/v2/my-discussions" },
  { source: "/my-replies", destination: "/v2/my-replies" },
  { source: "/profile", destination: "/v2/profile" },
  { source: "/settings", destination: "/v2/settings" },
  { source: "/premium", destination: "/v2/premium" },
  { source: "/support", destination: "/v2/support" },
  { source: "/privacy-security", destination: "/v2/privacy-security" },
  { source: "/notifications", destination: "/v2/notifications" },
  { source: "/search", destination: "/v2/search" },
  { source: "/onboarding", destination: "/v2/onboarding" },
  { source: "/admin", destination: "/v2/admin" },
];

const v2LegacyRedirects = [
  { source: "/v2", destination: "/home", permanent: false },
  { source: "/v2/discussions", destination: "/discussions", permanent: false },
  { source: "/v2/discussions/:path*", destination: "/discussions/:path*", permanent: false },
  { source: "/v2/create", destination: "/create", permanent: false },
  { source: "/v2/rooms", destination: "/rooms", permanent: false },
  { source: "/v2/rooms/:path*", destination: "/rooms/:path*", permanent: false },
  { source: "/v2/messages", destination: "/messages", permanent: false },
  { source: "/v2/people", destination: "/people", permanent: false },
  { source: "/v2/people/:path*", destination: "/people/:path*", permanent: false },
  { source: "/v2/labs", destination: "/labs", permanent: false },
  { source: "/v2/labs/:path*", destination: "/labs/:path*", permanent: false },
  { source: "/v2/topics", destination: "/topics", permanent: false },
  { source: "/v2/topics/:path*", destination: "/topics/:path*", permanent: false },
  { source: "/v2/following", destination: "/following", permanent: false },
  { source: "/v2/saved", destination: "/saved", permanent: false },
  { source: "/v2/stickies", destination: "/stickies", permanent: false },
  { source: "/v2/reading-history", destination: "/reading-history", permanent: false },
  { source: "/v2/my-activity", destination: "/my-activity", permanent: false },
  { source: "/v2/my-discussions", destination: "/my-discussions", permanent: false },
  { source: "/v2/my-replies", destination: "/my-replies", permanent: false },
  { source: "/v2/profile", destination: "/profile", permanent: false },
  { source: "/v2/settings", destination: "/settings", permanent: false },
  { source: "/v2/premium", destination: "/premium", permanent: false },
  { source: "/v2/support", destination: "/support", permanent: false },
  { source: "/v2/privacy-security", destination: "/privacy-security", permanent: false },
  { source: "/v2/notifications", destination: "/notifications", permanent: false },
  { source: "/v2/search", destination: "/search", permanent: false },
  { source: "/v2/onboarding", destination: "/onboarding", permanent: false },
  { source: "/v2/admin", destination: "/admin", permanent: false },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  async redirects() {
    return v2LegacyRedirects;
  },
  async rewrites() {
    return {
      beforeFiles: v2PublicRouteRewrites,
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
