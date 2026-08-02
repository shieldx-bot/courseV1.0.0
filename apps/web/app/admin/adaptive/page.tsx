"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiClient, apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type {
  AdminAdaptiveStats,
  AdminConcept,
  AdminConceptCreate,
  AdminPrerequisiteGap,
} from "@/types/adaptive";

type AdminCourse = {
  id: string;
  title: string;
  syllabus?: Array<{ id: string; title: string }>;
};

type ConceptForm = {
  name: string;
  description: string;
  difficulty_base: number;
  tags: string;
  lesson_ids: string[];
  prerequisite_concepts: string[];
};

const EMPTY_FORM: ConceptForm = {
  name: "",
  description: "",
  difficulty_base: 5,
  tags: "",
  lesson_ids: [],
  prerequisite_concepts: [],
};

function parseTags(value: string): string[] {
  return value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function toggleArrayItem(current: string[], value: string): string[] {
  return current.includes(value)
    ? current.filter((v) => v !== value)
    : [...current, value];
}

export default function AdminAdaptivePage() {
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [concepts, setConcepts] = useState<AdminConcept[]>([]);
  const [stats, setStats] = useState<AdminAdaptiveStats | null>(null);
  const [gaps, setGaps] = useState<AdminPrerequisiteGap[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingConcepts, setLoadingConcepts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [form, setForm] = useState<ConceptForm>(EMPTY_FORM);
  const [editing, setEditing] = useState<AdminConcept | null>(null);
  const [saving, setSaving] = useState(false);

  const [bulkText, setBulkText] = useState("");
  const [bulkResult, setBulkResult] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingCourses(true);
    apiFetch<AdminCourse[]>("/admin/courses")
      .then((data) => {
        if (cancelled) return;
        setCourses(data || []);
        if (data?.length) setSelectedCourseId(data[0].id);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || "Failed to load courses");
      })
      .finally(() => {
        if (!cancelled) setLoadingCourses(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshData = useCallback(async () => {
    if (!selectedCourseId) return;
    setLoadingConcepts(true);
    let list: AdminConcept[] = [];
    let listFailed = false;
    try {
      list = await apiClient.admin.adaptive.listConcepts(selectedCourseId);
    } catch {
      listFailed = true;
    }
    let statsData: AdminAdaptiveStats | null = null;
    try {
      statsData = await apiClient.admin.adaptive.stats(selectedCourseId);
    } catch {
      // stats are optional — the page still works without them
    }
    let gapsData: AdminPrerequisiteGap[] = [];
    try {
      gapsData = await apiClient.admin.adaptive.gaps(selectedCourseId);
    } catch {
      // gaps are optional — the page still works without them
    }
    setConcepts(list || []);
    setStats(statsData);
    setGaps(gapsData || []);
    if (listFailed) {
      setNotice("Could not load concepts — the adaptive admin endpoint may be unavailable.");
    }
    setLoadingConcepts(false);
  }, [selectedCourseId]);

  useEffect(() => {
    if (!selectedCourseId) return;
    setError(null);
    void refreshData();
  }, [selectedCourseId, refreshData]);

  const selectedCourse = useMemo(
    () => courses.find((c) => c.id === selectedCourseId),
    [courses, selectedCourseId]
  );
  const lessons = useMemo(() => selectedCourse?.syllabus || [], [selectedCourse]);

  function handleCourseChange(value: string) {
    setSelectedCourseId(value);
    setEditing(null);
    setForm(EMPTY_FORM);
    setBulkResult(null);
    setBulkError(null);
  }

  function startCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
  }

  function startEdit(concept: AdminConcept) {
    setEditing(concept);
    setForm({
      name: concept.name,
      description: concept.description ?? "",
      difficulty_base: concept.difficulty_base,
      tags: (concept.tags || []).join(", "),
      lesson_ids: concept.lesson_ids || [],
      prerequisite_concepts: concept.prerequisite_concepts || [],
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCourseId || !form.name.trim()) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    const payload: AdminConceptCreate = {
      course_id: selectedCourseId,
      name: form.name.trim(),
      description: form.description.trim(),
      difficulty_base: Math.max(1, Math.min(10, form.difficulty_base)),
      tags: parseTags(form.tags),
      lesson_ids: form.lesson_ids,
      prerequisite_concepts: form.prerequisite_concepts,
    };
    try {
      if (editing) {
        await apiClient.admin.adaptive.updateConcept(editing.id, payload);
        setNotice("Concept updated");
      } else {
        await apiClient.admin.adaptive.createConcept(payload);
        setNotice("Concept created");
      }
      setEditing(null);
      setForm(EMPTY_FORM);
      await refreshData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save concept");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(concept: AdminConcept) {
    if (!window.confirm(`Delete concept "${concept.name}"?`)) return;
    setError(null);
    setNotice(null);
    try {
      await apiClient.admin.adaptive.deleteConcept(concept.id);
      setNotice("Concept deleted");
      if (editing?.id === concept.id) {
        setEditing(null);
        setForm(EMPTY_FORM);
      }
      await refreshData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete concept");
    }
  }

  function parseBulkInput(text: string): AdminConceptCreate[] {
    const trimmed = text.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      const parsed = JSON.parse(trimmed) as unknown;
      const arr = Array.isArray(parsed) ? parsed : (parsed as { concepts?: unknown[] }).concepts;
      if (!Array.isArray(arr)) throw new Error("JSON must be an array of concepts or { concepts: [...] }");
      return arr.map((raw) => {
        const c = (raw ?? {}) as Record<string, unknown>;
        return {
          course_id: selectedCourseId,
          name: String(c.name ?? ""),
          description: String(c.description ?? ""),
          difficulty_base: Math.max(1, Math.min(10, Number(c.difficulty_base) || 5)),
          tags: Array.isArray(c.tags) ? c.tags.map(String) : [],
          lesson_ids: Array.isArray(c.lesson_ids) ? c.lesson_ids.map(String) : [],
          prerequisite_concepts: Array.isArray(c.prerequisite_concepts) ? c.prerequisite_concepts.map(String) : [],
        };
      });
    }
    return trimmed
      .split("\n")
      .map((line): AdminConceptCreate | null => {
        const [name = "", difficulty = "5", tags = ""] = line.split("|").map((p) => p.trim());
        if (!name) return null;
        return {
          course_id: selectedCourseId,
          name,
          description: "",
          difficulty_base: Math.max(1, Math.min(10, Number(difficulty) || 5)),
          tags: parseTags(tags),
          lesson_ids: [] as string[],
          prerequisite_concepts: [] as string[],
        };
      })
      .filter((c): c is AdminConceptCreate => c !== null);
  }

  async function handleBulkImport() {
    if (!selectedCourseId || !bulkText.trim()) return;
    setBulkError(null);
    setBulkResult(null);
    try {
      const parsed = parseBulkInput(bulkText);
      if (!parsed.length) {
        setBulkError("No concepts to import — enter at least one line or a JSON array.");
        return;
      }
      const res = await apiClient.admin.adaptive.bulkCreateConcepts(selectedCourseId, parsed);
      setBulkResult(`Imported ${res.created} concept(s).`);
      setBulkText("");
      await refreshData();
    } catch (e) {
      setBulkError(e instanceof Error ? e.message : "Bulk import failed");
    }
  }

  const avgMastery = useMemo(() => {
    const scores = stats?.concepts?.map((c) => c.avg_mastery).filter((v) => typeof v === "number") ?? [];
    if (!scores.length) return 0;
    return scores.reduce((sum, v) => sum + v, 0) / scores.length;
  }, [stats]);

  if (loadingCourses) {
    return <p className="mt-10 text-center text-sm text-neutral-600">Loading adaptive learning admin...</p>;
  }

  return (
    <section className="space-y-6" aria-labelledby="admin-adaptive-title">
      <div>
        <h1 id="admin-adaptive-title" className="text-2xl font-semibold">Adaptive Learning</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Manage concept definitions, prerequisites, and mastery stats per course.
        </p>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="course-select" className="text-sm font-medium text-neutral-700">
          Course
        </label>
        <select
          id="course-select"
          value={selectedCourseId}
          onChange={(e) => handleCourseChange(e.target.value)}
          className="rounded-md border border-neutral-300 p-2 text-sm"
        >
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
        {selectedCourse && (
          <span className="text-xs text-neutral-500">
            {lessons.length} lesson(s) available
          </span>
        )}
      </div>

      {stats && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-4">
            <p className="text-xs text-neutral-500">Total concepts</p>
            <p className="mt-1 text-2xl font-semibold">{stats.total_concepts}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-neutral-500">Average difficulty</p>
            <p className="mt-1 text-2xl font-semibold">{stats.avg_difficulty.toFixed(1)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-neutral-500">Average mastery</p>
            <p className="mt-1 text-2xl font-semibold">{avgMastery.toFixed(2)}</p>
          </Card>
        </div>
      )}

      {stats && stats.concepts.length > 0 && (
        <Card className="p-4">
          <h2 className="font-medium text-neutral-900">Mastery heatmap</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Color shows average mastery per concept (red &lt;3, amber 3–6, green &gt;6).
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm" aria-label="Concept mastery heatmap">
              <thead className="bg-neutral-50 text-neutral-600">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">Concept</th>
                  <th scope="col" className="px-4 py-2 font-medium">Difficulty</th>
                  <th scope="col" className="px-4 py-2 font-medium">Avg mastery</th>
                  <th scope="col" className="px-4 py-2 font-medium">Students</th>
                </tr>
              </thead>
              <tbody>
                {stats.concepts.map((c) => {
                  const band =
                    c.avg_mastery < 3
                      ? "bg-red-100 text-red-700"
                      : c.avg_mastery <= 6
                        ? "bg-amber-100 text-amber-700"
                        : "bg-emerald-100 text-emerald-700";
                  return (
                    <tr key={c.id} className="border-t border-neutral-100">
                      <td className="px-4 py-2 font-medium text-neutral-900">{c.name}</td>
                      <td className="px-4 py-2 text-neutral-600">{c.difficulty_base}/10</td>
                      <td className="px-4 py-2">
                        <span
                          data-testid={`heat-cell-${c.id}`}
                          title={`${c.student_count} students, avg ${c.avg_mastery.toFixed(1)}`}
                          className={`inline-block rounded px-2 py-1 text-xs font-medium ${band}`}
                        >
                          {c.avg_mastery.toFixed(1)}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-neutral-600">{c.student_count}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-neutral-600" aria-label="Heatmap legend">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded bg-red-200" /> &lt;3 weak
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded bg-amber-200" /> 3–6 needs work
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded bg-emerald-200" /> &gt;6 strong
            </span>
          </div>
        </Card>
      )}

      {gaps.length > 0 && (
        <Card className="p-4">
          <h2 className="font-medium text-neutral-900">Prerequisite gaps</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Concepts students struggle with because a prerequisite is weak.
          </p>
          <ul className="mt-3 space-y-3">
            {gaps.map((gap) => (
              <li key={gap.concept_id} className="rounded-lg border border-neutral-200 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-neutral-900">{gap.concept_name}</span>
                  <Badge variant="warning" size="sm">
                    Needs: {gap.weak_prerequisites.join(", ")}
                  </Badge>
                </div>
                {gap.suggestion && <p className="mt-1 text-xs text-neutral-600">{gap.suggestion}</p>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <div className="border-b border-neutral-100 px-4 py-3">
            <h2 className="font-medium text-neutral-900">Concepts</h2>
          </div>
          {loadingConcepts ? (
            <p className="px-4 py-8 text-center text-sm text-neutral-600">Loading concepts...</p>
          ) : concepts.length === 0 ? (
            <EmptyState
              title="No concepts yet"
              description={selectedCourseId ? "Create a concept or use bulk import to get started." : "Select a course to manage its concepts."}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm" aria-label="Course concepts">
                <thead className="bg-neutral-50 text-neutral-600">
                  <tr>
                    <th scope="col" className="px-4 py-2 font-medium">Concept</th>
                    <th scope="col" className="px-4 py-2 font-medium">Difficulty</th>
                    <th scope="col" className="px-4 py-2 font-medium">Tags</th>
                    <th scope="col" className="px-4 py-2 font-medium">Prerequisites</th>
                    <th scope="col" className="px-4 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {concepts.map((concept) => (
                    <tr key={concept.id} className="border-t border-neutral-100 align-top">
                      <td className="px-4 py-2">
                        <p className="font-medium text-neutral-900">{concept.name}</p>
                        {concept.description && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-neutral-500">{concept.description}</p>
                        )}
                        <p className="mt-0.5 text-xs text-neutral-400">{concept.slug}</p>
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant="accent" size="sm">{concept.difficulty_base}/10</Badge>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap gap-1">
                          {(concept.tags || []).length === 0 ? (
                            <span className="text-xs text-neutral-400">—</span>
                          ) : (
                            (concept.tags || []).map((tag) => (
                              <Badge key={tag} variant="secondary" size="sm">{tag}</Badge>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-xs text-neutral-600">
                        {(concept.prerequisite_concepts || []).length === 0
                          ? <span className="text-neutral-400">—</span>
                          : (concept.prerequisite_concepts || []).join(", ")}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => startEdit(concept)}
                            aria-label={`Edit ${concept.name}`}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleDelete(concept)}
                            aria-label={`Delete ${concept.name}`}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-neutral-900">{editing ? "Edit concept" : "Create concept"}</h2>
            {editing && (
              <Button size="sm" variant="ghost" onClick={startCreate}>Cancel</Button>
            )}
          </div>
          <form onSubmit={handleSave} className="mt-4 space-y-4">
            <Input
              label="Concept name"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
            <div>
              <label htmlFor="concept-description" className="block text-sm font-medium text-neutral-700">
                Description
              </label>
              <Textarea
                id="concept-description"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div>
              <label htmlFor="concept-difficulty" className="block text-sm font-medium text-neutral-700">
                Difficulty (1–10)
              </label>
              <select
                id="concept-difficulty"
                value={form.difficulty_base}
                onChange={(e) => setForm((prev) => ({ ...prev, difficulty_base: Number(e.target.value) }))}
                className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-sm"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <Input
              label="Tags (comma-separated)"
              value={form.tags}
              onChange={(e) => setForm((prev) => ({ ...prev, tags: e.target.value }))}
              placeholder="basics, python"
            />

            <fieldset>
              <legend className="text-sm font-medium text-neutral-700">Linked lessons</legend>
              {lessons.length === 0 ? (
                <p className="mt-1 text-xs text-neutral-500">No lessons available for this course.</p>
              ) : (
                <div className="mt-2 grid max-h-40 gap-1 overflow-y-auto rounded-md border border-neutral-200 p-2">
                  {lessons.map((lesson) => (
                    <label key={lesson.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.lesson_ids.includes(lesson.id)}
                        onChange={() => setForm((prev) => ({ ...prev, lesson_ids: toggleArrayItem(prev.lesson_ids, lesson.id) }))}
                      />
                      <span className="truncate">{lesson.title || lesson.id}</span>
                    </label>
                  ))}
                </div>
              )}
            </fieldset>

            <fieldset>
              <legend className="text-sm font-medium text-neutral-700">Prerequisite concepts</legend>
              {concepts.length === 0 ? (
                <p className="mt-1 text-xs text-neutral-500">No concepts to use as prerequisites yet.</p>
              ) : (
                <div className="mt-2 grid max-h-40 gap-1 overflow-y-auto rounded-md border border-neutral-200 p-2">
                  {concepts
                    .filter((c) => c.id !== editing?.id)
                    .map((c) => (
                      <label key={c.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={form.prerequisite_concepts.includes(c.id)}
                          onChange={() => setForm((prev) => ({ ...prev, prerequisite_concepts: toggleArrayItem(prev.prerequisite_concepts, c.id) }))}
                        />
                        <span className="truncate">{c.name}</span>
                      </label>
                    ))}
                </div>
              )}
            </fieldset>

            <Button type="submit" loading={saving} disabled={!selectedCourseId}>
              {editing ? "Save changes" : "Create concept"}
            </Button>
          </form>
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="font-medium text-neutral-900">Bulk import</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Paste JSON (array of concepts or {"{ \"concepts\": [...] }"}) or lines in the format{" "}
          <code className="rounded bg-neutral-100 px-1">name | difficulty | tag1,tag2</code>.
        </p>
        <Textarea
          aria-label="Bulk import input"
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          rows={5}
          placeholder={"Variables | 1 | basics,python\nControl Flow | 2 | basics"}
          className="mt-3"
        />
        <div className="mt-3 flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={handleBulkImport}
            disabled={!selectedCourseId || !bulkText.trim()}
            aria-label="Import concepts"
          >
            Import concepts
          </Button>
          {bulkResult && <p role="status" className="text-sm text-emerald-700">{bulkResult}</p>}
          {bulkError && <p role="alert" className="text-sm text-red-700">{bulkError}</p>}
        </div>
      </Card>
    </section>
  );
}
