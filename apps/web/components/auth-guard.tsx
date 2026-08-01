"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { isOnboardingBlocked } from "@/lib/onboarding-data";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    // Gate incomplete onboarding to the onboarding wizard.
    if (isOnboardingBlocked(user.onboarding) && pathname !== "/onboarding") {
      router.replace("/onboarding");
    }
  }, [user, loading, router, pathname]);

  if (loading) return <p className="py-20 text-center text-neutral-600">Loading...</p>;
  if (!user) return null;

  return <>{children}</>;
}

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) {
      router.replace("/");
    }
  }, [user, loading, router]);

  if (loading) return <p className="py-20 text-center text-neutral-600">Loading...</p>;
  if (!user || user.role !== "admin") return null;

  return <>{children}</>;
}
