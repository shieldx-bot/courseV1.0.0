"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, AlertTriangle, RefreshCw } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { Subscription } from "@/types";

export function RenewalBanner() {
  const [sub, setSub] = useState<Subscription | null | undefined>(undefined);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    apiClient.subscriptions.me()
      .then((data) => setSub(data as any))
      .catch(() => setSub(null));
  }, []);

  if (dismissed || sub === undefined || !sub) return null;

  const now = new Date();
  const endsAt = new Date(sub.ends_at);
  const daysLeft = Math.ceil((endsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysLeft > 7 && sub.status === "active") return null;

  const isCanceled = sub.status === "canceled" || sub.status === "incomplete";

  return (
    <div className="bg-amber-50 border-b border-amber-200">
      <div className="mx-auto flex max-w-page items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3 text-sm">
          {isCanceled ? (
            <>
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
              <span className="text-amber-800">
                Your membership {daysLeft > 0 ? `ends on ${endsAt.toLocaleDateString()}` : "has ended"}.
                {daysLeft > 0 && " Renew to keep your access."}
              </span>
            </>
          ) : (
            <>
              <RefreshCw className="h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
              <span className="text-amber-800">
                Your membership renews on {endsAt.toLocaleDateString()} ({daysLeft} day{daysLeft !== 1 ? "s" : ""}).
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          {(!isCanceled || daysLeft > 0) && (
            <Link href="/account" className="text-sm font-medium text-amber-700 underline hover:text-amber-800">
              Manage
            </Link>
          )}
          {isCanceled && daysLeft === 0 && (
            <Link href="/pricing">
              <span className="cursor-pointer text-sm font-medium text-amber-700 underline hover:text-amber-800">
                Renew now
              </span>
            </Link>
          )}
          <button
            onClick={() => setDismissed(true)}
            className="text-amber-500 hover:text-amber-700"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
