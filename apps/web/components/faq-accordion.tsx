"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface FaqItem {
  q: string;
  a: string;
}

interface FaqAccordionProps {
  items: FaqItem[];
}

export function FaqAccordion({ items }: FaqAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <dl className="mt-8 space-y-4">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        const headerId = `faq-header-${index}`;
        const panelId = `faq-panel-${index}`;
        return (
          <div
            key={item.q}
            className="rounded-lg border border-neutral-300 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-800"
          >
            <dt>
              <button
                onClick={() => toggle(index)}
                aria-expanded={isOpen}
                aria-controls={panelId}
                id={headerId}
                className="flex w-full items-center justify-between gap-4 text-left font-medium text-neutral-900 dark:text-neutral-100"
              >
                <span>{item.q}</span>
                <ChevronDown
                  className={`h-5 w-5 shrink-0 text-neutral-500 transition-transform duration-200 ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
            </dt>
            <dd
              id={panelId}
              role="region"
              aria-labelledby={headerId}
              className={`text-sm text-neutral-600 dark:text-neutral-300 ${
                isOpen ? "mt-2 block" : "hidden"
              }`}
            >
              {item.a}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
