"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { X, CheckCircle, ArrowRight, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiFetch } from "@/lib/api-client";
import type { Course } from "@/types";

const ONBOARDING_KEY = "ascendly_onboarding_done";

export function OnboardingModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [firstCourse, setFirstCourse] = useState<Course | null>(null);

  useEffect(() => {
    const done = localStorage.getItem(ONBOARDING_KEY);
    if (done) return;

    apiFetch("/courses")
      .then((courses: unknown) => {
        const courseList = courses as Course[];
        if (courseList.length > 0) {
          setFirstCourse(courseList[0]);
          // Only show onboarding on learn page, not on homepage
          if (typeof window !== 'undefined' && window.location.pathname.includes('/learn')) {
            setOpen(true);
          }
        }
      })
      .catch(() => {});
  }, []);

  const dismiss = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, "1");
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, dismiss]);

  useEffect(() => {
    if (!open) return;
    const modal = document.getElementById("onboarding-modal");
    if (!modal) return;
    const focusable = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", trap);
    return () => document.removeEventListener("keydown", trap);
  }, [open]);

  if (!open || !firstCourse) return null;

  const firstLessonId = firstCourse.syllabus[0]?.id;

  if (step === 0) {
    return (
      <div id="onboarding-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Onboarding">
        <Card className="relative max-w-lg p-8">
          <button onClick={dismiss} className="absolute right-4 top-4 text-neutral-400 hover:text-neutral-600" aria-label="Close onboarding">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="flex items-center gap-3 text-accent-600">
            <Zap className="h-8 w-8" />
            <h2 className="text-2xl font-semibold text-primary-900">Your first win in 5 minutes</h2>
          </div>
          <p className="mt-4 text-neutral-600">
            Welcome to Ascendly. You&apos;re one lesson away from your first win. Let&apos;s get you started.
          </p>
          <div className="mt-6 space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-success" />
              <div>
                <p className="font-medium text-primary-900">Pick a course</p>
                <p className="text-sm text-neutral-600">Choose from 2,000+ expert-led courses</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-success" />
              <div>
                <p className="font-medium text-primary-900">Complete your first lesson</p>
                <p className="text-sm text-neutral-600">Short, focused lessons you can finish in minutes</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-success" />
              <div>
                <p className="font-medium text-primary-900">Track your progress</p>
                <p className="text-sm text-neutral-600">Pick up where you left off on any device</p>
              </div>
            </div>
          </div>
          <Button className="mt-6 w-full" onClick={() => setStep(1)}>
            Let&apos;s go <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div id="onboarding-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Onboarding step 2">
      <Card className="relative max-w-lg p-8">
        <button onClick={dismiss} className="absolute right-4 top-4 text-neutral-400 hover:text-neutral-600" aria-label="Close onboarding">
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
        <h2 className="text-2xl font-semibold text-primary-900">Start with {firstCourse.title}</h2>
        <p className="mt-2 text-neutral-600">{firstCourse.description}</p>
        <p className="mt-4 text-sm text-neutral-500">
          {firstCourse.lesson_count} lessons &middot; {firstCourse.instructor?.name}
        </p>
        <div className="mt-6 flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={dismiss}>
            Browse courses
          </Button>
          {firstLessonId && (
            <Link href={`/learn/${firstCourse.slug}/${firstLessonId}`} className="flex-1" onClick={dismiss}>
              <Button className="w-full">
                Start first lesson <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          )}
        </div>
      </Card>
    </div>
  );
}
