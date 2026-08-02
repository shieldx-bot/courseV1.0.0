import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ascendly.io";
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/learn", "/admin", "/account", "/checkout"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
