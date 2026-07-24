export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://ascendly.io";

async function fetchPosts() {
  try {
    const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const res = await fetch(`${api}/api/v1/blog`, { next: { revalidate: 60 } });
    return res.ok ? await res.json() : [];
  } catch {
    return [];
  }
}

export async function GET() {
  const posts = await fetchPosts();
  const today = new Date().toISOString();

  const entries = [
    { loc: `${BASE_URL}/blog`, priority: "0.7" },
    ...posts.map((post: { slug: string }) => ({
      loc: `${BASE_URL}/blog/${post.slug}`,
      priority: "0.6",
    })),
  ];

  const urls = entries
    .map(
      (e) => `
  <url>
    <loc>${e.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${e.priority}</priority>
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
