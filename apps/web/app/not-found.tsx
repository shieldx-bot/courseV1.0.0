import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Page not found — Ascendly",
};

export default function NotFoundPage() {
  return (
    <section className="flex flex-1 items-center justify-center py-20">
      <div className="mx-auto max-w-page px-6 text-center">
        <h1 className="text-6xl font-bold text-primary-900">404</h1>
        <p className="mt-4 text-xl text-neutral-900">We could not find that page.</p>
        <p className="mt-2 text-neutral-600">
          Explore popular courses, check our pricing, or head back home.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/">
            <Button>Go home</Button>
          </Link>
          <Link href="/courses">
            <Button variant="secondary">Browse courses</Button>
          </Link>
          <Link href="/pricing">
            <Button variant="secondary">View pricing</Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
