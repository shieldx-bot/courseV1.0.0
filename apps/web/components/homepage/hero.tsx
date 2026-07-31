import Link from "next/link";
import { Button } from "@/components/ui/button";

export function HeroSection() {
   return (
      <section className="w-screen py-20 text-white md:py-28 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 dark:bg-primary-900 bg-primary-900" data-ab-section="hero">
       <div className="mx-auto max-w-page text-center">
        <h1 className="text-4xl font-semibold leading-tight md:text-5xl" data-ab-variant="headline-a">
          One membership. Every skill you&apos;ll ever need.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-100" data-ab-variant="subtitle-a">
          2,000+ courses in business, tech, design & data — built for people with a job, not free time.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link href="/pricing">
            <Button size="lg" className="w-full sm:w-auto" data-ab-variant="cta-hero-a">
              Start learning today
            </Button>
          </Link>
          <Link href="/courses">
            <Button size="lg" variant="secondary" className="w-full border-white/20 text-white hover:bg-white/10 sm:w-auto">
              Browse courses
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}