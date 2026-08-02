import { makeMetadata } from "@/lib/metadata";

export const metadata = makeMetadata({
  title: "Terms of Use — Ascendly",
  description:
    "By using Ascendly, you agree to use the platform for personal learning and not share accounts or scrape content.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <section className="py-16">
      <div className="mx-auto px-6 max-w-3xl">
        <h1 className="text-3xl font-semibold text-primary-900">Terms of use</h1>
        <p className="mt-4 text-neutral-600">
          By using Ascendly, you agree to use the platform for personal learning. Sharing accounts,
          scraping content, or attempting to circumvent content protection violates these terms and
          may result in account suspension.
        </p>
      </div>
    </section>
  );
}
