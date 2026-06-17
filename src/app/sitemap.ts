import type { MetadataRoute } from "next";

const siteUrl = "https://loombus.com";

const publicRoutes = [
  "",
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
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return publicRoutes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified,
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : route === "/about" ? 0.8 : 0.6,
  }));
}
