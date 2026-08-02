import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { Category, Course } from "@/types";
import { BarChart3, Brain, Code, Palette, Database, Briefcase, Users } from "lucide-react";

const iconMap: Record<string, React.ReactNode> = {
  "marketing": <Briefcase className="h-6 w-6" aria-hidden="true" />,
  "ai": <Brain className="h-6 w-6" aria-hidden="true" />,
  "programming": <Code className="h-6 w-6" aria-hidden="true" />,
  "design": <Palette className="h-6 w-6" aria-hidden="true" />,
  "data": <Database className="h-6 w-6" aria-hidden="true" />,
  "business": <BarChart3 className="h-6 w-6" aria-hidden="true" />,
  "career": <Users className="h-6 w-6" aria-hidden="true" />,
};

async function getCategories() {
  try {
    const [catRes, courseRes] = await Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/categories`, { next: { revalidate: 60 } }),
      fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/courses`, { next: { revalidate: 60 } }),
    ]);
    const categories: Category[] = catRes.ok ? await catRes.json() : [];
    const courses: Course[] = courseRes.ok ? await courseRes.json() : [];

    const counts: Record<string, number> = {};
    for (const c of courses) {
      counts[c.category_slug] = (counts[c.category_slug] || 0) + 1;
    }
    return categories.map((cat) => ({ ...cat, course_count: counts[cat.slug] || 0 }));
  } catch {
    return [];
  }
}

export async function CategoryGrid() {
  const categories = await getCategories();

  if (categories.length === 0) {
    return <EmptyState title="No categories yet" message="Check back soon for new course categories." />;
  }

  return (
    <section className="bg-neutral-100 py-16 dark:bg-neutral-900">
      <div className="mx-auto max-w-page px-6">
        <h2 className="text-2xl font-semibold text-primary-900 dark:text-white">
          Whatever you&apos;re trying to get better at, it&apos;s in here.
        </h2>
        <p className="mt-2 max-w-2xl text-neutral-600 dark:text-neutral-300">
          Marketing, AI, programming, design, data, business, and career skills — organized so you
          find what you need in seconds, not scrolls.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((cat) => (
            <Link key={cat.id} href={`/courses/${cat.slug}`}>
              <Card className="p-4 hover:border-accent-500 transition-colors dark:bg-neutral-800 dark:border-neutral-700">
                <div className="flex items-center gap-3">
                  <div className="text-accent-600">{iconMap[cat.slug] || <Briefcase aria-hidden="true" />}</div>
                  <div>
                    <p className="font-medium text-neutral-900 dark:text-neutral-100">{cat.name}</p>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">{cat.course_count > 0 ? `${cat.course_count}+ courses` : "Coming soon"}</p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
