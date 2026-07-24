import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Course, Category } from "@/types";
import { makeMetadata, SITE_URL } from "@/lib/metadata";
import { JsonLd } from "@/components/json-ld";

export async function generateMetadata({ params }: { params: { category: string } }) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  let category: Category | null = null;
  try {
    const res = await fetch(`${apiBase}/api/v1/categories/${params.category}`, { next: { revalidate: 60 } });
    if (res.ok) category = await res.json();
  } catch {}

  return makeMetadata({
    title: `${category?.name || params.category} Courses — Ascendly`,
    description: `Browse ${category?.name || params.category} courses included with every Ascendly membership.`,
    path: `/courses/${params.category}`,
  });
}

export default async function CategoryPage({ params }: { params: { category: string } }) {
  let category: Category | null = null;
  let courses: Course[] = [];
  try {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const [catRes, courseRes] = await Promise.all([
      fetch(`${apiBase}/api/v1/categories/${params.category}`, { next: { revalidate: 60 } }),
      fetch(`${apiBase}/api/v1/courses?category=${params.category}`, { next: { revalidate: 60 } }),
    ]);
    if (catRes.ok) category = await catRes.json();
    if (courseRes.ok) courses = await courseRes.json();
  } catch {
    category = null;
    courses = [];
  }

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Courses", item: `${SITE_URL}/courses` },
      { "@type": "ListItem", position: 3, name: category?.name || params.category, item: `${SITE_URL}/courses/${params.category}` },
    ],
  };

  return (
    <>
      <JsonLd data={breadcrumb} />
      <section className="py-12">
        <div className="mx-auto max-w-page px-6">
          <h1 className="text-3xl font-semibold text-primary-900">{category?.name || params.category} courses</h1>
          <p className="mt-2 text-neutral-600">{courses.length} courses included with every membership.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <Link key={course.id} href={`/courses/${course.category_slug}/${course.slug}`}>
                <Card className="h-full p-5 hover:border-accent-500 transition-colors">
                  <Badge variant="primary">{course.category_name}</Badge>
                  <h3 className="mt-3 font-medium text-neutral-900">{course.title}</h3>
                  <p className="mt-2 line-clamp-2 text-sm text-neutral-600">{course.description}</p>
                  <p className="mt-4 text-xs text-neutral-600">{course.lesson_count} lessons</p>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
