import type { NextConfig } from "next";

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
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), accelerometer=(), gyroscope=(), magnetometer=(), clipboard-read=(), clipboard-write=()",
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

const LEGAL_ORIGIN = "https://legal.loombus.com";
const LEGACY_LEGAL_REDIRECTS = [
  ["/legal", "/"],
  ["/privacy", "/privacy"],
  ["/terms", "/terms"],
  ["/guidelines", "/community-guidelines"],
  ["/cookies", "/cookies"],
  ["/refunds", "/refunds"],
  ["/dmca", "/dmca"],
  ["/accessibility", "/accessibility"],
] as const;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  async headers() {
    return [
      {
        source: "/.well-known/apple-app-site-association",
        headers: [
          {
            key: "Content-Type",
            value: "application/json",
          },
        ],
      },
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return LEGACY_LEGAL_REDIRECTS.flatMap(([source, destination]) =>
      ["loombus.com", "www.loombus.com"].map((host) => ({
        source,
        has: [{ type: "host" as const, value: host }],
        destination: `${LEGAL_ORIGIN}${destination}`,
        permanent: true,
      }))
    );
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/",
          has: [{ type: "host", value: "legal.loombus.com" }],
          destination: "/legal",
        },
        {
          source: "/community-guidelines",
          has: [{ type: "host", value: "legal.loombus.com" }],
          destination: "/guidelines",
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
