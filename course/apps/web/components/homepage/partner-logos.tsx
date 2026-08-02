const partners = ["Google", "Meta", "Shopify", "Notion", "Vercel", "Slack"];

export function PartnerLogos() {
  return (
    <section className="py-10 text-center">
      <div className="mx-auto max-w-page px-6">
        <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
          Instructors and career advice from teams at companies like
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-6">
          {partners.map((p) => (
            <span
              key={p}
              className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
            >
              {p}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
