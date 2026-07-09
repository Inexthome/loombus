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

const v2OnlyRouteRewrites = [
  // Keep temporary rewrites only for surfaces that currently live exclusively under /v2.
  // Core routes such as /discussions, /discussions/[id], and /create must resolve to
  // their canonical implementations so the legacy shell does not flash before V2 loads.
  { source: "/rooms", destination: "/v2/rooms" },
  { source: "/rooms/:path*", destination: "/v2/rooms/:path*" },
  { source: "/create-room", destination: "/v2/create-room" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  async redirects() {
    return v2LegacyCleanRedirects;
  },
  async rewrites() {
    return {
      beforeFiles: v2OnlyRouteRewrites,
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
