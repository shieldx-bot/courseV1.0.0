"use client";

import { PremiumNavbar } from "@/components/shared/premium-navbar";

export default function TestPremiumNavbar() {
  return (
    <div className="min-h-screen">
      <PremiumNavbar />

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-6">Premium Navbar Test Page</h1>
        <p className="text-neutral-600 dark:text-neutral-300 mb-8">
          Scroll down to see the glassmorphism effect and sticky behavior.
        </p>

        <div className="space-y-8">
          {[...Array(20)].map((_, i) => (
            <div key={i} className="h-32 bg-neutral-50 dark:bg-primary-800 rounded-lg flex items-center justify-center">
              <span className="text-neutral-500 dark:text-neutral-400">Content Section {i + 1}</span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}