const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://ascendly.io";

const staticRoutes = [
  { path: "/", priority: "1.0" },
  { path: "/about", priority: "0.7" },
  { path: "/courses", priority: "0.9" },
  { path: "/pricing", priority: "0.9" },
  { path: "/membership", priority: "0.8" },
  { path: "/reviews", priority: "0.7" },
  { path: "/faq", priority: "0.7" },
  { path: "/contact", priority: "0.6" },
  { path: "/blog", priority: "0.7" },
  { path: "/privacy", priority: "0.3" },
  { path: "/terms", priority: "0.3" },
];

export async function GET() {
  const today = new Date().toISOString();
  const urls = staticRoutes
    .map(
      (r) => `
  <url>
    <loc>${BASE_URL}${r.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${r.priority}</priority>
  </url>`
    )
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}
</urlset>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml" },
  });
}
