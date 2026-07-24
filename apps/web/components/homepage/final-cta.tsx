import Link from "next/link";
import { Button } from "@/components/ui/button";

export function FinalCTA() {
  return (
    <section className="bg-primary-700 py-16 text-center text-white">
      <div className="mx-auto max-w-page px-6">
        <h2 className="text-2xl font-semibold md:text-3xl">
          Your next skill is one membership away.
        </h2>
        <Link href="/pricing" className="mt-6 inline-block">
          <Button size="lg" variant="secondary" className="border-white/20 text-white hover:bg-white/10">
            See plans and pricing
          </Button>
        </Link>
      </div>
    </section>
  );
}
