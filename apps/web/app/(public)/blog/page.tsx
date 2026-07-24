import Link from "next/link";
import { Card } from "@/components/ui/card";
import { makeMetadata } from "@/lib/metadata";

interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  author: string;
  published_at: string;
}

export const metadata = makeMetadata({
  title: "Ascendly Blog — Career Growth & Skill Guides",
  description:
    "Career growth tips, skill guides, and learning strategies from the Ascendly team.",
  path: "/blog",
});

export default async function BlogPage() {
  let posts: Post[] = [];
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/blog`,
      { next: { revalidate: 60 } }
    );
    if (res.ok) posts = await res.json();
  } catch {
    posts = [];
  }

  return (
    <section className="py-16">
      <div className="mx-auto max-w-page px-6">
        <h1 className="text-3xl font-semibold text-primary-900">Ascendly Blog</h1>
        <p className="mt-2 text-neutral-600">Career growth, skill guides, and how to learn faster.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <Link key={p.id} href={`/blog/${p.slug}`}>
              <Card className="h-full p-6 transition-colors hover:border-accent-500">
                <h2 className="font-medium text-neutral-900">{p.title}</h2>
                <p className="mt-2 text-sm text-neutral-600">{p.excerpt}</p>
                <p className="mt-4 text-xs text-neutral-500">
                  {p.published_at ? new Date(p.published_at).toLocaleDateString() : ""} · {p.author}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
