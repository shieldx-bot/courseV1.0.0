"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
  separator?: ReactNode;
}

export function Breadcrumbs({ items, className, separator = ">" }: BreadcrumbsProps) {
  return (
    <nav className={cn("flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400", className)} aria-label="Breadcrumb">
      <ol className="flex items-center gap-2 flex-wrap">
        {items.map((item, index) => (
          <li key={item.label} className="flex items-center gap-2">
            {index > 0 && (
              <span className="text-neutral-400 dark:text-neutral-500" aria-hidden="true">
                {separator}
              </span>
            )}
            {item.href ? (
              <Link href={item.href} className="hover:text-primary-700 dark:hover:text-primary-400 transition-colors">
                {item.label}
              </Link>
            ) : (
              <span className="font-medium text-neutral-900 dark:text-neutral-100" aria-current={index === items.length - 1 ? "page" : undefined}>
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}