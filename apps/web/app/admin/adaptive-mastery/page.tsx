"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api-client";
import { adaptiveClient } from "@/lib/adaptive-client";
import { AdminAdaptiveStats, AdminPrerequisiteGap } from "@/types";

interface CourseOption {
  id: string;
  title: string;
}

export default function AdminAdaptiveMastery() {
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [stats, setStats] = useState<AdminAdaptiveStats | null>(null);
  const [gaps, setGaps] = useState<AdminPrerequisiteGap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    apiFetch<CourseOption[]>("/admin/courses")
      .then((data) => {
        setCourses(data || []);
        if (data?.length) setSelectedCourseId(data[0].id);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedCourseId) return;
    setLoading(true);
    setError("");
    Promise.all([
      adaptiveClient.adminStats(selectedCourseId),
      adaptiveClient.adminGaps(selectedCourseId),
    ])
      .then(([s, g]) => {
        setStats(s);
        setGaps(g || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedCourseId]);

  if (loading && !stats) {
    return <p className="mt-10 text-center text-sm text-neutral-600">Loading adaptive mastery...</p>;
  }

  if (error && !stats) {
    return <p className="mt-10 text-center text-sm text-red-600">{error}</p>;
  }

  return (
    <section className="py-10">
      <div className="mx-auto max-w-6xl px-4">
        <h1 className="text-2xl font-semibold">Adaptive Mastery Dashboard</h1>
        <p className="mt-1 text-sm text-neutral-600">Monitor concept mastery, gaps, and readiness at scale.</p>

        <div className="mt-6 flex items-center gap-3">
          <label className="text-sm font-medium text-neutral-700" htmlFor="course-select">Course</label>
          <select
            id="course-select"
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            className="rounded-md border border-neutral-300 p-2 text-sm"
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>

        {stats && (
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <Card className="p-4">
              <p className="text-xs text-neutral-500">Total concepts</p>
              <p className="mt-1 text-2xl font-semibold">{stats.total_concepts}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-neutral-500">Average difficulty</p>
              <p className="mt-1 text-2xl font-semibold">{stats.avg_difficulty.toFixed(1)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-neutral-500">Prerequisite gaps</p>
              <p className="mt-1 text-2xl font-semibold">{gaps.length}</p>
            </Card>
          </div>
        )}

        {stats && (
          <Card className="mt-6 overflow-hidden">
            <div className="border-b border-neutral-100 px-4 py-3">
              <h2 className="font-medium text-neutral-900">Concept mastery</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-neutral-50 text-neutral-600">
                  <tr>
                    <th className="px-4 py-2 font-medium">Concept</th>
                    <th className="px-4 py-2 font-medium">Difficulty</th>
                    <th className="px-4 py-2 font-medium">Avg mastery</th>
                    <th className="px-4 py-2 font-medium">Students</th>
                    <th className="px-4 py-2 font-medium">Tags</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.concepts.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-neutral-600">No concept data yet.</td>
                    </tr>
                  )}
                  {stats.concepts.map((c) => (
                    <tr key={c.id} className="border-t border-neutral-100">
                      <td className="px-4 py-2 text-neutral-900">{c.name}</td>
                      <td className="px-4 py-2 text-neutral-700">{c.difficulty_base}</td>
                      <td className="px-4 py-2 text-neutral-700">{c.avg_mastery.toFixed(2)}</td>
                      <td className="px-4 py-2 text-neutral-700">{c.student_count}</td>
                      <td className="px-4 py-2 text-neutral-700">{(c.tags || []).join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {gaps.length > 0 && (
          <Card className="mt-6 overflow-hidden">
            <div className="border-b border-neutral-100 px-4 py-3">
              <h2 className="font-medium text-neutral-900">Prerequisite gaps</h2>
            </div>
            <div className="divide-y divide-neutral-100">
              {gaps.map((g) => (
                <div key={g.concept_id} className="px-4 py-3">
                  <p className="text-sm font-medium text-neutral-900">{g.concept_name}</p>
                  <p className="text-xs text-neutral-600">Weak prerequisites: {g.weak_prerequisites.join(", ")}</p>
                  <p className="text-xs text-neutral-500">{g.suggestion}</p>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </section>
  );
}
