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

const v2CanonicalRouteRedirects = [
  { source: "/v2", destination: "/home", permanent: false },
  { source: "/v2/create", destination: "/create", permanent: false },
  { source: "/v2/create/review", destination: "/create", permanent: false },
  { source: "/v2/discussions", destination: "/discussions", permanent: false },
  { source: "/v2/discussions/:path*", destination: "/discussions/:path*", permanent: false },
  { source: "/v2/messages", destination: "/messages", permanent: false },
  { source: "/v2/people", destination: "/people", permanent: false },
  { source: "/v2/saved", destination: "/saved", permanent: false },
  { source: "/v2/settings", destination: "/settings", permanent: false },
  { source: "/v2/notifications", destination: "/notifications", permanent: false },
  { source: "/v2/premium", destination: "/premium", permanent: false },
];

const v2RemainingRouteRewrites = [
  // Keep these V2-owned until their canonical pages are verified and restyled in follow-up PRs.
  { source: "/following", destination: "/v2/following" },
  { source: "/profile", destination: "/v2/profile" },
  { source: "/my-activity", destination: "/v2/my-activity" },
  { source: "/support", destination: "/v2/support" },
  { source: "/topics", destination: "/v2/topics" },
  { source: "/privacy-security", destination: "/v2/privacy-security" },
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
    return v2CanonicalRouteRedirects;
  },
  async rewrites() {
    return {
      beforeFiles: v2RemainingRouteRewrites,
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
