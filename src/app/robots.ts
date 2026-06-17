import type { MetadataRoute } from "next";

const siteUrl = "https://loombus.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/about",
          "/premium",
          "/safety",
          "/guidelines",
          "/privacy",
          "/terms",
          "/cookies",
          "/refunds",
          "/dmca",
          "/accessibility",
          "/contact",
          "/login",
          "/signup",
          "/icon.png",
          "/apple-icon.png",
          "/opengraph-image.png",
          "/manifest.webmanifest",
        ],
        disallow: [
          "/admin",
          "/admin/",
          "/api",
          "/api/",
          "/settings",
          "/settings/",
          "/messages",
          "/messages/",
          "/notifications",
          "/notifications/",
          "/profile",
          "/profile/",
          "/saved",
          "/saved/",
          "/create",
          "/dashboard",
          "/ai-usage",
          "/blocked-users",
          "/reading-history",
          "/my-activity",
          "/my-discussions",
          "/my-replies",
          "/u/",
          "/auth/",
          "/onboarding",
          "/unsubscribe",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
