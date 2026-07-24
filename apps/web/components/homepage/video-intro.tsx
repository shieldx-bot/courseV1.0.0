"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";

export function VideoIntro() {
  const [open, setOpen] = useState(false);

  return (
    <section className="py-16 dark:bg-neutral-900">
      <div className="mx-auto max-w-page px-6 text-center">
        <h2 className="text-2xl font-semibold text-primary-900 dark:text-white">
          See how Ascendly works in 90 seconds
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-neutral-600 dark:text-neutral-300">
          A quick walkthrough of the platform, the trial, and how to start your first course.
        </p>
        <div className="mt-8">
          <Button onClick={() => setOpen(true)} size="lg" variant="secondary">
            <Play className="mr-2 h-4 w-4" /> Watch the intro
          </Button>
        </div>

        {open && (
          <div className="mt-6 aspect-video w-full max-w-3xl mx-auto overflow-hidden rounded-lg bg-black">
            {process.env.NEXT_PUBLIC_INTRO_VIDEO_URL ? (
              <video
                controls
                autoPlay
                className="h-full w-full"
                onContextMenu={(e) => e.preventDefault()}
                src={process.env.NEXT_PUBLIC_INTRO_VIDEO_URL}
              >
                Your browser does not support the video tag.
              </video>
            ) : (
              <div className="flex h-full items-center justify-center text-white">
                <p className="text-sm">Intro video placeholder — upload via NEXT_PUBLIC_INTRO_VIDEO_URL</p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
