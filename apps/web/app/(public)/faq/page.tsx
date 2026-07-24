import { JsonLd } from "@/components/json-ld";
import { FaqAccordion } from "@/components/faq-accordion";
import { makeMetadata, SITE_URL } from "@/lib/metadata";

export const metadata = makeMetadata({
  title: "FAQ — Ascendly Membership Questions",
  description:
    "Find answers about Ascendly memberships, free previews, refunds, cancellations, and course access.",
  path: "/faq",
});

const items = [
  {
    q: "What is included in the membership?",
    a: "Every membership includes unlimited access to the full library of 2,000+ courses across all categories.",
  },
  {
    q: "Can I cancel my subscription?",
    a: "Yes. Monthly, 3-month, 6-month, and 12-month plans can be cancelled anytime. You keep access until the end of your billing period.",
  },
  {
    q: "Do you offer refunds?",
    a: "We offer a 7-day money-back guarantee, no questions asked, one time per account.",
  },
  {
    q: "How does the free preview work?",
    a: "Verify your phone number to unlock 10% of any course for 3 days — no credit card required.",
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: items.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.a,
    },
  })),
};

const breadcrumb = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "FAQ", item: `${SITE_URL}/faq` },
  ],
};

export default function FAQPage() {
  return (
    <>
      <JsonLd data={[faqSchema, breadcrumb]} />
      <section className="py-16">
        <div className="mx-auto max-w-3xl px-6">
          <h1 className="text-3xl font-semibold text-primary-900">
            Frequently asked questions
          </h1>
          <FaqAccordion items={items} />
        </div>
      </section>
    </>
  );
}
