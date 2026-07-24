"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function StickyCtaBar() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = () => {
      setVisible(window.scrollY > 600);
    };
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-neutral-200 bg-white/95 p-4 shadow-lg backdrop-blur-sm md:hidden dark:border-neutral-700 dark:bg-neutral-900/95"
      data-ab-variant="sticky-bar"
    >
      <div className="mx-auto flex max-w-page items-center justify-between">
        <div>
          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            Start learning
          </p>
          <p className="text-xs text-neutral-600 dark:text-neutral-400">from $29/month</p>
        </div>
        <Link href="/pricing">
          <Button
            size="sm"
            className="bg-accent-500 text-white hover:bg-accent-600"
            aria-label="See pricing plans"
          >
            See plans
          </Button>
        </Link>
      </div>
    </div>
  );
}
