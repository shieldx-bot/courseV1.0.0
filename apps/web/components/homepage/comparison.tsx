import { Card } from "@/components/ui/card";
import { Check, X } from "lucide-react";

export function ComparisonSection() {
  return (
    <section className="bg-neutral-100 py-16 dark:bg-neutral-900">
      <div className="mx-auto max-w-page px-6">
        <h2 className="text-2xl font-semibold text-primary-900 dark:text-white">Do the math once.</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <Card className="p-6 dark:bg-neutral-800 dark:border-neutral-700">
            <h3 className="font-medium text-neutral-900 dark:text-neutral-100">Buying courses one by one</h3>
            <div className="mt-4 space-y-3 text-sm text-neutral-600 dark:text-neutral-300">
              <p className="flex items-center gap-2"><X className="h-4 w-4 text-error" aria-hidden="true" /> Average course elsewhere: $50–200</p>
              <p className="flex items-center gap-2"><X className="h-4 w-4 text-error" aria-hidden="true" /> Ten courses: $500–2,000</p>
              <p className="flex items-center gap-2"><X className="h-4 w-4 text-error" aria-hidden="true" /> Easy to abandon between platforms</p>
            </div>
          </Card>
          <Card className="border-2 border-accent-500 p-6 dark:bg-neutral-800 dark:border-accent-500">
            <h3 className="font-medium text-neutral-900 dark:text-neutral-100">One Ascendly membership</h3>
            <div className="mt-4 space-y-3 text-sm text-neutral-900 dark:text-neutral-100">
              <p className="flex items-center gap-2"><Check className="h-4 w-4 text-success" aria-hidden="true" /> Every course, starting at $29/month</p>
              <p className="flex items-center gap-2"><Check className="h-4 w-4 text-success" aria-hidden="true" /> Same instructors, structured paths</p>
              <p className="flex items-center gap-2"><Check className="h-4 w-4 text-success" aria-hidden="true" /> Cancel anytime</p>
            </div>
          </Card>
        </div>
        <p className="mt-6 text-sm text-neutral-600 dark:text-neutral-300">You&apos;d need to finish less than one course to break even.</p>
      </div>
    </section>
  );
}
