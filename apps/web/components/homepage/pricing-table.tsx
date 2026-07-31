import { SubscriptionTier } from "@/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import Link from "next/link";

interface PricingTableProps {
  variant?: "full" | "mini";
}

async function getTiers(): Promise<SubscriptionTier[]> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/subscriptions/tiers`,
      { next: { revalidate: 60 } }
    );
    if (res.ok) {
      const json = await res.json();
      return json.data ?? json;
    }
  } catch {}
  return [];
}

function formatTotal(tier: SubscriptionTier) {
  if (tier.duration_months >= 999) return "One-time";
  const full = tier.price_per_month * tier.duration_months;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(full) + " total";
}

export async function PricingTable({ variant = "full" }: PricingTableProps) {
  const allTiers = await getTiers();

  if (allTiers.length === 0) return null;

  const tiers = variant === "mini"
    ? allTiers.filter((t) => t.duration_months === 3 || t.duration_months === 12 || t.duration_months >= 999).slice(0, 3)
    : allTiers;

  return (
    <section className="bg-neutral-100 py-16 dark:bg-neutral-900" data-ab-section="pricing">
      <div className="mx-auto max-w-page px-6 text-center">
        {variant === "full" && (
          <>
            <h2 className="h1 text-primary-900 dark:text-white">
              One price. No per-course surprises.
            </h2>
            <p className="mx-auto mt-3 max-w-xl body-md text-neutral-600 dark:text-neutral-400">
              Every plan unlocks the full library — no tiers, no upsells.
            </p>
          </>
        )}
        {variant === "mini" && (
          <h2 className="h1 text-primary-900 dark:text-white">
            Pick the plan that fits you
          </h2>
        )}

        <div
          className={`mt-8 grid gap-6 ${
            variant === "mini"
              ? "sm:grid-cols-3"
              : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
          }`}
        >
          {tiers.map((tier) => (
              <Card
                key={tier.id}
                className={`flex flex-col p-6 text-left ${
                  tier.recommended || tier.badge || tier.duration_months === 12 ? "relative" : ""
                }`}
              >
              {(tier.recommended || tier.duration_months === 12) && (
                <Badge variant="accent" className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 max-w-[90%] truncate">
                  Best value
                </Badge>
              )}
              {tier.badge && !tier.recommended && tier.duration_months !== 12 && (
                <Badge variant="warning" className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 max-w-[90%] truncate">
                  {tier.badge}
                </Badge>
              )}
              <p className="text-sm text-neutral-600 dark:text-neutral-400">{tier.label}</p>
              <p className="mt-2 text-3xl font-semibold text-neutral-900 dark:text-neutral-100">
                ${tier.price_per_month}
                <span className="text-base font-normal text-neutral-600 dark:text-neutral-400">/mo</span>
              </p>
              <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                {formatTotal(tier)}
              </p>
              {variant === "full" && (
                <ul className="mt-4 space-y-2 text-sm text-neutral-900 dark:text-neutral-100">
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0 text-success" /> Full library access</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0 text-success" /> Cancel anytime</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0 text-success" /> 7-day guarantee</li>
                </ul>
              )}
              {variant === "mini" && (
                <p className="mt-4 text-xs text-neutral-600 dark:text-neutral-400">
                  Full library · Cancel anytime · 7-day guarantee
                </p>
              )}
              <Link href={`/checkout?tier=${tier.id}`} className="mt-6">
                <Button
                  variant={tier.recommended || tier.duration_months === 12 ? "primary" : "secondary"}
                  className="w-full"
                >
                  Subscribe
                </Button>
              </Link>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
