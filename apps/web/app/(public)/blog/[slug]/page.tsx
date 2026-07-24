import { notFound } from "next/navigation";
import { JsonLd } from "@/components/json-ld";
import { makeMetadata, SITE_URL } from "@/lib/metadata";

interface Post {
  id: string;
  slug: string;
  title: string;
  content: string;
  excerpt: string;
  author: string;
  published_at: string;
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  let post: Post | null = null;
  try {
    const res = await fetch(`${apiBase}/api/v1/blog/${params.slug}`, { next: { revalidate: 60 } });
    if (res.ok) post = await res.json();
  } catch {}

  return makeMetadata({
    title: `${post?.title || params.slug} — Ascendly Blog`,
    description: post?.excerpt || "Read career and skill insights on the Ascendly blog.",
    path: `/blog/${params.slug}`,
    ogType: "article",
  });
}

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  let post: Post | null = null;
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/blog/${params.slug}`,
      { next: { revalidate: 60 } }
    );
    if (res.ok) post = await res.json();
  } catch {
    post = null;
  }

  if (!post) {
    return notFound();
  }

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    author: { "@type": "Person", name: post.author },
    datePublished: post.published_at,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${SITE_URL}/blog/${post.slug}`,
    },
  };

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/blog` },
      { "@type": "ListItem", position: 3, name: post.title, item: `${SITE_URL}/blog/${post.slug}` },
    ],
  };

  return (
    <>
      <JsonLd data={[articleSchema, breadcrumb]} />
      <article className="py-16">
        <div className="mx-auto max-w-3xl px-6">
          <h1 className="text-3xl font-semibold text-primary-900">{post.title}</h1>
          <p className="mt-2 text-sm text-neutral-500">
            {post.published_at ? new Date(post.published_at).toLocaleDateString() : ""} · {post.author}
          </p>
          <p className="mt-6 text-neutral-600 leading-relaxed">{post.content}</p>
        </div>
      </article>
    </>
  );
}
