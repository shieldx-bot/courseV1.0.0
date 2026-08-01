import Link from "next/link";
import { Button } from "@/components/ui/button";

export function CompetitiveCTA() {
  return (
    <section className="py-16 md:py-24 bg-neutral-50 dark:bg-neutral-950">
      <div className="mx-auto max-w-page px-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary-900 via-primary-900 to-primary-950 text-white px-6 py-16 md:px-16 md:py-24 text-center">
          {/* Animated background elements */}
          <div className="absolute inset-0 opacity-20" aria-hidden="true">
            <div className="absolute top-0 right-0 w-96 h-96 bg-accent-500 rounded-full mix-blend-multiply filter blur-3xl animate-float"></div>
            <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-primary-700 rounded-full mix-blend-multiply filter blur-3xl animate-float" style={{ animationDelay: "2s" }}></div>
          </div>

          <div className="relative mx-auto max-w-3xl">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 mb-6">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
              <span className="text-sm font-semibold text-white/90">1,284 competitors online now</span>
            </div>

            <h2 className="display-md text-3xl md:text-5xl font-bold mb-6 text-balance">
              Ready to Join the Ranks of Legendary Developers?
            </h2>

            <p className="text-lg md:text-xl text-neutral-200 max-w-2xl mx-auto mb-12 text-balance leading-relaxed">
              Start competing today and build your reputation as a top tech expert. Thousands of developers are already climbing the leaderboards.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
          <Link href="/register">
              <Button size="lg" className="w-full sm:w-auto bg-accent-500 hover:bg-accent-600 text-primary-900 font-semibold">
                Start Your Journey
              </Button>
            </Link>
            <Link href="/explore">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto border-white/20 text-white hover:bg-white/10">
                Explore Challenges
              </Button>
            </Link>
            </div>

            {/* Social proof */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-neutral-300 pt-8 border-t border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚡</span>
            <span>Free to start</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🎁</span>
            <span>Earn real rewards</span>
          </div>
          <div className="flex items-center gap-2">
              <span className="text-xl">🌍</span>
              <span>Global community</span>
            </div>
              <div className="flex items-center gap-2">
                <span className="text-xl">⭐</span>
                <span>4.8/5 from 12K reviews</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
