import type { MetadataRoute } from "next";

const siteUrl = "https://loombus.com";
const publicRoutes = [
  { route: "", priority: 1, changeFrequency: "weekly" as const },
  { route: "/about", priority: 0.9, changeFrequency: "monthly" as const },
  { route: "/download", priority: 0.9, changeFrequency: "monthly" as const },
  { route: "/businesses", priority: 0.9, changeFrequency: "daily" as const },
  { route: "/jobs", priority: 0.9, changeFrequency: "daily" as const },
  { route: "/marketplace", priority: 0.9, changeFrequency: "daily" as const },
  { route: "/marketplace/safety", priority: 0.75, changeFrequency: "monthly" as const },
  { route: "/events", priority: 0.9, changeFrequency: "daily" as const },
  { route: "/requests", priority: 0.9, changeFrequency: "daily" as const },
  { route: "/requests/safety", priority: 0.75, changeFrequency: "monthly" as const },
  { route: "/login", priority: 0.85, changeFrequency: "monthly" as const },
  { route: "/signup", priority: 0.85, changeFrequency: "monthly" as const },
  { route: "/support", priority: 0.8, changeFrequency: "monthly" as const },
  { route: "/guidelines", priority: 0.7, changeFrequency: "monthly" as const },
  { route: "/safety", priority: 0.7, changeFrequency: "monthly" as const },
  { route: "/privacy", priority: 0.6, changeFrequency: "monthly" as const },
  { route: "/terms", priority: 0.6, changeFrequency: "monthly" as const },
  { route: "/cookies", priority: 0.5, changeFrequency: "monthly" as const },
  { route: "/refunds", priority: 0.5, changeFrequency: "monthly" as const },
  { route: "/dmca", priority: 0.5, changeFrequency: "monthly" as const },
  { route: "/accessibility", priority: 0.5, changeFrequency: "monthly" as const },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return publicRoutes.map(({ route, priority, changeFrequency }) => ({ url: `${siteUrl}${route}`, lastModified, changeFrequency, priority }));
}
