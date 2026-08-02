"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, MessageCircleQuestion, ShoppingCart, Sparkles, X } from "lucide-react";
import { getActiveInterventions, isInterventionDismissed, dismissIntervention } from "@/lib/support-api";
import type { Intervention } from "@/types/support";

interface InterventionMeta {
  icon: typeof Sparkles;
  defaultMessage: string;
  ctaLabel: string;
  href: string;
}

const TYPE_META: Record<string, InterventionMeta> = {
  learning_stall: {
    icon: Sparkles,
    defaultMessage: "Your course is waiting. Need a hand to get back on track?",
    ctaLabel: "Continue learning",
    href: "/dashboard",
  },
  quiz_low_score: {
    icon: BookOpen,
    defaultMessage: "Review these lessons to improve your understanding.",
    ctaLabel: "Review lessons",
    href: "/learn",
  },
  video_rewatch: {
    icon: MessageCircleQuestion,
    defaultMessage: "Need help? Ask our AI assistant about this section.",
    ctaLabel: "Ask AI tutor",
    href: "/learn",
  },
  checkout_drop: {
    icon: ShoppingCart,
    defaultMessage: "Having trouble with payment? We can help you complete your purchase.",
    ctaLabel: "Continue checkout",
    href: "/pricing",
  },
};

const FALLBACK_META: InterventionMeta = {
  icon: Sparkles,
  defaultMessage: "Need a hand? Our support team is here to help.",
  ctaLabel: "Get help",
  href: "/support",
};

function metaFor(type: string): InterventionMeta {
  return TYPE_META[type] || FALLBACK_META;
}

/**
 * Shows only interventions relevant to the current page context so the banner
 * never feels out of place (learning_stall shows anywhere in the app).
 */
function isRelevant(type: string, pathname: string): boolean {
  if (type === "checkout_drop") return /^\/(pricing|checkout)/.test(pathname);
  if (type === "quiz_low_score" || type === "video_rewatch") return pathname.startsWith("/learn");
  return true;
}

export function ProactiveIntervention() {
  const pathname = usePathname();
  const [interventions, setInterventions] = useState<Intervention[]>([]);

  useEffect(() => {
    let mounted = true;
    getActiveInterventions().then((list) => {
      if (mounted) setInterventions(list);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (interventions.length === 0) return null;

  const visible = interventions.filter(
    (i) => !isInterventionDismissed(i.type) && isRelevant(i.type, pathname)
  );
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2 px-4 pt-4 sm:px-6" aria-live="polite">
      {visible.map((intervention, idx) => {
        const meta = metaFor(intervention.type);
        const Icon = meta.icon;
        const message = intervention.message || meta.defaultMessage;
        return (
          <div
            key={`${intervention.type}-${idx}`}
            role="status"
            className="flex items-start gap-3 rounded-xl border border-accent-200 bg-accent-50 px-4 py-3 shadow-sm dark:border-accent-800/60 dark:bg-accent-900/20"
          >
            <Icon className="mt-0.5 h-5 w-5 shrink-0 text-accent-600 dark:text-accent-400" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-neutral-800 dark:text-neutral-100">{message}</p>
              <Link
                href={meta.href}
                className="mt-1.5 inline-block text-sm font-semibold text-accent-700 hover:text-accent-800 hover:underline dark:text-accent-300 dark:hover:text-accent-200"
              >
                {meta.ctaLabel} →
              </Link>
            </div>
            <button
              type="button"
              onClick={() => {
                dismissIntervention(intervention.type);
                setInterventions((prev) =>
                  prev.filter((i) => i.type !== intervention.type)
                );
              }}
              aria-label={`Dismiss ${intervention.type} help message`}
              className="shrink-0 rounded-md p-1 text-neutral-500 hover:bg-accent-100 hover:text-neutral-700 dark:hover:bg-accent-800/60 dark:hover:text-neutral-200"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
