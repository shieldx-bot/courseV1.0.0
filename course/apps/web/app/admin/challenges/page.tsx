"use client";

import { useEffect, useState, useCallback } from "react";
import { communityApi } from "@/lib/community-api";
import type { Challenge } from "@/types/community";

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  hard: "bg-rose-100 text-rose-700",
  expert: "bg-purple-100 text-purple-700",
};

const STATUS_COLORS: Record<string, string> = {
  published: "bg-emerald-100 text-emerald-700",
  draft: "bg-orange-100 text-orange-700",
  archived: "bg-gray-100 text-gray-600",
};

const PER_PAGE = 15;

interface Stats {
  total: number;
  published: number;
  drafts: number;
  total_attempts: number;
  completion_rate: number;
  by_difficulty: Record<string, number>;
  by_source: Record<string, number>;
}

const EMPTY_STATS: Stats = {
  total: 0,
  published: 0,
  drafts: 0,
  total_attempts: 0,
  completion_rate: 0,
  by_difficulty: {},
  by_source: {},
};

export default function AdminChallengesPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Challenge | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const params: any = { page, per_page: PER_PAGE };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (difficultyFilter) params.difficulty = difficultyFilter;
      if (sourceFilter) params.source = sourceFilter;
      const data = await communityApi.adminListChallenges(params);
      setChallenges(data.challenges || []);
      setTotal(data.total || 0);
    } catch (e: any) {
      setMessage(`Lỗi: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, difficultyFilter, sourceFilter, page]);

  const loadStats = useCallback(async () => {
    try {
      const s = await communityApi.adminChallengeStats();
      setStats(s);
    } catch {
      setStats(EMPTY_STATS);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleStatusChange = async (id: string, action: "publish" | "unpublish" | "delete") => {
    try {
      if (action === "publish") {
        await communityApi.adminPublishChallenge(id);
      } else if (action === "unpublish") {
        await communityApi.adminUnpublishChallenge(id);
      } else {
        if (!confirm("Bạn có chắc muốn xóa challenge này vĩnh viễn?")) return;
        await communityApi.adminDeleteChallenge(id);
      }
      setMessage("✅ Thao tác thành công!");
      await load();
      await loadStats();
    } catch (e: any) {
      setMessage(`❌ Lỗi: ${e.message}`);
    }
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    setMessage("");
    try {
      const res = await communityApi.adminUpdateChallenge(selected._id, {
        title: selected.title,
        description: selected.description,
        difficulty: selected.difficulty,
        type: selected.type,
        skills_raw: selected.skills_raw,
        status: selected.status,
      });
      setSelected(res.challenge || selected);
      setMessage("✅ Đã lưu thay đổi!");
      await load();
      await loadStats();
    } catch (e: any) {
      setMessage(`❌ Lỗi: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <section className="py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Challenge Management</h1>
          <p className="text-sm text-neutral-500 mt-1">Quản lý toàn bộ challenges trên hệ thống</p>
        </div>
      </div>

      {/* Stats overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">Tổng</p>
          <p className="text-2xl font-bold mt-1">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-emerald-600">Published</p>
          <p className="text-2xl font-bold mt-1 text-emerald-600">{stats.published}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-orange-600">Draft</p>
          <p className="text-2xl font-bold mt-1 text-orange-600">{stats.drafts}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">Lượt làm</p>
          <p className="text-2xl font-bold mt-1">{stats.total_attempts}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">Hoàn thành</p>
          <p className="text-2xl font-bold mt-1">{Math.round((stats.completion_rate || 0) * 100)}%</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">AI / User</p>
          <p className="text-2xl font-bold mt-1">
            <span className="text-indigo-600">{stats.by_source?.ai || 0}</span>
            <span className="text-neutral-300 mx-1">/</span>
            <span className="text-purple-600">{stats.by_source?.user || 0}</span>
          </p>
        </div>
      </div>

      {/* Difficulty breakdown */}
      {(Object.keys(stats.by_difficulty || {}).length > 0) && (
        <div className="flex flex-wrap gap-2 mb-6">
          {Object.entries(stats.by_difficulty).map(([d, count]) => (
            <span key={d} className={`px-3 py-1 rounded-full text-xs font-medium ${DIFFICULTY_COLORS[d] || "bg-gray-100"}`}>
              {d}: {count}
            </span>
          ))}
        </div>
      )}

      {message && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-neutral-50 border border-neutral-200 text-sm">
          {message}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm mb-6 flex flex-col md:flex-row gap-3">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="🔍 Tìm theo tiêu đề, mô tả, kỹ năng..."
          className="flex-1 px-3 py-2 border border-neutral-200 rounded-lg text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-neutral-200 rounded-lg text-sm"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
        <select
          value={difficultyFilter}
          onChange={(e) => { setDifficultyFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-neutral-200 rounded-lg text-sm"
        >
          <option value="">Tất cả độ khó</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
          <option value="expert">Expert</option>
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-neutral-200 rounded-lg text-sm"
        >
          <option value="">Tất cả nguồn</option>
          <option value="ai">🤖 AI</option>
          <option value="user">👤 User</option>
        </select>
      </div>

      {/* Challenges table */}
      {loading ? (
        <div className="text-center py-16 text-neutral-500">Đang tải challenges...</div>
      ) : challenges.length === 0 ? (
        <div className="text-center py-16 text-neutral-500">Không tìm thấy challenge nào.</div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 border-b border-neutral-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-neutral-600">Challenge</th>
                    <th className="px-4 py-3 font-medium text-neutral-600">Difficulty</th>
                    <th className="px-4 py-3 font-medium text-neutral-600">Type</th>
                    <th className="px-4 py-3 font-medium text-neutral-600">Status</th>
                    <th className="px-4 py-3 font-medium text-neutral-600">Stats</th>
                    <th className="px-4 py-3 font-medium text-neutral-600">Source</th>
                    <th className="px-4 py-3 font-medium text-neutral-600 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {challenges.map((c) => (
                    <tr key={c._id} className="hover:bg-neutral-50">
                      <td className="px-4 py-3 max-w-[300px]">
                        <div className="font-medium truncate">{c.title}</div>
                        <div className="text-xs text-neutral-500 truncate">{c.description}</div>
                        <div className="text-xs text-neutral-400 mt-1">
                          {new Date(c.created_at).toLocaleDateString("vi-VN")} · ⭐ {c.quality_score?.toFixed(1)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${DIFFICULTY_COLORS[c.difficulty] || "bg-neutral-100"}`}>
                          {c.difficulty}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-neutral-600">{c.type}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[c.status] || "bg-neutral-100"}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-neutral-500">
                        <div>{c.stats?.attempts || 0} lượt</div>
                        <div className="text-emerald-600">{Math.round((c.stats?.completion_rate || 0) * 100)}% hoàn thành</div>
                        <div>⭐ {c.stats?.avg_rating?.toFixed(1) || "0.0"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm">{c.source === "ai" ? "🤖 AI" : "👤 User"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setSelected(c)}
                            className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-xs hover:bg-indigo-100"
                          >
                            ✏️ Sửa
                          </button>
                          {c.status === "published" ? (
                            <button
                              onClick={() => handleStatusChange(c._id, "unpublish")}
                              className="px-2 py-1 bg-amber-50 text-amber-600 rounded-lg text-xs hover:bg-amber-100"
                            >
                              Gỡ publish
                            </button>
                          ) : c.status !== "archived" ? (
                            <button
                              onClick={() => handleStatusChange(c._id, "publish")}
                              className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-xs hover:bg-emerald-100"
                            >
                              Publish
                            </button>
                          ) : null}
                          <button
                            onClick={() => handleStatusChange(c._id, "delete")}
                            className="px-2 py-1 bg-rose-50 text-rose-600 rounded-lg text-xs hover:bg-rose-100"
                          >
                            🗑 Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-4 py-2 bg-white border border-neutral-200 rounded-lg text-sm disabled:opacity-40 hover:bg-neutral-50"
              >
                ← Trước
              </button>
              <span className="text-sm text-neutral-500">{page} / {totalPages} · {total} challenges</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-4 py-2 bg-white border border-neutral-200 rounded-lg text-sm disabled:opacity-40 hover:bg-neutral-50"
              >
                Tiếp →
              </button>
            </div>
          )}
        </>
      )}

      {/* Edit modal */}
      {selected && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
              <h2 className="font-semibold text-lg">Sửa Challenge</h2>
              <button onClick={() => setSelected(null)} className="text-neutral-400 hover:text-neutral-600 text-xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Tiêu đề</label>
                <input
                  value={selected.title}
                  onChange={(e) => setSelected({ ...selected, title: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Mô tả</label>
                <textarea
                  value={selected.description}
                  onChange={(e) => setSelected({ ...selected, description: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm min-h-[80px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Độ khó</label>
                  <select
                    value={selected.difficulty}
                    onChange={(e) => setSelected({ ...selected, difficulty: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                    <option value="expert">Expert</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Loại</label>
                  <select
                    value={selected.type}
                    onChange={(e) => setSelected({ ...selected, type: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm"
                  >
                    <option value="theory">Theory (MCQ)</option>
                    <option value="practice">Practice (Open)</option>
                    <option value="scenario">Scenario</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Kỹ năng (phân tách bằng dấu phẩy)</label>
                <input
                  value={(selected.skills_raw || []).join(", ")}
                  onChange={(e) => setSelected({ ...selected, skills_raw: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Trạng thái</label>
                <select
                  value={selected.status}
                  onChange={(e) => setSelected({ ...selected, status: e.target.value as any })}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div className="bg-neutral-50 rounded-lg p-3 text-xs text-neutral-500">
                <p><strong>ID:</strong> {selected._id}</p>
                <p><strong>Creator:</strong> {selected.creator_id || "AI"}</p>
                <p><strong>Tạo:</strong> {new Date(selected.created_at).toLocaleString("vi-VN")}</p>
                <p><strong>Điểm chất lượng:</strong> {selected.quality_score?.toFixed(2)}</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-neutral-200">
              <button
                onClick={() => setSelected(null)}
                className="px-4 py-2 bg-neutral-100 text-neutral-600 rounded-lg text-sm hover:bg-neutral-200"
              >
                Hủy
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}