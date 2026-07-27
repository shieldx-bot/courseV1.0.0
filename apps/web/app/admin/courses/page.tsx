"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { apiFetch } from "@/lib/api-client";
import { apiClient } from "@/lib/api-client";
import { Plus, Trash2, RefreshCw, Download, Sparkles, Check, X, Code, Zap, Copy, FileCode } from "lucide-react";

interface Attachment {
  title: string;
  url: string;
}

interface Lesson {
  id: string;
  title: string;
  order: number;
  duration_seconds?: number;
  drive_file_id?: string;
  attachments?: Attachment[];
}

interface Course {
  id: string;
  title: string;
  slug: string;
  category_id: string;
  category_slug: string;
  category_name: string;
  description: string;
  image_url?: string;
  instructor?: { name: string; bio?: string };
  lesson_count: number;
  syllabus: Lesson[];
  outcome: string[];
}

interface DriveFile {
  id: string;
  name: string;
}

interface DriveFilesResponse {
  configured: boolean;
  files: DriveFile[];
}

interface ScanVideo {
  file_id: string;
  name: string;
  existing_in_course: boolean;
}

interface ScanCandidate {
  folder_id: string;
  folder_name: string;
  category_folder_name?: string;
  existing: boolean;
  existing_course_id: string | null;
  videos: ScanVideo[];
}

