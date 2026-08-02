export function HowItWorksSection() {
  const steps = [
    {
      number: "01",
      title: "Pick your plan",
      body: "Monthly to lifetime, cancel anytime under 12 months.",
    },
    {
      number: "02",
      title: "Preview for free",
      body: "Verify your phone, unlock 10% of any course for 3 days.",
    },
    {
      number: "03",
      title: "Start learning",
      body: "Full library, unlocked, the moment you subscribe.",
    },
  ];

  return (
    <section className="py-16 dark:bg-neutral-950">
      <div className="mx-auto max-w-page px-6">
        <h2 className="text-2xl font-semibold text-primary-900 dark:text-white">How it works</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.number} className="rounded-lg border border-neutral-300 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-800">
              <p className="text-sm font-semibold text-accent-600">{s.number}</p>
              <h3 className="mt-2 font-medium text-neutral-900 dark:text-neutral-100">{s.title}</h3>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
