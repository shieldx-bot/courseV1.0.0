import Link from "next/link";
import { Button } from "@/components/ui/button";

export function HeroCompetitive() {
  return (
    <section className="relative w-screen py-20 text-white md:py-32 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 overflow-hidden dark:bg-gradient-to-b from-primary-900 to-primary-950 bg-gradient-to-b from-primary-900 to-primary-950">
      {/* Animated background gradient */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent-500 rounded-full mix-blend-multiply filter blur-3xl animate-float"></div>
        <div className="absolute top-1/2 right-1/4 w-96 h-96 bg-primary-700 rounded-full mix-blend-multiply filter blur-3xl animate-float" style={{ animationDelay: "2s" }}></div>
      </div>

      <div className="relative mx-auto max-w-page text-center z-10">
        <div className="inline-block mb-6">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20">
            <span className="w-2 h-2 bg-accent-500 rounded-full animate-pulse"></span>
            <span className="text-sm font-medium">Join 50,000+ competitive learners</span>
          </span>
        </div>

        <h1 className="display-lg text-4xl md:text-6xl font-bold leading-tight text-balance">
          Learn. Compete.{" "}
          <span className="bg-gradient-to-r from-accent-500 to-orange-400 bg-clip-text text-transparent">
            Become Legendary
          </span>
          .
        </h1>

        <p className="mx-auto mt-8 max-w-2xl text-lg md:text-xl text-neutral-200 text-balance leading-relaxed">
          Join the ultimate competitive learning platform. Solve real-world challenges, climb the leaderboards, and build your reputation as a tech expert.
        </p>

        <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link href="/arena">
            <Button size="lg" className="w-full sm:w-auto bg-accent-500 hover:bg-accent-600 text-primary-900 font-semibold">
              Start Competing
            </Button>
          </Link>
          <Link href="/courses">
            <Button size="lg" variant="secondary" className="w-full border-white/20 text-white hover:bg-white/10 sm:w-auto">
              Browse Challenges
            </Button>
          </Link>
        </div>

        {/* Quick stats */}
        <div className="mt-16 grid grid-cols-3 gap-6 md:gap-12">
          <div className="text-center">
            <p className="text-3xl md:text-4xl font-bold text-accent-500">1000+</p>
            <p className="text-sm text-neutral-300 mt-2">Challenges</p>
          </div>
          <div className="text-center">
            <p className="text-3xl md:text-4xl font-bold text-accent-500">50K+</p>
            <p className="text-sm text-neutral-300 mt-2">Competing</p>
          </div>
          <div className="text-center">
            <p className="text-3xl md:text-4xl font-bold text-accent-500">120+</p>
            <p className="text-sm text-neutral-300 mt-2">Countries</p>
          </div>
        </div>
      </div>
    </section>
  );
}
