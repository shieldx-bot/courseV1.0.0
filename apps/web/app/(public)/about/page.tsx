import { makeMetadata } from "@/lib/metadata";

export const metadata = makeMetadata({
  title: "About Ascendly — One Membership for Career Skills",
  description:
    "Ascendly bundles expert-led courses across business, tech, design, data, AI, and career skills into one membership.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <section className="py-16">
      <div className="mx-auto px-6 max-w-3xl">
        <h1 className="text-3xl font-semibold text-primary-900">About Ascendly</h1>
        <p className="mt-4 text-neutral-600">
          Ascendly exists because career growth shouldn&apos;t require a second degree or a stack of
          $20 courses you never finish. We bundle expert-led courses across business, tech, design,
          data, AI, and career skills into one membership — organized as structured paths, not a video
          dump.
        </p>
        <p className="mt-4 text-neutral-600">
          Our members are office workers, freelancers, career changers, and self-directed learners
          who want a reliable, calm place to build skills on their own schedule.
        </p>
      </div>
    </section>
  );
}
