"use client";

import { FaqAccordion } from "@/components/faq-accordion";

export function FAQSection() {
  const items = [
    {
      q: "What happens after I subscribe?",
      a: "You get immediate, unlimited access to every course in the library for the duration of your plan.",
    },
    {
      q: "Can I cancel?",
      a: "Yes. You can cancel anytime under 12-month plans and keep access until the end of your billing period.",
    },
    {
      q: "Is there a refund policy?",
      a: "We offer a 7-day money-back guarantee, no questions asked, one time per account.",
    },
  ];

  return (
    <section className="py-16 dark:bg-neutral-900">
      <div className="mx-auto max-w-page px-6">
        <h2 className="text-2xl font-semibold text-primary-900 dark:text-white">
          Questions before you subscribe?
        </h2>
        <FaqAccordion items={items} />
      </div>
    </section>
  );
}