interface ScanResult {
  configured: boolean;
  candidates: ScanCandidate[];
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

export default function AdminCourses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ category_id: "", title: "", slug: "", description: "", image_url: "", instructor_name: "", instructor_bio: "" });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [attachments, setAttachments] = useState<{ lessonId: string; title: string; url: string }[]>([]);

  // AI generation state
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [aiContent, setAiContent] = useState<Record<string, { short_description: string; long_description: string; learning_outcomes: string[]; thumbnail_prompt: string }>>({});

  // Code generation state
  const [generatingCodeId, setGeneratingCodeId] = useState<string | null>(null);
  const [aiCode, setAiCode] = useState<Record<string, { starter_code: string; solution_code: string; test_cases: string; language: string }>>({});

  // Scan state
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importingAll, setImportingAll] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [driveCategoryFolderId, setDriveCategoryFolderId] = useState("");
  const [driveConfigured, setDriveConfigured] = useState(false);

  useEffect(() => {
    Promise.all([apiFetch<Course[]>("/admin/courses"), apiFetch<DriveFilesResponse>("/admin/drive/files"), apiFetch<Category[]>("/categories")])
      .then(([c, d, cats]) => {
        setCourses(c);
        setDriveFiles(d.files || []);
        setCategories(cats || []);
        setDriveConfigured(d.configured || false);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const scanDrive = async () => {
    if (!driveCategoryFolderId.trim()) {
      setError("Vui lòng nhập Drive Category Folder ID");
      return;
    }
    setScanning(true);
    setError("");
    setScanResult(null);
    try {
      const result = await apiFetch<ScanResult>("/admin/drive/scan", {
        method: "POST",
        body: JSON.stringify({ category_folder_id: driveCategoryFolderId.trim() }),
      });
      setScanResult(result);
      if (result.candidates?.length > 0 && !selectedCategory) {
        setSelectedCategory(categories[0]?.id || "");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setScanning(false);
    }
  };

  const importAllCourses = async () => {
    if (!selectedCategory || !scanResult) return;
    setImportingAll(true);
    setError("");
    const courses = scanResult.candidates
      .filter((c) => !c.existing)
      .map((c) => ({ folder_id: c.folder_id, title: c.folder_name, video_ids: c.videos.map((v) => v.file_id) }));
    try {
      await apiFetch("/admin/drive/import-all", {
        method: "POST",
        body: JSON.stringify({ category_id: selectedCategory, courses }),
      });
    } catch (e: any) {
      console.error(e);
    }
    const [updatedCourses, scanAgain] = await Promise.all([
      apiFetch<Course[]>("/admin/courses"),
      apiFetch<ScanResult>("/admin/drive/scan", {
        method: "POST",
        body: JSON.stringify({ category_folder_id: driveCategoryFolderId.trim() }),
      }),
    ]);
    setCourses(updatedCourses);
    setScanResult(scanAgain);
    setImportingAll(false);
  };

  const deleteAllAndRescan = async () => {
    if (!scanResult) return;
    setDeletingAll(true);
    setError("");
    const existingCourses = scanResult.candidates.filter(
      (c) => c.existing && c.existing_course_id && c.existing_course_id !== "just-imported"
    );
    try {
      await Promise.all(
        existingCourses.map((c) =>
          apiFetch(`/admin/courses/${c.existing_course_id}`, { method: "DELETE" })
        )
      );
      const scanAgain = await apiFetch<ScanResult>("/admin/drive/scan", {
        method: "POST",
        body: JSON.stringify({ category_folder_id: driveCategoryFolderId.trim() }),
      });
      setScanResult(scanAgain);
    } catch (e: any) {
      console.error(e);
    }
    setDeletingAll(false);
  };

  const importDriveCourse = async (folderId: string) => {
    if (!selectedCategory) {
      setError("Vui lòng chọn danh mục trước khi import");
      return;
    }
    setImportingId(folderId);
    setError("");
    const candidate = scanResult?.candidates.find((c) => c.folder_id === folderId);
    const videoIds = candidate?.videos.map((v) => v.file_id) || [];
    try {
      await apiFetch("/admin/drive/import", {
        method: "POST",
        body: JSON.stringify({ folder_id: folderId, category_id: selectedCategory, video_ids: videoIds }),
      });
      const [updatedCourses, updatedFiles] = await Promise.all([
        apiFetch<Course[]>("/admin/courses"),
        apiFetch<{ files: DriveFile[] }>("/admin/drive/files"),
      ]);
      setCourses(updatedCourses);
      setDriveFiles(updatedFiles.files || []);
      setScanResult((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          candidates: prev.candidates.map((c) =>
            c.folder_id === folderId ? { ...c, existing: true, existing_course_id: "just-imported" } : c
          ),
        };
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setImportingId(null);
    }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const body: any = {
        category_id: form.category_id,
        title: form.title,
        slug: form.slug,
        description: form.description,
        syllabus: [],
        outcome: [],
      };
      if (form.image_url) body.image_url = form.image_url;
      if (form.instructor_name) body.instructor = { name: form.instructor_name, bio: form.instructor_bio };
      await apiFetch("/admin/courses", { method: "POST", body: JSON.stringify(body) });
      const updated = await apiFetch<Course[]>("/admin/courses");
      setCourses(updated);
      setForm({ category_id: "", title: "", slug: "", description: "", image_url: "", instructor_name: "", instructor_bio: "" });
    } catch (e: any) {
      setError(e.message);
    }
  };

  const remove = async (id: string) => {
    await apiFetch(`/admin/courses/${id}`, { method: "DELETE" });
    setCourses(courses.filter((c) => c.id !== id));
  };

  const mapDrive = async (courseId: string, lessonId: string, driveFileId: string) => {
    setError("");
    try {
      await apiFetch(`/admin/courses/${courseId}/lessons/${lessonId}/drive`, {
        method: "PUT",
        body: JSON.stringify({ drive_file_id: driveFileId }),
      });
      const updated = await apiFetch<Course[]>("/admin/courses");
      setCourses(updated);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const addAttachment = async (courseId: string, lessonId: string) => {
    const data = attachments.find((a) => a.lessonId === lessonId);
    if (!data || !data.title || !data.url) return;
    setError("");
    try {
      const course = courses.find((c) => c.id === courseId);
      if (!course) return;
      const lesson = course.syllabus.find((l) => l.id === lessonId);
      const currentAttachments = lesson?.attachments || [];
      await apiFetch(`/admin/courses/${courseId}/lessons/${lessonId}`, {
        method: "PUT",
        body: JSON.stringify({
          title: lesson?.title || "",
          order: course.syllabus.indexOf(lesson!),
          duration_seconds: 0,
          attachments: [...currentAttachments, { title: data.title, url: data.url }],
        }),
      });
      setAttachments((prev) => prev.filter((a) => a.lessonId !== lessonId));
      const updated = await apiFetch<Course[]>("/admin/courses");
      setCourses(updated);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const removeAttachment = async (courseId: string, lessonId: string, attachmentIndex: number) => {
    setError("");
    try {
      const course = courses.find((c) => c.id === courseId);
      if (!course) return;
      const lesson = course.syllabus.find((l) => l.id === lessonId);
      const currentAttachments = lesson?.attachments || [];
      const updatedAttachments = currentAttachments.filter((_, i) => i !== attachmentIndex);
      await apiFetch(`/admin/courses/${courseId}/lessons/${lessonId}`, {
        method: "PUT",
        body: JSON.stringify({
          title: lesson?.title || "",
          order: course.syllabus.indexOf(lesson!),
          duration_seconds: lesson?.duration_seconds || 0,
          attachments: updatedAttachments,
        }),
      });
      const updated = await apiFetch<Course[]>("/admin/courses");
      setCourses(updated);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const generateAiContent = async (courseId: string) => {
    setGeneratingId(courseId);
    setError("");
    try {
      const result = await apiFetch<{ short_description: string; long_description: string; learning_outcomes: string[]; thumbnail_prompt: string }>(`/admin/courses/${courseId}/generate-content`, { method: "POST" });
      setAiContent((prev) => ({ ...prev, [courseId]: result }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGeneratingId(null);
    }
  };

  const generateLessonCode = async (courseId: string, lessonId: string, lessonTitle: string) => {
    setGeneratingCodeId(lessonId);
    setError("");
    try {
      const course = courses.find((c) => c.id === courseId);
      const lesson = course?.syllabus.find((l) => l.id === lessonId);
      const result = await apiClient.admin.generateLessonCode(lessonId, {
        title: lessonTitle,
        description: lesson?.title || "",
        language: "python",
      });
      setAiCode((prev) => ({ ...prev, [lessonId]: result }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGeneratingCodeId(null);
    }
  };

  const applyLessonCode = async (courseId: string, lessonId: string) => {
    const code = aiCode[lessonId];
    if (!code) return;
    setError("");
    try {
      const course = courses.find((c) => c.id === courseId);
      if (!course) return;
      const syllabus = course.syllabus.map((l) =>
        l.id === lessonId ? { ...l, starter_code: code.starter_code, solution_code: code.solution_code, test_cases: code.test_cases, language: code.language } : l
      );
      const body: any = {
        category_id: course.category_id,
        title: course.title,
        slug: course.slug,
        description: course.description,
        image_url: course.image_url || "",
        syllabus,
        outcome: course.outcome,
      };
      if (course.instructor) body.instructor = course.instructor;
      await apiFetch(`/admin/courses/${courseId}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      setAiCode((prev) => {
        const next = { ...prev };
        delete next[lessonId];
        return next;
      });
      const updated = await apiFetch<Course[]>("/admin/courses");
      setCourses(updated);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const discardLessonCode = (lessonId: string) => {
    setAiCode((prev) => {
      const next = { ...prev };
      delete next[lessonId];
      return next;
    });
  };

  const applyAiContent = async (course: Course) => {
    const content = aiContent[course.id];
    if (!content) return;
    setError("");
    try {
      const body: any = {
        category_id: course.category_id,
        title: course.title,
        slug: course.slug,
        description: content.short_description,
        image_url: course.image_url || "",
        syllabus: course.syllabus,
        outcome: content.learning_outcomes,
      };
      if (course.instructor) body.instructor = course.instructor;
      await apiFetch(`/admin/courses/${course.id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      setAiContent((prev) => {
        const next = { ...prev };
        delete next[course.id];
        return next;
      });
      const updated = await apiFetch<Course[]>("/admin/courses");
      setCourses(updated);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const discardAiContent = (courseId: string) => {
    setAiContent((prev) => {
      const next = { ...prev };
      delete next[courseId];
      return next;
    });
  };

  return (
    <section className="py-12">
      <div>
        <h1 className="text-3xl font-semibold text-primary-900">Course management</h1>

        <Card className="mt-6 p-6">
          <div>
            <h2 className="font-medium text-neutral-900">Quét khoá học từ Google Drive</h2>
            <p className="mt-1 text-sm text-neutral-600">Nhập Drive Category Folder ID để tìm khoá học mới</p>
            <div className="mt-3 flex gap-3">
              <Input
                placeholder="Ví dụ: 1CFA42JWGliKf1maEZPT-G-Ts_Y8gwUjK"
                value={driveCategoryFolderId}
                onChange={(e) => setDriveCategoryFolderId(e.target.value)}
                className="flex-1"
                aria-label="Drive Category Folder ID"
              />
              <Button onClick={scanDrive} disabled={scanning}>
                <RefreshCw className={`mr-2 h-4 w-4 ${scanning ? "animate-spin" : ""}`} />
                {scanning ? "Đang quét..." : "Quét khoá học mới"}
              </Button>
            </div>
          </div>

          {scanResult && (
            <div className="mt-4 space-y-4">
              {!scanResult.configured && (
                <p className="text-sm text-error">Drive chưa được cấu hình</p>
              )}
              {scanResult.configured && scanResult.candidates.length === 0 && (
                <p className="text-sm text-neutral-600">Không tìm thấy thư mục nào trong Drive</p>
              )}

              {scanResult.candidates.filter((c) => !c.existing).length > 0 && (
                <div className="flex items-center gap-4 border-b border-neutral-100 pb-3">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="rounded-md border border-neutral-300 p-2 text-sm"
                    aria-label="Select category for import"
                  >
                    <option value="">Chọn danh mục...</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                  <Button size="sm" onClick={importAllCourses} disabled={importingAll || !selectedCategory}>
                    <Download className="mr-1 h-4 w-4" />
                    {importingAll ? "Đang import..." : `Import tất cả (${scanResult.candidates.filter((c) => !c.existing).length})`}
                  </Button>
                  <span className="text-xs text-neutral-500">Danh mục mặc định cho các khoá import</span>
                </div>
              )}

              {scanResult.candidates.some((c) => c.existing && c.existing_course_id && c.existing_course_id !== "just-imported") && (
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="text-error hover:bg-error/10"
                    onClick={deleteAllAndRescan}
                    disabled={deletingAll}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    {deletingAll ? "Đang xoá..." : `Xoá tất cả & quét lại (${scanResult.candidates.filter((c) => c.existing && c.existing_course_id && c.existing_course_id !== "just-imported").length})`}
                  </Button>
                </div>
              )}

              {scanResult.candidates.map((candidate) => (
                <div key={candidate.folder_id} className={`rounded-md border p-4 ${candidate.existing ? "border-neutral-200 bg-neutral-50" : "border-primary-200 bg-primary-50/30"}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-neutral-900">{candidate.folder_name}</p>
                      <p className="text-xs text-neutral-600">
                        {candidate.videos.length} videos
                        {candidate.category_folder_name ? ` · ${candidate.category_folder_name}` : ""}
                        {candidate.existing ? ` · Đã tồn tại (${candidate.existing_course_id})` : " · Khoá học mới"}
                      </p>
                    </div>
                    {!candidate.existing ? (
                      <Button
                        size="sm"
                        onClick={() => importDriveCourse(candidate.folder_id)}
                        disabled={importingId === candidate.folder_id || !selectedCategory}
                      >
                        <Download className="mr-1 h-4 w-4" />
                        {importingId === candidate.folder_id ? "Đang import..." : "Import"}
                      </Button>
                    ) : candidate.existing_course_id && candidate.existing_course_id !== "just-imported" ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="text-error hover:bg-error/10"
                        onClick={async () => {
                          await apiFetch(`/admin/courses/${candidate.existing_course_id}`, { method: "DELETE" });
      const result = await apiFetch<ScanResult>("/admin/drive/scan", {
                            method: "POST",
                            body: JSON.stringify({ category_folder_id: driveCategoryFolderId.trim() }),
                          });
                          setScanResult(result);
                        }}
                      >
                        <Trash2 className="mr-1 h-4 w-4" />
                        Xoá & quét lại
                      </Button>
                    ) : null}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {candidate.videos.map((v) => (
                      <span
                        key={v.file_id}
                        className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                          v.existing_in_course
                            ? "bg-green-100 text-green-700"
                            : "bg-neutral-100 text-neutral-600"
                        }`}
                        title={v.existing_in_course ? "Đã có trong khoá học" : "Video mới"}
                      >
                        {v.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="mt-6 p-6">
          <h2 className="font-medium text-neutral-900">Add course</h2>
          <form onSubmit={create} className="mt-4 grid gap-4 md:grid-cols-2">
            <Input placeholder="Category ID" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} required aria-label="Category ID" />
            <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required aria-label="Course title" />
            <Input placeholder="Slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required aria-label="Course slug" />
            <Input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required aria-label="Description" />
            <Input placeholder="Image URL (optional)" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} aria-label="Image URL" />
            <Input placeholder="Instructor name (optional)" value={form.instructor_name} onChange={(e) => setForm({ ...form, instructor_name: e.target.value })} aria-label="Instructor name" />
            <Input placeholder="Instructor bio (optional)" value={form.instructor_bio} onChange={(e) => setForm({ ...form, instructor_bio: e.target.value })} aria-label="Instructor bio" />
            <Button type="submit" className="md:col-span-2">Create course</Button>
          </form>
          {error && <p className="mt-3 text-sm text-error">{error}</p>}
        </Card>

        <Card className="mt-6 p-6">
          <h2 className="font-medium text-neutral-900">Courses</h2>
          {loading ? <p className="mt-3 text-sm text-neutral-600">Loading...</p> : (
            <ul className="mt-3 space-y-3">
              {courses.map((c) => (
                <li key={c.id} className="border-b border-neutral-100 pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-neutral-900">{c.title}</p>
                      <p className="text-xs text-neutral-600">
                        {c.category_name} · {c.lesson_count} lessons
                        {c.instructor && ` · Instructor: ${c.instructor.name}`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => generateAiContent(c.id)} disabled={generatingId === c.id}>
                        <Sparkles className={`mr-1 h-4 w-4 ${generatingId === c.id ? "animate-pulse" : ""}`} />
                        {generatingId === c.id ? "Đang tạo..." : "AI Content"}
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setExpanded(expanded === c.id ? null : c.id)}>
                        {expanded === c.id ? "Hide lessons" : "Manage videos"}
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => remove(c.id)}>Delete</Button>
                    </div>
                  </div>
                  {expanded === c.id && (
                    <div className="mt-3 space-y-3">
                      {c.syllabus.map((lesson) => (
                        <div key={lesson.id} className="rounded-md bg-neutral-50 p-3">
                          <div className="grid gap-2 md:grid-cols-3">
                            <p className="text-sm text-neutral-900">{lesson.title}</p>
                            <p className="text-xs text-neutral-600">{lesson.drive_file_id ? `Drive: ${lesson.drive_file_id}` : "No Drive file mapped"}</p>
                            <select
                              value={lesson.drive_file_id || ""}
                              onChange={(e) => mapDrive(c.id, lesson.id, e.target.value)}
                              className="rounded-md border border-neutral-300 p-2 text-sm"
                              aria-label="Select Drive file"
                            >
                              <option value="">Select Drive file</option>
                              {driveFiles.map((f) => (
                                <option key={f.id} value={f.id}>{f.name}</option>
                              ))}
                            </select>
                          </div>

                          <div className="mt-3 flex gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => generateLessonCode(c.id, lesson.id, lesson.title)}
                              disabled={generatingCodeId === lesson.id}
                            >
                              <Sparkles className={`mr-1 h-3 w-3 ${generatingCodeId === lesson.id ? "animate-pulse" : ""}`} />
                              {generatingCodeId === lesson.id ? "Đang tạo code..." : "Generate Code"}
                            </Button>
                          </div>

                          {aiCode[lesson.id] && (
                            <div className="mt-3 rounded-md border border-primary-200 bg-primary-50/30 p-3">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-medium text-primary-900">AI-Generated Code</p>
                                <div className="flex gap-1">
                                  <Button size="sm" variant="secondary" onClick={() => applyLessonCode(c.id, lesson.id)}>
                                    <Check className="mr-1 h-3 w-3" />
                                    Apply
                                  </Button>
                                  <Button size="sm" variant="secondary" onClick={() => discardLessonCode(lesson.id)}>
                                    <X className="mr-1 h-3 w-3" />
                                    Discard
                                  </Button>
                                </div>
                              </div>
                              <div className="space-y-2 text-xs">
                                <div>
                                  <p className="font-medium text-neutral-700">Language: {aiCode[lesson.id].language}</p>
                                  <p className="text-neutral-600 font-mono text-xs max-h-32 overflow-auto bg-neutral-100 p-2 rounded">
                                    {aiCode[lesson.id].starter_code.slice(0, 500)}{aiCode[lesson.id].starter_code.length > 500 ? "..." : ""}
                                  </p>
                                </div>
                                <div>
                                  <p className="font-medium text-neutral-700">Solution Code (preview):</p>
                                  <p className="text-neutral-600 font-mono text-xs max-h-32 overflow-auto bg-neutral-100 p-2 rounded">
                                    {aiCode[lesson.id].solution_code.slice(0, 500)}{aiCode[lesson.id].solution_code.length > 500 ? "..." : ""}
                                  </p>
                                </div>
                                <div>
                                  <p className="font-medium text-neutral-700">Test Cases (preview):</p>
                                  <p className="text-neutral-600 font-mono text-xs max-h-32 overflow-auto bg-neutral-100 p-2 rounded">
                                    {aiCode[lesson.id].test_cases.slice(0, 500)}{aiCode[lesson.id].test_cases.length > 500 ? "..." : ""}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="mt-3">
                            <p className="text-xs font-medium text-neutral-700">Attachments</p>
                            {lesson.attachments && lesson.attachments.length > 0 && (
                              <ul className="mt-1 space-y-1">
                                {lesson.attachments.map((a, i) => (
                                  <li key={i} className="flex items-center gap-2 text-xs text-neutral-600">
                                    <span>{a.title}</span>
                                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-primary-700 hover:underline">View</a>
                                    <button
                                      onClick={() => removeAttachment(c.id, lesson.id, i)}
                                      className="text-error hover:underline"
                                      aria-label={`Remove attachment ${a.title}`}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                            <div className="mt-2 flex gap-2">
                              <Input
                                placeholder="Attachment title"
                                value={attachments.find((a) => a.lessonId === lesson.id)?.title || ""}
                                onChange={(e) => setAttachments((prev) => {
                                  const filtered = prev.filter((a) => a.lessonId !== lesson.id);
                                  return [...filtered, { lessonId: lesson.id, title: e.target.value, url: prev.find((a) => a.lessonId === lesson.id)?.url || "" }];
                                })}
                                className="flex-1 text-xs"
                                aria-label="Attachment title"
                              />
                              <Input
                                placeholder="Attachment URL"
                                value={attachments.find((a) => a.lessonId === lesson.id)?.url || ""}
                                onChange={(e) => setAttachments((prev) => {
                                  const filtered = prev.filter((a) => a.lessonId !== lesson.id);
                                  return [...filtered, { lessonId: lesson.id, title: prev.find((a) => a.lessonId === lesson.id)?.title || "", url: e.target.value }];
                                })}
                                className="flex-1 text-xs"
                                aria-label="Attachment URL"
                              />
                              <Button size="sm" onClick={() => addAttachment(c.id, lesson.id)}>
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                      {c.syllabus.length === 0 && <p className="text-sm text-neutral-600">No lessons yet.</p>}
                    </div>
                  )}
                  {aiContent[c.id] && (
                    <div className="mt-3 rounded-md border border-primary-200 bg-primary-50/30 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-medium text-primary-900">AI-Generated Content</p>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => applyAiContent(c)}>
                            <Check className="mr-1 h-4 w-4" />
                            Apply
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => discardAiContent(c.id)}>
                            <X className="mr-1 h-4 w-4" />
                            Discard
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div>
                          <p className="font-medium text-neutral-700">Short Description:</p>
                          <p className="text-neutral-600">{aiContent[c.id].short_description}</p>
                        </div>
                        <div>
                          <p className="font-medium text-neutral-700">Long Description:</p>
                          <p className="text-neutral-600">{aiContent[c.id].long_description}</p>
                        </div>
                        <div>
                          <p className="font-medium text-neutral-700">Learning Outcomes:</p>
                          <ul className="list-disc pl-5 text-neutral-600">
                            {aiContent[c.id].learning_outcomes.map((o: string, i: number) => (
                              <li key={i}>{o}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="font-medium text-neutral-700">Thumbnail Prompt:</p>
                          <p className="text-neutral-600 italic">{aiContent[c.id].thumbnail_prompt}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </section>
  );
}
