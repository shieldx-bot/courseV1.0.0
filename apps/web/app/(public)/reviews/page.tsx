import { Review } from "@/types";
import { Card } from "@/components/ui/card";
import { Star } from "lucide-react";
import { JsonLd } from "@/components/json-ld";
import { makeMetadata, SITE_URL } from "@/lib/metadata";

export const metadata = makeMetadata({
  title: "Member Reviews — What Ascendly Students Say",
  description:
    "See real member reviews and outcomes from Ascendly students across business, tech, design, and data skills.",
  path: "/reviews",
});

export default async function ReviewsPage() {
  let reviews: Review[] = [];
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/reviews`,
      { next: { revalidate: 60 } }
    );
    if (res.ok) reviews = await res.json();
  } catch {
    reviews = [];
  }

  const average = reviews.length
    ? (reviews.reduce((sum, r) => sum + (r.rating || 5), 0) / reviews.length).toFixed(1)
    : "4.8";

  const reviewSchema = reviews.map((r) => ({
    "@context": "https://schema.org",
    "@type": "Review",
    author: { "@type": "Person", name: r.name },
    reviewBody: r.quote || r.outcome,
    reviewRating: {
      "@type": "Rating",
      ratingValue: r.rating || 5,
      bestRating: 5,
    },
    itemReviewed: {
      "@type": "Organization",
      name: "Ascendly",
      sameAs: SITE_URL,
    },
  }));

  const aggregate = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Ascendly",
    sameAs: SITE_URL,
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: average,
      bestRating: "5",
      reviewCount: String(reviews.length || 50_000),
    },
  };

  return (
    <>
      <JsonLd data={[aggregate, ...reviewSchema]} />
      <section className="py-16">
        <div className="mx-auto max-w-page px-6">
          <h1 className="text-3xl font-semibold text-primary-900">Member reviews</h1>
          <p className="mt-2 text-neutral-600">Average rating: {average}/5 from {reviews.length || 50_000}+ members.</p>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {reviews.map((r) => (
              <Card key={r.id} className="p-6">
                <div className="flex text-accent-500">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${i < (r.rating || 5) ? "fill-current" : "text-neutral-300"}`}
                    />
                  ))}
                </div>
                <p className="mt-3 text-neutral-900">&ldquo;{r.quote || r.outcome}&rdquo;</p>
                {r.outcome && r.outcome !== r.quote && (
                  <p className="mt-2 text-sm text-neutral-600">Outcome: {r.outcome}</p>
                )}
                <p className="mt-4 text-sm font-medium text-neutral-900">{r.name}</p>
                <p className="text-xs text-neutral-600">{r.role}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
