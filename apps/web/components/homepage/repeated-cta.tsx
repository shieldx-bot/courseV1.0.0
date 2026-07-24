import Link from "next/link";
import { Button } from "@/components/ui/button";

interface RepeatedCTAProps {
  title?: string;
  buttonText?: string;
  href?: string;
  variant?: "primary" | "secondary";
}

export function RepeatedCTA({
  title = "Ready to start learning?",
  buttonText = "Join Ascendly",
  href = "/pricing",
  variant = "secondary",
}: RepeatedCTAProps) {
  return (
    <section className="py-12 text-center dark:bg-neutral-900">
      <div className="mx-auto max-w-page px-6">
        <h3 className="text-xl font-semibold text-primary-900 dark:text-white">{title}</h3>
        <Link href={href} className="mt-4 inline-block">
          <Button size="lg" variant={variant} className={variant === "primary" ? "bg-accent-500 text-white hover:bg-accent-600" : ""} data-ab-variant="cta-repeated">
            {buttonText}
          </Button>
        </Link>
      </div>
    </section>
  );
}
