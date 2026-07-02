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

const quietCreekRoomId = "11111111-1111-4111-8111-111111111111";
const traverzeCultureRoomId = "22222222-2222-4222-8222-222222222222";

const v2DefaultRedirects = [
  { source: "/discussions", destination: "/v2/discussions", permanent: false },
  { source: "/discussions/:path*", destination: "/v2/discussions/:path*", permanent: false },
  { source: "/create", destination: "/v2/create", permanent: false },
  { source: "/messages", destination: "/v2/messages", permanent: false },
  { source: "/people", destination: "/v2/people", permanent: false },
  { source: "/saved", destination: "/v2/saved", permanent: false },
  { source: "/following", destination: "/v2/following", permanent: false },
  { source: "/profile", destination: "/v2/profile", permanent: false },
  { source: "/my-activity", destination: "/v2/my-activity", permanent: false },
  { source: "/notifications", destination: "/v2/notifications", permanent: false },
  { source: "/settings", destination: "/v2/settings", permanent: false },
  { source: "/support", destination: "/v2/support", permanent: false },
  { source: "/premium", destination: "/v2/premium", permanent: false },
  { source: "/topics", destination: "/v2/topics", permanent: false },
  { source: "/privacy-security", destination: "/v2/privacy-security", permanent: false },
  { source: "/rooms", destination: "/v2/rooms", permanent: false },
  { source: "/traverzeculture", destination: `/v2/rooms/${traverzeCultureRoomId}`, permanent: false },
  { source: "/traverze-culture", destination: `/v2/rooms/${traverzeCultureRoomId}`, permanent: false },
  { source: "/quietcreek", destination: `/v2/rooms/${quietCreekRoomId}`, permanent: false },
  { source: "/quietcreekresidents", destination: `/v2/rooms/${quietCreekRoomId}`, permanent: false },
  { source: "/quiet-creek-residents", destination: `/v2/rooms/${quietCreekRoomId}`, permanent: false },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  async redirects() {
    return v2DefaultRedirects;
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
