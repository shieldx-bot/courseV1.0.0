"use client";

import { useEffect, useState, useCallback } from "react";
import { communityApi } from "../../../lib/community-api";
import type { Challenge, Skill } from "../../../types/community";

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  hard: "bg-rose-100 text-rose-700",
  expert: "bg-purple-100 text-purple-700",
};

const PER_PAGE = 12;

export default function ChallengesPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [recommended, setRecommended] = useState<Challenge[]>([]);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [skillFilter, setSkillFilter] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showGenerator, setShowGenerator] = useState(false);
  const [genTopic, setGenTopic] = useState("");
  const [genLoading, setGenLoading] = useState(false);
  const [showMyChallenges, setShowMyChallenges] = useState(false);
  const [myChallenges, setMyChallenges] = useState<Challenge[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, per_page: PER_PAGE, sort };
      if (skillFilter) params.skill = skillFilter;
      if (difficultyFilter) params.difficulty = difficultyFilter;
      if (sourceFilter) params.source = sourceFilter;
      const data = await communityApi.listChallenges(params);
      setChallenges(data.challenges || []);
      setTotal(data.total || 0);
    } catch {
      setChallenges([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [skillFilter, difficultyFilter, sourceFilter, sort, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    communityApi.getSkills().then((d) => setSkills(d.skills || [])).catch(() => {});
    communityApi.getRecommended(5).then((d) => setRecommended(d.challenges || [])).catch(() => {});
    communityApi.getBookmarked(100)
      .then((d) => setBookmarkedIds(new Set((d.challenges || []).map((c) => c._id))))
      .catch(() => {});
    communityApi.getMyChallenges(100)
      .then((d) => setMyChallenges(d.challenges || []))
      .catch(() => {});
  }, []);

  const handleGenerate = async () => {
    if (!genTopic.trim()) return;
    setGenLoading(true);
    try {
      await communityApi.generateChallenge({ topic: genTopic, difficulty: difficultyFilter || "medium", type: "theory" });
      setGenTopic("");
      setShowGenerator(false);
      await load();
      communityApi.getMyChallenges(100).then((d) => setMyChallenges(d.challenges || [])).catch(() => {});
    } catch (e: any) {
      alert(e.message);
    } finally {
      setGenLoading(false);
    }
  };

  const toggleBookmark = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    const isBookmarked = bookmarkedIds.has(id);
    try {
      if (isBookmarked) {
        await communityApi.unbookmark(id);
        setBookmarkedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      } else {
        await communityApi.bookmark(id);
        setBookmarkedIds((prev) => new Set(prev).add(id));
      }
    } catch (err: any) {
      alert(err.message || "Không thể thao tác bookmark");
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const displayChallenges = showMyChallenges ? myChallenges.filter((c) => c.status === "published" || c.status === "draft") : challenges;

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Challenges Arena</h1>
          <p className="text-gray-500">Luyện tập kỹ năng công nghệ qua các thử thách thực chiến.</p>
        </div>
        <button
          onClick={() => setShowGenerator(!showGenerator)}
          className="mt-4 md:mt-0 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium"
        >
          ✨ Tạo Challenge bằng AI
        </button>
      </div>

      {showGenerator && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-6 mb-8">
          <h3 className="font-semibold mb-3">AI Challenge Generator</h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              value={genTopic}
              onChange={(e) => setGenTopic(e.target.value)}
              placeholder="VD: Kubernetes Networking Debug, AWS Architecture Scenario..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={handleGenerate}
              disabled={genLoading || !genTopic.trim()}
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg disabled:opacity-50"
            >
              {genLoading ? "Đang tạo..." : "Generate"}
            </button>
          </div>
          {myChallenges.length > 0 && (
            <div className="mt-3 text-xs text-gray-500">
              Bạn có <span className="font-semibold text-indigo-600">{myChallenges.length}</span> challenge đã tạo. Xem{" "}
              <button onClick={() => setShowMyChallenges(!showMyChallenges)} className="text-indigo-600 underline">
                {showMyChallenges ? "tất cả challenges" : "challenges của tôi"}
              </button>
            </div>
          )}
        </div>
      )}

      {recommended.length > 0 && !showMyChallenges && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3">🎯 Đề xuất cho bạn</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recommended.map((c) => (
              <a
                key={c._id}
                href={`/challenges/${c._id}`}
                className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${DIFFICULTY_COLORS[c.difficulty] || "bg-gray-100"}`}>
                    {c.difficulty}
                  </span>
                  <span className="text-xs text-gray-400">{c.stats?.attempts || 0} lượt làm</span>
                </div>
                <h3 className="font-medium text-sm line-clamp-2">{c.title}</h3>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{c.description}</p>
                <div className="mt-2 text-xs text-indigo-600">{c.skills_raw?.slice(0, 2).join(" · ") || "Technology"}</div>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm p-4 mb-6 flex flex-col sm:flex-row gap-3">
        <select value={skillFilter} onChange={(e) => { setSkillFilter(e.target.value); setPage(1); }} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
          <option value="">Tất cả kỹ năng</option>
          {skills.map((s) => (
            <option key={s.skill_id} value={s.slug}>{s.name}</option>
          ))}
        </select>
        <select value={difficultyFilter} onChange={(e) => { setDifficultyFilter(e.target.value); setPage(1); }} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
          <option value="">Tất cả độ khó</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
          <option value="expert">Expert</option>
        </select>
        <select value={sourceFilter} onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
          <option value="">Tất cả nguồn</option>
          <option value="ai">🤖 AI</option>
          <option value="user">👤 User</option>
        </select>
        <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
          <option value="newest">Mới nhất</option>
          <option value="popular">Phổ biến nhất</option>
          <option value="quality">Chất lượng cao</option>
          <option value="rating">Đánh giá cao</option>
        </select>
        <div className="flex-1" />
        <div className="flex items-center gap-2 text-sm text-gray-500">
          {showMyChallenges ? (
            <button onClick={() => setShowMyChallenges(false)} className="px-3 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100">
              ← Xem tất cả
            </button>
          ) : (
            <button onClick={() => setShowMyChallenges(true)} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100">
              📝 Của tôi ({myChallenges.length})
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-500">Đang tải challenges...</div>
      ) : displayChallenges.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          {showMyChallenges ? "Bạn chưa tạo challenge nào. Hãy tạo challenge đầu tiên bằng AI!" : "Chưa có challenge nào. Hãy tạo challenge đầu tiên bằng AI!"}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayChallenges.map((c) => (
              <a
                key={c._id}
                href={`/challenges/${c._id}`}
                className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${DIFFICULTY_COLORS[c.difficulty] || "bg-gray-100"}`}>
                    {c.difficulty}
                  </span>
                  <div className="flex items-center gap-2">
                    {c.status === "draft" && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-600">Draft</span>
                    )}
                    <button
                      onClick={(e) => toggleBookmark(e, c._id)}
                      className={`text-sm transition-colors ${bookmarkedIds.has(c._id) ? "text-yellow-500" : "text-gray-300 hover:text-yellow-400"}`}
                      aria-label={bookmarkedIds.has(c._id) ? "Bỏ bookmark" : "Bookmark"}
                    >
                      {bookmarkedIds.has(c._id) ? "★" : "☆"}
                    </button>
                    <span className="text-xs text-gray-400">⭐ {c.quality_score?.toFixed(1) || "0.0"}</span>
                  </div>
                </div>
                <h3 className="font-medium text-sm line-clamp-2">{c.title}</h3>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{c.description}</p>
                <div className="flex items-center justify-between mt-3">
                  <div className="flex gap-1">
                    {c.skills_raw?.slice(0, 2).map((s, i) => (
                      <span key={i} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full text-xs">{s}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>{c.stats?.attempts || 0} lượt</span>
                    <span>{c.source === "ai" ? "🤖" : "👤"}</span>
                  </div>
                </div>
              </a>
            ))}
          </div>

          {!showMyChallenges && totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50"
              >
                ← Trước
              </button>
              <span className="text-sm text-gray-500">
                {page} / {totalPages} · {total} challenges
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50"
              >
                Tiếp →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}