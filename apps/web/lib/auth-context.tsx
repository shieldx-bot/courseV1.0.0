"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { apiClient } from "@/lib/api-client";
import type { User, OnboardingProfile } from "@/types";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (user: User) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * The API's GET /auth/me does not round-trip the `onboarding` profile (the
 * auth resolver only exposes core fields), so it always reports the default
 * "not_started" status on refresh. The frontend therefore persists the
 * onboarding profile locally and restores it when /auth/me reports the
 * default, keeping the onboarding gate functional for genuinely new users
 * without bouncing returning users back to the wizard on every reload.
 */
const ONBOARDING_STORAGE_KEY = "ascendly:onboarding";

function readStoredOnboarding(): OnboardingProfile | null {
  try {
    const raw = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as OnboardingProfile) : null;
  } catch {
    return null;
  }
}

function isDefaultOnboarding(profile: OnboardingProfile | undefined): boolean {
  return (
    !profile ||
    (profile.status === "not_started" &&
      profile.interests?.length === 0 &&
      !profile.level &&
      !profile.goal &&
      !profile.first_challenge_completed)
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.auth.me()
      .then((data) => {
        const restored = readStoredOnboarding();
        const next = { ...data } as User;
        if (restored && isDefaultOnboarding(next.onboarding)) {
          next.onboarding = restored;
        }
        setUser(next);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = (userData: User) => {
    if (userData?.onboarding) {
      try {
        window.localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(userData.onboarding));
      } catch {
        // ignore storage failures
      }
    }
    setUser(userData);
  };

  const logout = async () => {
    try {
      await apiClient.auth.logout();
    } catch {
      // ignore
    }
    try {
      window.localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    } catch {
      // ignore storage failures
    }
    setUser(null);
  };

  const updateUser = (updates: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...updates };
      if (updates.onboarding) {
        try {
          window.localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(updates.onboarding));
        } catch {
          // ignore storage failures
        }
      }
      return next;
    });
  };

  return <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
