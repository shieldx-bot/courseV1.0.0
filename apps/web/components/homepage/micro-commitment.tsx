import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";

export function MicroCommitment() {
  return (
    <section className="bg-accent-100 py-12 dark:bg-accent-600/10">
      <div className="mx-auto max-w-page px-6 text-center">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 sm:flex-row sm:text-left">
          <div className="rounded-full bg-accent-500/10 p-3 text-accent-600">
            <ShieldCheck className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <p className="font-medium text-primary-900 dark:text-white">
              Preview any course for free
            </p>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Verify your phone, unlock 10% of any course — no credit card needed.
            </p>
          </div>
          <Link href="/verify-phone" className="shrink-0 sm:ml-auto">
            <Button size="sm" variant="secondary">
              Try free preview
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
