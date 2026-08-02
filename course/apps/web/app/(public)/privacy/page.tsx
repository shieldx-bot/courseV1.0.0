import { makeMetadata } from "@/lib/metadata";

export const metadata = makeMetadata({
  title: "Privacy Policy — Ascendly",
  description:
    "Ascendly collects only the data needed to deliver your membership. We do not sell your data.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <section className="py-16">
      <div className="mx-auto px-6 max-w-3xl">
        <h1 className="text-3xl font-semibold text-primary-900">Privacy policy</h1>
        <p className="mt-4 text-neutral-600">
          Ascendly collects only the data needed to deliver your membership: email, payment
          information through Stripe/PayPal, course progress, and optional phone number for trial
          verification. We do not sell your data.
        </p>
      </div>
    </section>
  );
}
