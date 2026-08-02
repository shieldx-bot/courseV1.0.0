interface Stats {
  total_courses: number;
  total_members: number;
  total_hours: number;
  average_rating: number;
}

async function getStats(): Promise<Stats> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/stats`, {
      next: { revalidate: 60 },
    });
    if (res.ok) {
      const json = await res.json();
      return json.data ?? json;
    }
  } catch {}
  return { total_courses: 0, total_members: 0, total_hours: 0, average_rating: 0 };
}

export async function StatsBar() {
  const stats = await getStats();

  if (stats.total_courses === 0) return null;

  return (
    <section className="border-y border-neutral-200 bg-white py-8 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="mx-auto max-w-page px-6">
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-primary-700 dark:text-primary-100">
              {stats.total_courses.toLocaleString()}+
            </p>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Courses</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-primary-700 dark:text-primary-100">
              {stats.total_members.toLocaleString()}+
            </p>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Members</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-primary-700 dark:text-primary-100">
              {stats.total_hours.toLocaleString()}+
            </p>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Hours learned</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-primary-700 dark:text-primary-100">
              {stats.average_rating}/5
            </p>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Average rating</p>
          </div>
        </div>
      </div>
    </section>
  );
}
