import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// The API is for the app and the page itself, not for search results.
export default function robots(): MetadataRoute.Robots {
  return {
    // /dl/ are counted download links: a crawler following them is no download.
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/dl/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
