export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://ascendly.io";

async function fetchDynamic() {
  try {
    const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const [categories, courses] = await Promise.all([
      fetch(`${api}/api/v1/categories`, { next: { revalidate: 60 } }).then((r) => (r.ok ? r.json() : [])),
      fetch(`${api}/api/v1/courses`, { next: { revalidate: 60 } }).then((r) => (r.ok ? r.json() : [])),
    ]);
    return { categories, courses };
  } catch {
    return { categories: [], courses: [] };
  }
}

export async function GET() {
  const { categories, courses } = await fetchDynamic();
  const today = new Date().toISOString();

  const entries = [
    { loc: `${BASE_URL}/courses`, priority: "0.9" },
    ...categories.map((cat: { slug: string }) => ({
      loc: `${BASE_URL}/courses/${cat.slug}`,
      priority: "0.7",
    })),
    ...courses.map((course: { category_slug: string; slug: string }) => ({
      loc: `${BASE_URL}/courses/${course.category_slug}/${course.slug}`,
      priority: "0.8",
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
